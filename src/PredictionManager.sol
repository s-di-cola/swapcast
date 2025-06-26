// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/v0.8/interfaces/AggregatorV3Interface.sol";
import {ILogAutomation, Log} from "@chainlink/contracts/v0.8/automation/interfaces/ILogAutomation.sol";
import {AutomationCompatibleInterface} from "@chainlink/contracts/v0.8/automation/AutomationCompatible.sol";
import {ISwapCastNFT} from "./interfaces/ISwapCastNFT.sol";
import {IPredictionManager} from "./interfaces/IPredictionManager.sol";
import {IPredictionManagerForResolver} from "./interfaces/IPredictionManagerForResolver.sol";
import {IPredictionManagerForDistributor} from "./interfaces/IPredictionManagerForDistributor.sol";
import {PredictionTypes} from "./types/PredictionTypes.sol";
import {MarketLogic} from "./MarketLogic.sol"; // Import the new library
import {PoolKey} from "v4-core/types/PoolKey.sol";

/**
 * @title PredictionManager Contract
 * @author SwapCast Team
 * @notice Manages the creation and registry of prediction markets. Coordinates with OracleResolver,
 *         RewardDistributor, and SwapCastNFT. Uses MarketLogic library for core market operations.
 *         Integrates with Chainlink Automation for market expiration and resolution.
 * @custom:security-contact security@swapcast.xyz
 */
