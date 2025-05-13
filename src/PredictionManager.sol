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
import "forge-std/console.sol";

/**
 * @title PredictionManager Contract
 * @author SwapCast Team
 * @notice Manages the creation and registry of prediction markets. Coordinates with OracleResolver,
 *         RewardDistributor, and SwapCastNFT. Uses MarketLogic library for core market operations.
 *         Integrates with Chainlink Automation for market expiration and resolution.
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

    // --- State Variables ---
    ISwapCastNFT public swapCastNFT;
    address public treasuryAddress;
    uint256 public protocolFeeBasisPoints;
    uint256 public minStakeAmount;
    mapping(uint256 => Market) internal markets;
    uint256[] private _marketIdsList;
    uint256 public maxPriceStalenessSeconds;
    address public oracleResolverAddress; // For permissioning OracleResolver calls
    address public rewardDistributorAddress; // For permissioning RewardDistributor calls

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
    error MarketAlreadyExists(uint256 marketId);
    error MarketDoesNotExist(uint256 marketId);
    error MarketAlreadyResolved(uint256 marketId); // Can be emitted by PM or bubbled from MarketLogic
    error MarketNotResolved(uint256 marketId); // Can be emitted by PM or bubbled from MarketLogic
    error AlreadyPredicted(uint256 marketId, address user); // Can be emitted by PM or bubbled from MarketLogic
    error ZeroAddressInput();
    error InvalidExpirationTime();
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

    // --- Modifiers ---
    modifier onlyOracleResolverContract() {
        // Renamed to avoid clash with MarketLogic's potential name
        if (msg.sender != oracleResolverAddress) revert NotOracleResolver();
        _;
    }

    modifier onlyRewardDistributorContract() {
        // Renamed
        if (msg.sender != rewardDistributorAddress) revert NotRewardDistributor();
        _;
    }

    // --- Constructor ---
    constructor(
        address _swapCastNFTAddress,
        address _treasuryAddress,
        uint256 _initialFeeBasisPoints,
        uint256 _initialMinStakeAmount,
        uint256 _maxPriceStalenessSeconds,
        address _oracleResolverAddress, // Injected
        address _rewardDistributorAddress // Injected
    ) Ownable() {
        if (_swapCastNFTAddress == address(0) || _treasuryAddress == address(0)) {
            revert ZeroAddressInput();
        }
        if (_initialFeeBasisPoints > 10000) {
            revert InvalidFeeBasisPoints(_initialFeeBasisPoints);
        }

        swapCastNFT = ISwapCastNFT(_swapCastNFTAddress);
        treasuryAddress = _treasuryAddress;
        protocolFeeBasisPoints = _initialFeeBasisPoints;
        minStakeAmount = _initialMinStakeAmount;
        maxPriceStalenessSeconds = _maxPriceStalenessSeconds;
        oracleResolverAddress = _oracleResolverAddress;
        rewardDistributorAddress = _rewardDistributorAddress;

        emit FeeConfigurationChanged(_treasuryAddress, _initialFeeBasisPoints);
        emit MinStakeAmountChanged(_initialMinStakeAmount);
    }

    // --- Market Management Functions ---
    function createMarket(
        uint256 _marketId,
        string memory _name,
        string memory _assetSymbol,
        uint256 _expirationTime,
        address _priceAggregator,
        uint256 _priceThreshold
    ) external onlyOwner {
        if (_marketId == 0) revert InvalidMarketId();
        if (markets[_marketId].exists) revert MarketAlreadyExists(_marketId);
        if (_expirationTime <= block.timestamp) revert InvalidExpirationTime();
        if (_priceAggregator == address(0)) revert ZeroAddressInput();
        if (bytes(_name).length == 0) revert PredictionTypes.InvalidMarketName();
        if (bytes(_assetSymbol).length == 0) revert PredictionTypes.InvalidAssetSymbol();

        Market storage market = markets[_marketId];
        market.marketId = _marketId;
        market.name = _name;
        market.assetSymbol = _assetSymbol;
        market.exists = true;
        // market.resolved is false by default
        // market.winningOutcome is PredictionTypes.Outcome.Bearish by default
        market.expirationTime = _expirationTime;
        market.priceAggregator = _priceAggregator;
        market.priceThreshold = _priceThreshold;

        _marketIdsList.push(_marketId);
        emit MarketCreated(_marketId, _name, _assetSymbol, _expirationTime, _priceAggregator, _priceThreshold);
    }

    // --- Fee and Stake Configuration ---
    function setFeeConfiguration(address _newTreasuryAddress, uint256 _newFeeBasisPoints) external onlyOwner {
        if (_newTreasuryAddress == address(0)) revert ZeroAddressInput();
        if (_newFeeBasisPoints > 10000) {
            revert InvalidFeeBasisPoints(_newFeeBasisPoints);
        }
        treasuryAddress = _newTreasuryAddress;
        protocolFeeBasisPoints = _newFeeBasisPoints;
        emit FeeConfigurationChanged(_newTreasuryAddress, _newFeeBasisPoints);
    }

    function setMinStakeAmount(uint256 _newMinStakeAmount) external onlyOwner {
        minStakeAmount = _newMinStakeAmount;
        emit MinStakeAmountChanged(_newMinStakeAmount);
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
        if (_newRewardDistributorAddress == address(0)) revert ZeroAddressInput();
        rewardDistributorAddress = _newRewardDistributorAddress;
        emit RewardDistributorAddressSet(rewardDistributorAddress, _newRewardDistributorAddress);
    }

    // --- Prediction Logic (IPredictionManager Implementation) ---
    function recordPrediction(
        address _user, // Actual staker
        uint256 _marketId,
        PredictionTypes.Outcome _outcome,
        uint128 _convictionStakeDeclared // Amount user intends to stake, from hook/router
    ) external payable override {
        if (_user == address(0)) revert ZeroAddressInput();
        if (_convictionStakeDeclared == 0) revert AmountCannotBeZero();

        uint256 fee = (uint256(_convictionStakeDeclared) * protocolFeeBasisPoints) / 10000;
        uint256 expectedValue = uint256(_convictionStakeDeclared) + fee;

        if (msg.value != expectedValue) {
            revert StakeMismatch(msg.value, expectedValue);
        }

        Market storage market = markets[_marketId];
        if (!market.exists) revert MarketDoesNotExist(_marketId);
        // MarketLogic will handle checks for market resolved, already predicted, amounts, expiration, etc.

        // Call the library function which now does most of the work including fee calculation, fee transfer, and NFT minting.
        (uint256 stakeAmountNet, uint256 protocolFee) = market.recordPrediction(
            _user,
            _outcome,
            _convictionStakeDeclared, // This is effectively msg.value
            swapCastNFT, // Pass the ISwapCastNFT instance directly
            treasuryAddress, // Pass the address for fees
            protocolFeeBasisPoints, // Pass the fee percentage
            minStakeAmount // Pass the minimum stake amount
        );

        // Emit events based on values returned from the library call
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

    // --- Log Automation Logic (ILogAutomation) ---
    function checkLog(Log calldata _log, bytes calldata /*_checkData*/ )
        external
        view
        override // Implements ILogAutomation
        returns (bool upkeepNeeded, bytes memory performData)
    {
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
            console.log("PM: performUpkeep - Action: EmitMarketExpired"); // Log 1
            // Now decode the full structure for EmitMarketExpired
            (, uint256[] memory marketIdsToProcess) = abi.decode(performData, (LogAction, uint256[]));

            console.log("PM: performUpkeep - Num markets to process:", marketIdsToProcess.length); // Log 2

            for (uint256 i = 0; i < marketIdsToProcess.length; i++) {
                uint256 marketIdToEmit = marketIdsToProcess[i];
                console.log("PM: performUpkeep - Processing marketIdToEmit:", marketIdToEmit); // Log 3

                Market storage market = markets[marketIdToEmit]; // Access market struct
                console.log("PM: performUpkeep - Market exists:", market.exists); // Log 4
                console.log("PM: performUpkeep - Market resolved:", market.resolved); // Log 5
                console.log("PM: performUpkeep - Market expirationTime:", market.expirationTime); // Log 6
                console.log("PM: performUpkeep - Current block.timestamp:", block.timestamp); // Log 7

                if (
                    market.exists && !market.resolved && market.expirationTime > 0
                        && market.expirationTime <= block.timestamp
                ) {
                    console.log("PM: performUpkeep - Emitting MarketExpired for market:", marketIdToEmit); // Log 8
                    emit MarketExpired(marketIdToEmit, block.timestamp);
                } else {
                    console.log(
                        "PM: performUpkeep - Conditions not met to emit MarketExpired for market:", marketIdToEmit
                    ); // Log 9
                }
            }
            console.log("PM: performUpkeep - Finished EmitMarketExpired loop"); // Log 10
        } else if (action == LogAction.ResolveMarket) {
            console.log("PM: performUpkeep - Action: ResolveMarket");
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
        override(AutomationCompatibleInterface) // Specify which override if multiple interfaces have it
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
                // Market is expired and needs the event emitted for log-based automation to pick up.
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
    function onERC721Received(address, /*operator*/ address, /*from*/ uint256, /*tokenId*/ bytes calldata /*data*/ )
        external
        pure
        override
        returns (bytes4)
    {
        return IERC721Receiver.onERC721Received.selector;
    }
}
