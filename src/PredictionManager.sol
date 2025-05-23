// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

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
 *         Integrates with Chainlink Automtion for market expiration and resolution.
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

    // --- Constants ---
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

    mapping(uint256 => Market) internal markets;
    mapping(uint256 => uint256) public marketMinStakes; // Market-specific minimum stakes
    mapping(uint256 => PoolKey) public marketIdToPoolKey;

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
        uint256 indexed marketId, address indexed user, PredictionTypes.Outcome outcome, uint256 amount
    );
    event RewardClaimed(address indexed user, uint256 indexed tokenId, uint256 rewardAmount);
    event MarketExpired(uint256 indexed marketId, uint256 expirationTimestamp); // For Chainlink Automation
    event MarketResolutionFailed(uint256 indexed marketId, string reason);

    // --- Errors ---
    error InvalidFeeBasisPoints(uint256 feeBasisPoints);
    error InvalidMinStakeAmount(uint256 minStakeAmount);
    error MarketAlreadyExists(uint256 marketId);
    error MarketDoesNotExist(uint256 marketId);
    error MarketAlreadyResolved(uint256 marketId); // Can be emitted by PM or bubbled from MarketLogic
    error MarketNotResolved(uint256 marketId); // Can be emitted by PM or bubbled from MarketLogic
    error AlreadyPredicted(uint256 marketId, address user); // Can be emitted by PM or bubbled from MarketLogic
    error ZeroAddressInput();
    error InvalidExpirationTime(uint256 expirationTime, uint256 currentTime);
    error InvalidPriceThreshold();
    error InvalidPoolKey();
    error InvalidAssetSymbol();
    error AmountCannotBeZero(); // Can be emitted by PM or bubbled from MarketLogic
    error StakeBelowMinimum(uint256 sentAmount, uint256 minRequiredAmount); // Bubbled from MarketLogic
    error NotWinningNFT(); // Bubbled from MarketLogic
    error ClaimFailedNoStakeForOutcome(); // Bubbled from MarketLogic
    error RewardTransferFailed(); // Bubbled from MarketLogic
    error FeeTransferFailed(); // Bubbled from MarketLogic
    error NotRewardDistributor();
    error InvalidMarketId();
    error NotOracleResolver();
    error PriceOracleStale(); // Bubbled from MarketLogic
    error ResolutionFailedOracleError(); // If oracle call fails in PM
    error InvalidUpkeepData(string reason);
    error StakeMismatch(uint256 actual, uint256 declared);
    error EmptyMarketName();

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
    function recordPrediction(
        address _user,
        uint256 _marketId,
        PredictionTypes.Outcome _outcome,
        uint128 _convictionStakeDeclared
    ) external payable override {
        // Cache storage variables in memory
        uint256 feeBasis = protocolFeeBasisPoints;
        uint256 stakeAmount = uint256(_convictionStakeDeclared);

        if (_user == address(0)) revert ZeroAddressInput();
        if (stakeAmount == 0) revert AmountCannotBeZero();

        // Calculate fee and expected value using cached values
        uint256 fee = (stakeAmount * feeBasis) / MAX_BASIS_POINTS;
        uint256 expectedValue = stakeAmount + fee; // No overflow check needed due to previous checks

        if (msg.value != expectedValue) {
            revert StakeMismatch(msg.value, expectedValue);
        }

        // Cache market in memory
        Market storage market = markets[_marketId];
        if (!market.exists) revert MarketDoesNotExist(_marketId);

        // Get market-specific min stake, defaulting to global min if not set
        uint256 minStake = marketMinStakes[_marketId];
        if (minStake == 0) {
            minStake = minStakeAmount;
        }

        // Call library function
        (uint256 stakeAmountNet, uint256 protocolFee) = market.recordPrediction(
            _user, _outcome, _convictionStakeDeclared, swapCastNFT, treasuryAddress, feeBasis, minStake
        );

        // Emit events
        if (protocolFee > 0) {
            emit FeePaid(_marketId, _user, protocolFee);
        }
        emit StakeRecorded(_marketId, _user, _outcome, stakeAmountNet);
    }

    // --- Market Resolution (IPredictionManagerForResolver Implementation) ---
    /**
     * @notice Called by OracleResolver to submit resolution data for a market.
     *         This function then calls the internal logic to finalize resolution.
     * @param _marketId The ID of the market to resolve.
     * @param _winningOutcome The winning outcome determined by the oracle.
     * @param _oraclePrice The price reported by the oracle.
     */
    function resolveMarket(uint256 _marketId, PredictionTypes.Outcome _winningOutcome, int256 _oraclePrice)
        external
        virtual
        override
        onlyOracleResolverContract
    {
        Market storage market = markets[_marketId];
        if (!market.exists) revert MarketDoesNotExist(_marketId);
        // MarketLogic.resolve will check if already resolved

        uint256 totalPrizePool = market.resolve(_winningOutcome, _oraclePrice);
        emit MarketResolved(_marketId, _winningOutcome, _oraclePrice, totalPrizePool);
    }

    // --- Reward Claiming (IPredictionManagerForDistributor Implementation) ---
    /**
     * @notice Called by RewardDistributor to process a reward claim for an NFT.
     * @param _tokenId The ID of the SwapCastNFT.
     */
    function claimReward(uint256 _tokenId) external virtual override onlyRewardDistributorContract {
        // RewardDistributor is responsible for calling swapCastNFT.getPredictionDetails first
        // and passing those details to this contract, or this contract fetches them.
        // For simplicity with MarketLogic, let's assume RD passes them or we fetch here.

        (uint256 marketIdNFT, PredictionTypes.Outcome predictionOutcome, uint256 userConvictionStake, address nftOwner)
        = swapCastNFT.getPredictionDetails(_tokenId);

        Market storage market = markets[marketIdNFT];
        if (!market.exists) revert MarketDoesNotExist(marketIdNFT);
        // MarketLogic.claimReward will check resolved, winning NFT, etc.

        uint256 rewardAmount =
            market.claimReward(_tokenId, predictionOutcome, userConvictionStake, nftOwner, swapCastNFT);

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

    // --- Log Automation Logic (ILogAutomation) ---
    function checkLog(
        Log calldata _log,
        bytes calldata /*_checkData*/ // Implements ILogAutomation
    ) external view override returns (bool upkeepNeeded, bytes memory performData) {
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
     *         Called by performUpkeep (log-based path).
     * @param _marketId The ID of the market to resolve.
     */
    function _triggerMarketResolution(uint256 _marketId) internal {
        Market storage market = markets[_marketId];
        if (!market.exists || market.resolved || market.priceAggregator == address(0)) {
            return; // Already handled or not resolvable
        }

        // Check if actually expired, though log trigger from MarketExpired implies it
        if (block.timestamp < market.expirationTime) {
            return; // Not yet expired, should not happen if MarketExpired was emitted correctly
        }

        // Call the library function. If it reverts (e.g., PriceOracleStale), this function will revert.
        (PredictionTypes.Outcome outcome, int256 price) = market.getOutcomeFromOracle(maxPriceStalenessSeconds);

        // Assuming direct resolution for now. If OracleResolver is involved, this logic might change.
        // The call to market.resolve() itself can also revert if conditions are not met (e.g. already resolved).
        uint256 totalPrizePool = market.resolve(outcome, price);
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