contract PredictionManager is
    Ownable,
    IPredictionManager,
    IPredictionManagerForResolver,
    IPredictionManagerForDistributor,
    ILogAutomation,
    AutomationCompatibleInterface,
    IERC721Receiver
{
    using MarketLogic for Market; // Attach library functions to the Market struct type

    // --- Constants ---
    bytes32 public constant MARKET_EXPIRED_SIGNATURE = keccak256("MarketExpired(uint256,uint256)");
    uint256 public constant INK_CHAIN_ID = 763373; // Ink Sepolia chain ID

    uint256 public constant MAX_BASIS_POINTS = 10_000; // 100% in basis points

    // --- State Variables ---
    address public treasuryAddress;
    address public oracleResolverAddress;
    address public rewardDistributorAddress;
    ISwapCastNFT public swapCastNFT;

    uint256 public protocolFeeBasisPoints;
    uint256 public minStakeAmount; // Global minimum stake amount
    uint256 public defaultMarketMinStake; // Default minimum stake for new markets
    uint256 public maxPriceStalenessSeconds;
    IPredictionManager.AutomationProvider public automationProvider; // Determines which automation system to use

    mapping(uint256 => Market) internal markets;
    mapping(uint256 => uint256) public marketMinStakes; // Market-specific minimum stakes
    mapping(uint256 => PoolKey) public marketIdToPoolKey;
    mapping(uint256 => uint256) public tokenIdToMarketId; // Maps NFT tokenId to marketId

    uint256[] private _marketIdsList;
    uint256 private _nextMarketId = 1; // Start market IDs from 1

    // --- Enums ---
    enum LogAction {
        None,
        EmitMarketExpired, // For checkUpkeep's performData
        ResolveMarket // For checkLog's performData

    }

    // --- Structs ---
    /**
     * @dev Defines the structure for a prediction market. Logic is handled by MarketLogic library.
     * @param marketId Unique identifier for the market.
     * @param name User-friendly name of the market.
     * @param assetSymbol The symbol of the asset being predicted.
     * @param exists True if the market has been created and exists.
     * @param resolved True if the market has been resolved.
     * @param winningOutcome The outcome that was determined as the winner.
     * @param totalConvictionStakeOutcome0 Total ETH staked on Outcome 0.
     * @param totalConvictionStakeOutcome1 Total ETH staked on Outcome 1.
     * @param userHasPredicted Mapping to track if a user has already predicted.
     * @param expirationTime Timestamp when the market expires.
     * @param priceAggregator Chainlink price feed aggregator address.
     * @param priceThreshold The price threshold for determining the outcome.
     */
    struct Market {
        uint256 marketId;
        string name;
        string assetSymbol;
        bool exists;
        bool resolved;
        PredictionTypes.Outcome winningOutcome;
        uint256 totalConvictionStakeOutcome0;
        uint256 totalConvictionStakeOutcome1;
        mapping(address => bool) userHasPredicted;
        uint256 expirationTime;
        address priceAggregator;
        uint256 priceThreshold;
    }

    // --- Events (from IPredictionManager interfaces and custom ones) ---
    event MarketCreated(
        uint256 indexed marketId,
        string name,
        string assetSymbol,
        uint256 expirationTime,
        address priceAggregator,
        uint256 priceThreshold
    );
    event FeeConfigurationChanged(address indexed newTreasuryAddress, uint256 newFeeBasisPoints);
    event MinStakeAmountChanged(uint256 newMinStakeAmount);
    event DefaultMarketMinStakeChanged(uint256 newDefaultMinStake);
    event MarketMinStakeChanged(uint256 indexed marketId, uint256 marketMinStake);
    event FeePaid(uint256 indexed marketId, address indexed user, uint256 protocolFee);
    event OracleResolverAddressSet(address indexed oldAddress, address indexed newAddress);
    event RewardDistributorAddressSet(address indexed oldAddress, address indexed newAddress);
    event StakeRecorded(
        uint256 indexed marketId, address indexed user, PredictionTypes.Outcome outcome, uint256 amount, uint256 tokenId
    );

    event RewardClaimed(address indexed user, uint256 indexed tokenId, uint256 rewardAmount);
    event MarketExpired(uint256 indexed marketId, uint256 expirationTimestamp); // For Chainlink Automation
    event MarketResolutionFailed(uint256 indexed marketId, string reason);

    // --- Errors ---
    /**
     * @notice Thrown when invalid fee basis points are provided.
     * @param feeBasisPoints The invalid fee basis points value that was provided.
     */
    error InvalidFeeBasisPoints(uint256 feeBasisPoints);

    /**
     * @notice Thrown when an invalid minimum stake amount is provided.
     * @param minStakeAmount The invalid minimum stake amount that was provided.
     */
    error InvalidMinStakeAmount(uint256 minStakeAmount);

    /**
     * @notice Thrown when attempting to create a market with an ID that already exists.
     * @param marketId The ID of the market that already exists.
     */
    error MarketAlreadyExists(uint256 marketId);
    /**
     * @notice Thrown when attempting to access a market that doesn't exist.
     * @param marketId The ID of the market that was requested.
     */
    error MarketDoesNotExist(uint256 marketId);

    /**
     * @notice Thrown when attempting to resolve a market that has already been resolved.
     * @param marketId The ID of the market that was attempted to be resolved.
     */
    error MarketAlreadyResolved(uint256 marketId);

    /**
     * @notice Thrown when attempting to claim rewards for a market that hasn't been resolved yet.
     * @param marketId The ID of the market that was attempted to claim rewards from.
     */
    error MarketNotResolved(uint256 marketId);

    /**
     * @notice Thrown when a user attempts to make a prediction on a market they've already predicted on.
     * @param marketId The ID of the market.
     * @param user The address of the user who has already made a prediction.
     */
    error AlreadyPredicted(uint256 marketId, address user);

    /**
     * @notice Thrown when a zero address is provided for a parameter that requires a non-zero address.
     */
    error ZeroAddressInput();

    /**
     * @notice Thrown when an invalid expiration time is provided for a market.
     * @param expirationTime The provided expiration time.
     * @param currentTime The current block timestamp.
     */
    error InvalidExpirationTime(uint256 expirationTime, uint256 currentTime);

    /**
     * @notice Thrown when an invalid price threshold is provided for a market.
     */
    error InvalidPriceThreshold();

    /**
     * @notice Thrown when an invalid pool key is provided for a market.
     */
    error InvalidPoolKey();

    /**
     * @notice Thrown when an invalid asset symbol is provided for a market.
     */
    error InvalidAssetSymbol();

    /**
     * @notice Thrown when a zero amount is provided for a prediction stake.
     */
    error AmountCannotBeZero();

    /**
     * @notice Thrown when a stake amount is below the minimum required amount.
     * @param sentAmount The amount that was sent.
     * @param minRequiredAmount The minimum required amount.
     */
    error StakeBelowMinimum(uint256 sentAmount, uint256 minRequiredAmount);

    /**
     * @notice Thrown when attempting to claim rewards for an NFT that didn't win.
     * @param tokenId The ID of the NFT.
     * @param predictedOutcome The outcome that was predicted.
     * @param winningOutcome The actual winning outcome.
     */
    error NotWinningNFT(uint256 tokenId, uint8 predictedOutcome, uint8 winningOutcome);

    /**
     * @notice Thrown when attempting to claim rewards for an outcome with no stake.
     * @param marketId The ID of the market.
     * @param outcomeIndex The index of the outcome with no stake.
     */
    error ClaimFailedNoStakeForOutcome(uint256 marketId, uint8 outcomeIndex);

    /**
     * @notice Thrown when a reward transfer fails.
     * @param to The address that was supposed to receive the reward.
     * @param amount The amount that was supposed to be transferred.
     */
    error RewardTransferFailed(address to, uint256 amount);

    /**
     * @notice Thrown when a fee transfer fails.
     * @param to The address that was supposed to receive the fee.
     * @param amount The amount that was supposed to be transferred.
     */
    error FeeTransferFailed(address to, uint256 amount);

    /**
     * @notice Thrown when a function that should only be called by the reward distributor is called by another address.
     */
    error NotRewardDistributor();

    /**
     * @notice Thrown when an invalid market ID is provided.
     */
    error InvalidMarketId();

    /**
     * @notice Thrown when a function that should only be called by the oracle resolver is called by another address.
     */
    error NotOracleResolver();

    /**
     * @notice Thrown when a price oracle's data is stale.
     * @param lastUpdatedAt The timestamp when the price feed was last updated.
     * @param currentTime The current block timestamp.
     * @param maxStaleness The maximum allowed staleness in seconds.
     */
    error PriceOracleStale(uint256 lastUpdatedAt, uint256 currentTime, uint256 maxStaleness);

    /**
     * @notice Thrown when market resolution fails due to an oracle error.
     */
    error ResolutionFailedOracleError();

    /**
     * @notice Thrown when invalid upkeep data is provided.
     * @param reason A description of why the data is invalid.
     */
    error InvalidUpkeepData(string reason);

    /**
     * @notice Thrown when there's a mismatch between the declared stake and the actual value sent.
     * @param actual The actual value sent.
     * @param declared The declared stake amount.
     */
    error StakeMismatch(uint256 actual, uint256 declared);

    /**
     * @notice Thrown when an empty market name is provided.
     */
    error EmptyMarketName();

    /**
     * @notice Thrown when a function that should only be called with Chainlink automation is called with a different provider.
     */
    error OnlyChainlinkAutomation();

    /**
     * @notice Thrown when a function that should only be called with Gelato automation is called with a different provider.
     */
    error OnlyGelatoAutomation();

    // --- Modifiers ---
    modifier onlyOracleResolverContract() {
        // Renamed to avoid clash with MarketLogic's potential name
        if (msg.sender != oracleResolverAddress) revert NotOracleResolver();
        _;
    }

    modifier onlyRewardDistributorContract() {
        // Renamed
        if (msg.sender != rewardDistributorAddress) {
            revert NotRewardDistributor();
        }
        _;
    }

    modifier onlyChainlinkAutomation() {
        if (automationProvider != IPredictionManager.AutomationProvider.CHAINLINK) {
            revert OnlyChainlinkAutomation();
        }
        _;
    }

    modifier onlyGelatoAutomation() {
        if (automationProvider != IPredictionManager.AutomationProvider.GELATO) {
            revert OnlyGelatoAutomation();
        }
        _;
    }

    // --- Constructor ---
    constructor(
        address _initialOwner,
        address _swapCastNFTAddress,
        address _treasuryAddress,
        uint256 _initialFeeBasisPoints,
        uint256 _initialMinStakeAmount,
        uint256 _maxPriceStalenessSeconds,
        address _oracleResolverAddress, // Injected
        address _rewardDistributorAddress // Injected
    ) Ownable(_initialOwner) {
        if (_swapCastNFTAddress == address(0) || _treasuryAddress == address(0)) {
            revert ZeroAddressInput();
        }
        if (_initialFeeBasisPoints > 10000) {
            revert InvalidFeeBasisPoints(_initialFeeBasisPoints);
        }
        if (_initialMinStakeAmount == 0) {
            revert InvalidMinStakeAmount(_initialMinStakeAmount);
        }

        swapCastNFT = ISwapCastNFT(_swapCastNFTAddress);
        treasuryAddress = _treasuryAddress;
        protocolFeeBasisPoints = _initialFeeBasisPoints;
        minStakeAmount = _initialMinStakeAmount;
        defaultMarketMinStake = _initialMinStakeAmount; // Initialize default market min stake to global min stake
        maxPriceStalenessSeconds = _maxPriceStalenessSeconds;
        oracleResolverAddress = _oracleResolverAddress;
        rewardDistributorAddress = _rewardDistributorAddress;

        // Set automation provider based on chain ID
        if (block.chainid == INK_CHAIN_ID) {
            automationProvider = IPredictionManager.AutomationProvider.GELATO;
        } else {
            automationProvider = IPredictionManager.AutomationProvider.CHAINLINK;
        }

        emit FeeConfigurationChanged(_treasuryAddress, _initialFeeBasisPoints);
        emit MinStakeAmountChanged(_initialMinStakeAmount);
    }

    // --- Market Management Functions ---
    function createMarket(
        string memory _name,
        string memory _assetSymbol,
        uint256 _expirationTime,
        address _priceAggregator,
        uint256 _priceThreshold,
        PoolKey calldata _poolKey
    ) external onlyOwner returns (uint256 marketId) {
        // Input validation
        if (bytes(_name).length == 0) revert EmptyMarketName();
        if (bytes(_assetSymbol).length == 0) revert InvalidAssetSymbol();
        if (_expirationTime <= block.timestamp) {
            revert InvalidExpirationTime(_expirationTime, block.timestamp);
        }
        if (_priceAggregator == address(0)) revert ZeroAddressInput();
        if (_priceThreshold == 0) revert InvalidPriceThreshold();
        if (_poolKey.currency0 == _poolKey.currency1) revert InvalidPoolKey();

        // Assign and increment market ID
        marketId = _nextMarketId++;
        if (markets[marketId].exists) revert MarketAlreadyExists(marketId); // Should not happen with auto-incrementing ID

        // Initialize market with all fields
        Market storage newMarket = markets[marketId];
        newMarket.marketId = marketId;
        newMarket.name = _name;
        newMarket.assetSymbol = _assetSymbol;
        newMarket.exists = true;
        newMarket.resolved = false;
        newMarket.winningOutcome = PredictionTypes.Outcome.Bearish; // Default to Bearish (0)
        newMarket.totalConvictionStakeOutcome0 = 0;
        newMarket.totalConvictionStakeOutcome1 = 0;
        newMarket.expirationTime = _expirationTime;
        newMarket.priceAggregator = _priceAggregator;
        newMarket.priceThreshold = _priceThreshold;

        // Store the PoolKey for this market
        marketIdToPoolKey[marketId] = _poolKey;

        // Set market-specific min stake to the current default
        marketMinStakes[marketId] = defaultMarketMinStake;

        _marketIdsList.push(marketId);
        emit MarketCreated(marketId, _name, _assetSymbol, _expirationTime, _priceAggregator, _priceThreshold);
        return marketId;
    }

    // --- Fee and Stake Configuration ---
    function setFeeConfiguration(address _newTreasuryAddress, uint256 _newFeeBasisPoints) external onlyOwner {
        if (_newTreasuryAddress == address(0)) revert ZeroAddressInput();
        if (_newFeeBasisPoints > MAX_BASIS_POINTS) {
            revert InvalidFeeBasisPoints(_newFeeBasisPoints);
        }
        treasuryAddress = _newTreasuryAddress;
        protocolFeeBasisPoints = _newFeeBasisPoints;
        emit FeeConfigurationChanged(_newTreasuryAddress, _newFeeBasisPoints);
    }

    /**
     * @notice Sets the global minimum stake amount for all markets
     * @dev This affects the minimum stake amount for all markets, but doesn't update
     *      the default for new markets or existing market-specific minimums.
     * @param _newMinStakeAmount The new minimum stake amount in wei
     */
    function setMinStakeAmount(uint256 _newMinStakeAmount) external onlyOwner {
        if (_newMinStakeAmount == 0) {
            revert InvalidMinStakeAmount(_newMinStakeAmount);
        }
        minStakeAmount = _newMinStakeAmount;
        emit MinStakeAmountChanged(_newMinStakeAmount);
    }

    /**
     * @notice Sets the default minimum stake amount for new markets
     * @dev This affects only markets created after this call
     * @param _newDefaultMinStake The new default minimum stake amount in wei
     */
    function setDefaultMarketMinStake(uint256 _newDefaultMinStake) external onlyOwner {
        if (_newDefaultMinStake == 0) {
            revert InvalidMinStakeAmount(_newDefaultMinStake);
        }
        if (_newDefaultMinStake < minStakeAmount) {
            revert InvalidMinStakeAmount(_newDefaultMinStake);
        }
        defaultMarketMinStake = _newDefaultMinStake;
        emit DefaultMarketMinStakeChanged(_newDefaultMinStake);
    }

    /**
     * @notice Sets the minimum stake amount for a specific market
     * @dev This allows for market-specific minimum stakes that can be adjusted based on
     *      market conditions, popularity, or risk profile
     * @param _marketId The ID of the market to update
     * @param _marketMinStake The new minimum stake amount for this market in wei
     */
    function setMarketMinStake(uint256 _marketId, uint256 _marketMinStake) external onlyOwner {
        if (!markets[_marketId].exists) revert MarketDoesNotExist(_marketId);
        if (_marketMinStake == 0) {
            revert InvalidMinStakeAmount(_marketMinStake);
        }
        if (_marketMinStake < minStakeAmount) {
            revert InvalidMinStakeAmount(_marketMinStake);
        }
        marketMinStakes[_marketId] = _marketMinStake;
        emit MarketMinStakeChanged(_marketId, _marketMinStake);
    }

    function setMaxPriceStaleness(uint256 _newStalenessSeconds) external onlyOwner {
        maxPriceStalenessSeconds = _newStalenessSeconds;
    }

    /**
     * @notice Sets the OracleResolver address
     * @dev Only callable by the contract owner
     * @param _newOracleResolverAddress The address of the new OracleResolver contract
     */
    function setOracleResolverAddress(address _newOracleResolverAddress) external onlyOwner {
        if (_newOracleResolverAddress == address(0)) revert ZeroAddressInput();
        oracleResolverAddress = _newOracleResolverAddress;
        emit OracleResolverAddressSet(oracleResolverAddress, _newOracleResolverAddress);
    }

    /**
     * @notice Sets the RewardDistributor address
     * @dev Only callable by the contract owner
     * @param _newRewardDistributorAddress The address of the new RewardDistributor contract
     */
    function setRewardDistributorAddress(address _newRewardDistributorAddress) external onlyOwner {
        if (_newRewardDistributorAddress == address(0)) {
            revert ZeroAddressInput();
        }
        rewardDistributorAddress = _newRewardDistributorAddress;
        emit RewardDistributorAddressSet(rewardDistributorAddress, _newRewardDistributorAddress);
    }

    // --- Prediction Logic (IPredictionManager Implementation) ---
    /**
     * @notice Records a prediction for a user on a specific market.
     * @dev This function handles the complete prediction recording process, including:
     *      1. Validating inputs and market existence
     *      2. Calculating and transferring protocol fees
     *      3. Minting an NFT representing the prediction position
     *      4. Updating market state with the new prediction
     *      5. Storing the tokenId to marketId mapping
     *
     *      The function uses the MarketLogic library for core prediction logic.
     *
     * @param _user The address of the user making the prediction.
     * @param _marketId The ID of the market to predict on.
     * @param _outcome The outcome being predicted (Bullish or Bearish).
     * @param _convictionStakeDeclared The amount of ETH being staked on this prediction.
     * @custom:reverts ZeroAddressInput If the user address is zero.
     * @custom:reverts AmountCannotBeZero If the conviction stake is zero.
     * @custom:reverts StakeMismatch If the ETH value sent doesn't match the expected amount.
     * @custom:reverts MarketDoesNotExist If the specified market doesn't exist.
     * @custom:reverts MarketAlreadyResolved If the market has already been resolved.
     * @custom:reverts AlreadyPredicted If the user has already predicted on this market.
     * @custom:reverts StakeBelowMinimum If the stake amount is below the minimum required.
     */
    function recordPrediction(
        address _user,
        uint256 _marketId,
        PredictionTypes.Outcome _outcome,
        uint128 _convictionStakeDeclared
    ) external payable override {
        // Input validation
        if (_user == address(0)) revert ZeroAddressInput();
        if (_convictionStakeDeclared == 0) revert AmountCannotBeZero();

        // Cache storage variables in memory to reduce SLOADs
        uint256 feeBasis = protocolFeeBasisPoints;
        uint256 stakeAmount = uint256(_convictionStakeDeclared);

        // Calculate fee and expected value using cached values
        uint256 fee = (stakeAmount * feeBasis) / MAX_BASIS_POINTS;
        uint256 expectedValue = stakeAmount + fee; // No overflow check needed due to previous checks

        // Validate the sent ETH amount
        if (msg.value != expectedValue) {
            revert StakeMismatch(msg.value, expectedValue);
        }

        // Validate market exists
        Market storage market = markets[_marketId];
        if (!market.exists) revert MarketDoesNotExist(_marketId);

        // Get market-specific min stake, defaulting to global min if not set
        // Cache this to avoid multiple SLOADs
        uint256 minStake = marketMinStakes[_marketId];
        if (minStake == 0) {
            minStake = minStakeAmount;
        }

        // Call library function to handle core prediction logic
        // This will revert with appropriate errors if conditions aren't met
        (uint256 stakeAmountNet, uint256 protocolFee, uint256 tokenId) = market.recordPrediction(
            _user, _outcome, _convictionStakeDeclared, swapCastNFT, treasuryAddress, feeBasis, minStake
        );

        // Store the tokenId to marketId mapping
        tokenIdToMarketId[tokenId] = _marketId;

        // Emit events
        if (protocolFee > 0) {
            emit FeePaid(_marketId, _user, protocolFee);
        }
        emit StakeRecorded(_marketId, _user, _outcome, stakeAmountNet, tokenId);
    }

    // --- Market Resolution (IPredictionManagerForResolver Implementation) ---
    /**
     * @notice Called by OracleResolver to submit resolution data for a market.
     * @dev This function finalizes a market by setting the winning outcome and marking it as resolved.
     *      It can only be called by the authorized OracleResolver contract.
     *      The actual resolution logic is handled by the MarketLogic library.
     *
     *      The function performs the following steps:
     *      1. Validates that the market exists
     *      2. Calls the MarketLogic library to handle the resolution logic
     *      3. Emits a MarketResolved event with the outcome and total prize pool
     *
     * @param _marketId The ID of the market to resolve.
     * @param _winningOutcome The winning outcome determined by the oracle (Bullish or Bearish).
     * @param _oraclePrice The price reported by the oracle, used for verification and event emission.
     * @custom:reverts NotOracleResolver If called by an address other than the authorized oracle resolver.
     * @custom:reverts MarketDoesNotExist If the specified market doesn't exist.
     * @custom:reverts MarketAlreadyResolved If the market has already been resolved.
     */
    function resolveMarket(uint256 _marketId, PredictionTypes.Outcome _winningOutcome, int256 _oraclePrice)
        external
        virtual
        override
        onlyOracleResolverContract
    {
        // Validate market exists
        Market storage market = markets[_marketId];
        if (!market.exists) revert MarketDoesNotExist(_marketId);

        // Call library function to handle resolution logic
        // This will revert with MarketAlreadyResolved if the market is already resolved
        uint256 totalPrizePool = market.resolve(_winningOutcome, _oraclePrice);

        // Emit event with resolution details
        emit MarketResolved(_marketId, _winningOutcome, _oraclePrice, totalPrizePool);
    }

    // --- Reward Claiming (IPredictionManagerForDistributor Implementation) ---
    /**
     * @notice Called by RewardDistributor to process a reward claim for an NFT.
     * @dev This function handles the complete reward claim process for a winning NFT position.
     *      It can only be called by the authorized RewardDistributor contract.
     *      The actual reward calculation and transfer logic is handled by the MarketLogic library.
     *
     *      The function performs the following steps:
     *      1. Retrieves the prediction details from the NFT
     *      2. Validates that the market exists
     *      3. Calls the MarketLogic library to handle the reward claim logic
     *      4. Cleans up the tokenId mapping after successful claim
     *      5. Emits a RewardClaimed event with the reward amount
     *
     * @param _tokenId The ID of the SwapCastNFT representing the winning position.
     * @custom:reverts NotRewardDistributor If called by an address other than the authorized reward distributor.
     * @custom:reverts MarketDoesNotExist If the market associated with the NFT doesn't exist.
     * @custom:reverts MarketNotResolved If the market hasn't been resolved yet.
     * @custom:reverts NotWinningNFT If the NFT's prediction doesn't match the winning outcome.
     * @custom:reverts ClaimFailedNoStakeForOutcome If there's no stake for the winning outcome.
     * @custom:reverts RewardTransferFailed If the reward transfer fails.
     */
    function claimReward(uint256 _tokenId) external virtual override onlyRewardDistributorContract {
        // Retrieve prediction details from the NFT
        (uint256 marketIdNFT, PredictionTypes.Outcome predictionOutcome, uint256 userConvictionStake, address nftOwner)
        = swapCastNFT.getPredictionDetails(_tokenId);

        // Validate market exists
        Market storage market = markets[marketIdNFT];
        if (!market.exists) revert MarketDoesNotExist(marketIdNFT);

        // Call library function to handle reward claim logic
        // This will revert with appropriate errors if conditions aren't met
        // (e.g., market not resolved, not winning NFT, no stake for outcome, etc.)
        uint256 rewardAmount =
            market.claimReward(_tokenId, predictionOutcome, userConvictionStake, nftOwner, swapCastNFT);

        // Clean up the tokenId mapping since the NFT is burned after claiming
        delete tokenIdToMarketId[_tokenId];

        // Emit event with claim details
        emit RewardClaimed(nftOwner, _tokenId, rewardAmount);
    }

    // --- View Functions ---
    function getMarketDetails(uint256 _marketId)
        external
        view
        returns (
            uint256 marketId_,
            string memory name_,
            string memory assetSymbol_,
            bool exists_,
            bool resolved_,
            PredictionTypes.Outcome winningOutcome_,
            uint256 totalConvictionStakeOutcome0_,
            uint256 totalConvictionStakeOutcome1_,
            uint256 expirationTime_,
            address priceAggregator_,
            uint256 priceThreshold_
        )
    {
        Market storage market = markets[_marketId];
        return (
            market.marketId,
            market.name,
            market.assetSymbol,
            market.exists,
            market.resolved,
            market.winningOutcome,
            market.totalConvictionStakeOutcome0,
            market.totalConvictionStakeOutcome1,
            market.expirationTime,
            market.priceAggregator,
            market.priceThreshold
        );
    }

    function getUserHasPredicted(uint256 _marketId, address _user) external view returns (bool) {
        if (!markets[_marketId].exists) return false; // Or revert MarketDoesNotExist
        return markets[_marketId].userHasPredicted[_user];
    }

    function getMarketCount() external view returns (uint256) {
        return _marketIdsList.length;
    }

    function getMarketIdAtIndex(uint256 _index) external view returns (uint256) {
        if (_index >= _marketIdsList.length) revert InvalidMarketId(); // Or specific out of bounds error
        return _marketIdsList[_index];
    }

    function getActiveMarkets() external view returns (uint256[] memory) {
        uint256 count = _marketIdsList.length;
        uint256[] memory activeMarkets = new uint256[](count);
        uint256 activeCount = 0;

        // Cache storage variables in memory
        uint256 currentTime = block.timestamp;

        // Use unchecked for gas savings (i can't overflow due to array bounds)
        for (uint256 i = 0; i < count;) {
            uint256 marketId = _marketIdsList[i];
            Market storage market = markets[marketId];

            if (!market.resolved && market.expirationTime > currentTime) {
                activeMarkets[activeCount] = marketId;
                unchecked {
                    activeCount++;
                }
            }

            unchecked {
                i++;
            }
        }

        // Trim the array to remove empty slots
        if (count == activeCount) {
            return activeMarkets; // No need to trim if all are active
        }

        uint256[] memory result = new uint256[](activeCount);
        for (uint256 i = 0; i < activeCount;) {
            result[i] = activeMarkets[i];
            unchecked {
                i++;
            }
        }

        return result;
    }

    /**
     * @notice Gets the market ID associated with a given NFT token ID.
     * @param _tokenId The ID of the SwapCastNFT token.
     * @return The market ID associated with the token, or 0 if not found.
     */
    function getMarketIdByTokenId(uint256 _tokenId) external view returns (uint256) {
        return tokenIdToMarketId[_tokenId];
    }

    /**
     * @notice Gets comprehensive prediction details for a given NFT token ID.
     * @dev This function combines data from both the NFT contract and the market mapping
     *      to provide complete prediction information in a single call.
     * @param _tokenId The ID of the SwapCastNFT token.
     * @return marketId The market ID associated with the prediction.
     * @return outcome The predicted outcome (Bullish or Bearish).
     * @return convictionStake The amount staked on this prediction.
     * @return owner The current owner of the NFT.
     * @return isResolved Whether the associated market has been resolved.
     * @return winningOutcome The winning outcome if the market is resolved (undefined if not resolved).
     */
    function getPredictionDetailsByTokenId(uint256 _tokenId)
        external
        view
        returns (
            uint256 marketId,
            PredictionTypes.Outcome outcome,
            uint256 convictionStake,
            address owner,
            bool isResolved,
            PredictionTypes.Outcome winningOutcome
        )
    {
        // Get basic prediction details from NFT
        (marketId, outcome, convictionStake, owner) = swapCastNFT.getPredictionDetails(_tokenId);

        // Validate the tokenId mapping matches the NFT data
        uint256 mappedMarketId = tokenIdToMarketId[_tokenId];
        require(mappedMarketId == marketId, "TokenId mapping mismatch");

        // Get market resolution status
        Market storage market = markets[marketId];
        isResolved = market.resolved;
        winningOutcome = market.winningOutcome;

        return (marketId, outcome, convictionStake, owner, isResolved, winningOutcome);
    }

    // --- Log Automation Logic (ILogAutomation) ---
    function checkLog(
        Log calldata _log,
        bytes calldata /*_checkData*/ // Implements ILogAutomation
    ) external view override onlyChainlinkAutomation returns (bool upkeepNeeded, bytes memory performData) {
        // Check if the log was emitted by this contract and is a MarketExpired event
        if (_log.source != address(this) || _log.topics.length < 2 || _log.topics[0] != MARKET_EXPIRED_SIGNATURE) {
            return (false, bytes(""));
        }

        // MarketExpired(uint256 indexed marketId, uint256 timestamp)
        // topics[0] = event signature
        // topics[1] = marketId (indexed)
        uint256 marketIdFromLogTopic = uint256(_log.topics[1]);

        Market storage market = markets[marketIdFromLogTopic];

        // Ensure the market exists and is not yet resolved
        if (!market.exists || market.resolved) {
            return (false, bytes(""));
        }

        // If all checks pass, upkeep is needed to resolve the market.
        // performData will contain the action and marketId.
        return (true, abi.encode(LogAction.ResolveMarket, marketIdFromLogTopic));
    }

    function performUpkeep(bytes calldata performData)
        external
        override(ILogAutomation, AutomationCompatibleInterface)
    {
        // First, try to decode just the LogAction to determine how to proceed
        // This assumes LogAction is the first element and is of a simple type (like enum/uint8)
        LogAction action = abi.decode(performData, (LogAction));

        if (action == LogAction.EmitMarketExpired) {
            // Now decode the full structure for EmitMarketExpired
            (, uint256[] memory marketIdsToProcess) = abi.decode(performData, (LogAction, uint256[]));
            for (uint256 i = 0; i < marketIdsToProcess.length; i++) {
                uint256 marketIdToEmit = marketIdsToProcess[i];
                Market storage market = markets[marketIdToEmit];
                if (
                    market.exists && !market.resolved && market.expirationTime > 0
                        && market.expirationTime <= block.timestamp
                ) {
                    emit MarketExpired(marketIdToEmit, block.timestamp);
                }
            }
        } else if (action == LogAction.ResolveMarket) {
            // Now decode the full structure for ResolveMarket
            (, uint256 marketIdToResolve) = abi.decode(performData, (LogAction, uint256));

            _triggerMarketResolution(marketIdToResolve);
        } else {
            revert InvalidUpkeepData("Unknown LogAction in performData");
        }
    }

    /**
     * @notice Internal function to fetch oracle price and resolve a market.
     * @dev This function is called by performUpkeep when triggered by a MarketExpired log event.
     *      It handles the automated resolution of markets using their configured price oracles.
     *
     *      The function performs the following steps:
     *      1. Validates that the market exists, is not already resolved, and has a valid price aggregator
     *      2. Confirms that the market has actually expired
     *      3. Fetches the current price from the oracle and determines the winning outcome
     *      4. Calls the MarketLogic library to handle the resolution logic
     *      5. Emits a MarketResolved event with the outcome and total prize pool
     *
     *      If any validation fails, the function returns early without taking action.
     *      If the oracle call fails (e.g., due to stale price data), the function will revert.
     *
     * @param _marketId The ID of the market to resolve.
     * @custom:reverts PriceOracleStale If the oracle price data is stale.
     */
    function _triggerMarketResolution(uint256 _marketId) internal {
        // Load market into storage once to save gas
        Market storage market = markets[_marketId];

        // Early return conditions - avoid unnecessary processing
        if (!market.exists || market.resolved || market.priceAggregator == address(0)) {
            return; // Market doesn't exist, is already resolved, or has no price aggregator
        }

        // Cache the current timestamp to avoid multiple calls to block.timestamp
        uint256 currentTime = block.timestamp;

        // Check if actually expired, though log trigger from MarketExpired implies it
        if (currentTime < market.expirationTime) {
            return; // Not yet expired, should not happen if MarketExpired was emitted correctly
        }

        // Cache the max staleness value to avoid an SLOAD
        uint256 maxStaleness = maxPriceStalenessSeconds;

        // Call the library function to get the outcome from the oracle
        // This will revert with PriceOracleStale if the price data is too old
        (PredictionTypes.Outcome outcome, int256 price) = market.getOutcomeFromOracle(maxStaleness);

        // Call the library function to handle the resolution logic
        // This will revert with MarketAlreadyResolved if the market is already resolved
        uint256 totalPrizePool = market.resolve(outcome, price);

        // Emit event with resolution details
        emit MarketResolved(_marketId, outcome, price, totalPrizePool);
    }

    /**
     * @notice Checks for markets that have expired and need the MarketExpired event emitted.
     * @dev Called by Chainlink Automation on a time-based schedule.
     * @return upkeepNeeded Boolean indicating if there are markets needing event emission.
     * @return performData Encoded array of market IDs for which to emit MarketExpired.
     */
    function checkUpkeep(bytes calldata /* checkData */ )
        external
        view
        override(
            AutomationCompatibleInterface // Specify which override if multiple interfaces have it
        )
        onlyChainlinkAutomation
        returns (bool upkeepNeeded, bytes memory performData)
    {
        uint256[] memory marketIdsToNotify = new uint256[](_marketIdsList.length); // Max possible size
        uint256 count = 0;

        for (uint256 i = 0; i < _marketIdsList.length; i++) {
            uint256 marketId = _marketIdsList[i];
            Market storage market = markets[marketId];

            if (
                market.exists && !market.resolved && market.expirationTime > 0
                    && market.expirationTime <= block.timestamp
            ) {
                marketIdsToNotify[count] = marketId;
                count++;
            }
            if (count == 50) break; // Limit batch size for gas considerations
        }

        if (count == 0) {
            return (false, "");
        }

        // Resize array to actual count
        uint256[] memory finalMarketIds = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            finalMarketIds[i] = marketIdsToNotify[i];
        }

        performData = abi.encode(LogAction.EmitMarketExpired, finalMarketIds);
        return (true, performData);
    }

    // --- Gelato Automation Functions ---
    /**
     * @notice Checks if upkeep is needed by looking for expired markets (Gelato version).
     * @dev This function is designed to be called by Gelato's automation system.
     *      It scans through markets to find those that have expired but haven't been resolved.
     * @return canExec Boolean indicating if there are markets needing resolution.
     * @return execPayload Encoded data for the performGelatoUpkeep function containing market IDs to process.
     */
    function checker() external view onlyGelatoAutomation returns (bool canExec, bytes memory execPayload) {
        uint256[] memory expiredMarkets = _getExpiredMarkets();

        if (expiredMarkets.length == 0) {
            return (false, "");
        }

        // Encode the expired market IDs for the performGelatoUpkeepWithIds function
        execPayload = abi.encodeWithSelector(this.performGelatoUpkeepWithIds.selector, expiredMarkets);
        return (true, execPayload);
    }

    /**
     * @notice Performs upkeep by processing expired markets (Gelato version with parameters).
     * @dev This function is called by Gelato when upkeep is needed.
     *      It processes each expired market by emitting MarketExpired events and triggering resolution.
     * @param expiredMarketIds Array of market IDs that need to be processed.
     */
    function performGelatoUpkeepWithIds(uint256[] calldata expiredMarketIds) external onlyGelatoAutomation {
        if (expiredMarketIds.length == 0) {
            revert InvalidUpkeepData("No markets to process");
        }

        // First, emit MarketExpired events for all expired markets
        uint256 currentTime = block.timestamp;
        for (uint256 i = 0; i < expiredMarketIds.length; i++) {
            uint256 marketId = expiredMarketIds[i];

            // Verify the market is actually expired before emitting event
            if (_isMarketExpired(marketId)) {
                emit MarketExpired(marketId, currentTime);
            }
        }

        // Then attempt to resolve each market
        for (uint256 i = 0; i < expiredMarketIds.length; i++) {
            uint256 marketId = expiredMarketIds[i];
            _triggerMarketResolution(marketId);
        }
    }

    /**
     * @notice Performs Gelato upkeep to resolve expired markets (interface version).
     * @dev This function is required by the IPredictionManager interface.
     *      It automatically detects expired markets and processes them.
     */
    function performGelatoUpkeep() external onlyGelatoAutomation {
        uint256[] memory expiredMarkets = _getExpiredMarkets();

        if (expiredMarkets.length == 0) {
            revert InvalidUpkeepData("No markets to process");
        }

        // First, emit MarketExpired events for all expired markets
        uint256 currentTime = block.timestamp;
        for (uint256 i = 0; i < expiredMarkets.length; i++) {
            uint256 marketId = expiredMarkets[i];

            // Verify the market is actually expired before emitting event
            if (_isMarketExpired(marketId)) {
                emit MarketExpired(marketId, currentTime);
            }
        }

        // Then attempt to resolve each market
        for (uint256 i = 0; i < expiredMarkets.length; i++) {
            uint256 marketId = expiredMarkets[i];
            _triggerMarketResolution(marketId);
        }
    }

    /**
     * @notice Manual function to resolve a specific market (for emergency use).
     * @param marketId The ID of the market to resolve.
     */
    function resolveMarketManual(uint256 marketId) external onlyOwner {
        _triggerMarketResolution(marketId);
    }

    /**
     * @notice Internal function to get all expired markets.
     * @return expiredMarkets Array of market IDs that have expired but not been resolved.
     */
    function _getExpiredMarkets() internal view returns (uint256[] memory) {
        uint256 marketCount = _marketIdsList.length;
        uint256[] memory tempExpired = new uint256[](marketCount); // Max possible size
        uint256 expiredCount = 0;
        uint256 currentTime = block.timestamp;

        // Limit the number of markets we check to avoid gas issues (max 50)
        uint256 marketsToCheck = marketCount > 50 ? 50 : marketCount;

        for (uint256 i = 0; i < marketsToCheck; i++) {
            uint256 marketId = _marketIdsList[i];
            Market storage market = markets[marketId];

            if (market.exists && !market.resolved && market.expirationTime > 0 && market.expirationTime <= currentTime)
            {
                tempExpired[expiredCount] = marketId;
                expiredCount++;
            }
        }

        // Resize array to actual count
        uint256[] memory expiredMarkets = new uint256[](expiredCount);
        for (uint256 i = 0; i < expiredCount; i++) {
            expiredMarkets[i] = tempExpired[i];
        }

        return expiredMarkets;
    }

    /**
     * @notice Internal function to check if a specific market has expired.
     * @param marketId The ID of the market to check.
     * @return expired True if the market has expired and is not resolved.
     */
    function _isMarketExpired(uint256 marketId) internal view returns (bool expired) {
        Market storage market = markets[marketId];
        return
            market.exists && !market.resolved && market.expirationTime > 0 && market.expirationTime <= block.timestamp;
    }

    // --- View Functions for Automation ---
    /**
     * @notice Gets the list of currently expired markets.
     * @return Array of market IDs that have expired but not been resolved.
     */
    function getExpiredMarkets() external view returns (uint256[] memory) {
        return _getExpiredMarkets();
    }

    /**
     * @notice Checks if a specific market has expired.
     * @param marketId The ID of the market to check.
     * @return True if the market has expired and is not resolved.
     */
    function isMarketExpired(uint256 marketId) external view returns (bool) {
        return _isMarketExpired(marketId);
    }

    // --- IERC721Receiver Implementation ---
    function onERC721Received(
        address,
        /*operator*/
        address,
        /*from*/
        uint256,
        /*tokenId*/
        bytes calldata /*data*/
    ) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }
}
