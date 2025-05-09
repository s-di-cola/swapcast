// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {IPredictionManager} from "./interfaces/IPredictionManager.sol";
import {IPredictionManagerForDistributor} from "./interfaces/IPredictionManagerForDistributor.sol";
import {IPredictionManagerForResolver} from "./interfaces/IPredictionManagerForResolver.sol";
import {ISwapCastNFT} from "./interfaces/ISwapCastNFT.sol";
import {PredictionTypes} from "./types/PredictionTypes.sol";
import {ILogAutomation, Log} from "@chainlink/contracts/v0.8/automation/interfaces/ILogAutomation.sol";
import {AutomationCompatibleInterface} from "@chainlink/contracts/v0.8/automation/AutomationCompatible.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/v0.8/interfaces/AggregatorV3Interface.sol";
import {OracleResolver} from "./OracleResolver.sol";
import {RewardDistributor} from "./RewardDistributor.sol";

/**
 * @title PredictionManager
 * @author Simone Di Cola
 * @notice Manages prediction markets, records user predictions, handles fees, resolves markets,
 *         and allows users to claim rewards based on a pari-mutuel system.
 * @dev Integrates with SwapCastNFT for prediction representation, Treasury for fee collection,
 *      OracleResolver for market resolution, and RewardDistributor for claim processing.
 *      This contract inherits from Ownable for access control on administrative functions,
 *      and IERC721Receiver to potentially receive NFTs if ever needed, though not actively used for receiving.
 *      It implements various interfaces to define its role in the SwapCast ecosystem.
 *      This contract creates and owns the OracleResolver and RewardDistributor instances.
 */
contract PredictionManager is
    IPredictionManager,
    IPredictionManagerForDistributor,
    IPredictionManagerForResolver,
    ILogAutomation,
    AutomationCompatibleInterface,
    Ownable,
    IERC721Receiver
{
    /**
     * @notice The address of the SwapCastNFT contract used for minting and burning prediction NFTs.
     */
    ISwapCastNFT public immutable swapCastNFT;
    /**
     * @notice The address where protocol fees collected from predictions are sent.
     */
    address public treasuryAddress;
    /**
     * @notice The fee charged by the protocol on each prediction, in basis points (e.g., 100 for 1%).
     */
    uint256 public protocolFeeBasisPoints;

    /**
     * @notice The minimum amount of ETH (net of fees) required for a valid prediction stake.
     */
    uint256 public minStakeAmount;

    /**
     * @notice Maximum acceptable delay (in seconds) for a Chainlink price feed update.
     * @dev If a price feed's `updatedAt` timestamp is older than `block.timestamp - maxPriceStalenessSeconds`,
     *      the price is considered stale, and market resolution will be prevented.
     *      Defaulted to 1 hour, settable by the owner.
     */
    uint256 public maxPriceStalenessSeconds = 3600; // Default to 1 hour

    /**
     * @notice For testing: if true, the `recordPrediction` function will revert with `revertMessageOnRecord`.
     */
    bool public shouldRevertOnRecord;
    /**
     * @notice For testing: the message to revert with if `shouldRevertOnRecord` is true.
     */
    string public revertMessageOnRecord;
    bytes4 public customErrorSelectorOnRecord;

    /**
     * @dev Represents a prediction market.
     * @param marketId The unique identifier of the market.
     * @param exists True if the market has been created and configured, false otherwise.
     * @param resolved True if the market has been resolved, false otherwise.
     * @param winningOutcome The outcome that was determined as the winner (0 or 1). Valid only if `resolved` is true.
     * @param totalConvictionStakeOutcome0 The total ETH staked on outcome 0 (e.g., Bearish).
     * @param totalConvictionStakeOutcome1 The total ETH staked on outcome 1 (e.g., Bullish).
     * @param userPredictionCount A mapping to track if a user has already predicted in this market (typically to enforce one prediction per user).
     * @param expirationTime The timestamp when this market expires and should be resolved.
     * @param priceAggregator The Chainlink price feed aggregator address for this market.
     * @param priceThreshold The price threshold for determining the winning outcome.
     */
    struct Market {
        uint256 marketId; // Redundant if key is marketId, but good for clarity if struct is passed around
        bool exists;
        bool resolved;
        PredictionTypes.Outcome winningOutcome;
        uint256 totalConvictionStakeOutcome0; // Bearish outcome
        uint256 totalConvictionStakeOutcome1; // Bullish outcome
        mapping(address => uint256) userPredictionCount; // Value could be 1 if predicted, or the stake amount if needed elsewhere.
        uint256 expirationTime; // When the market expires and should be resolved
        address priceAggregator; // Chainlink price feed address
        uint256 priceThreshold; // Price threshold for determining outcome
    }

    /**
     * @notice Mapping from market ID to Market struct, storing details for each market.
     */
    mapping(uint256 => Market) public markets;

    // --- Events ---
    // Events from interfaces (MarketCreated, MarketResolved, PredictionRecorded, FeePaid, RewardClaimed) are implicitly part of this contract's ABI.

    /**
     * @notice Emitted when a market reaches its expiration time and is ready for resolution.
     * @dev This event is monitored by Chainlink Automation for log-triggered resolution.
     * @param marketId The ID of the market that has expired.
     * @param expirationTime The timestamp when the market expired.
     */
    event MarketExpired(uint256 indexed marketId, uint256 expirationTime);

    /**
     * @notice Emitted when a new market is created by the owner.
     * @param marketId The unique identifier of the newly created market.
     */
    event MarketCreated(uint256 indexed marketId);

    /**
     * @notice Emitted when the fee configuration (treasury address or fee basis points) is updated by the owner.
     * @param newTreasuryAddress The new address for collecting protocol fees.
     * @param newFeeBasisPoints The new fee percentage in basis points.
     */
    event FeeConfigurationChanged(address indexed newTreasuryAddress, uint256 newFeeBasisPoints);

    /**
     * @notice Emitted when the minimum stake amount is changed by the owner.
     * @param newMinStakeAmount The new minimum stake amount required (net of fees).
     */
    event MinStakeAmountChanged(uint256 newMinStakeAmount);

    /**
     * @notice Emitted when a fee is paid by a user during a prediction.
     * @dev This event is defined in the IPredictionManager interface.
     * @param marketId The market ID for which the prediction was made.
     * @param user The address of the user who made the prediction and paid the fee.
     * @param feeAmount The amount of the fee paid.
     */
    event FeePaid(uint256 indexed marketId, address indexed user, uint256 feeAmount);

    /**
     * @notice Emitted when a user's stake is successfully recorded for a prediction.
     * @dev This event is defined in the IPredictionManager interface.
     * @param marketId The market ID for which the prediction was made.
     * @param user The address of the user who made the prediction.
     * @param outcome The predicted outcome (0 or 1).
     * @param stakeAmount The amount of ETH staked as conviction.
     */
    event StakeRecorded(
        uint256 indexed marketId, address indexed user, PredictionTypes.Outcome outcome, uint256 stakeAmount
    );

    /**
     * @notice Emitted when a user successfully claims their reward for a winning prediction.
     * @dev This event is defined in the IPredictionManagerForDistributor interface.
     * @param user The address of the user claiming the reward.
     * @param tokenId The ID of the NFT representing the winning prediction.
     * @param rewardAmount The amount of ETH rewarded.
     */
    event RewardClaimed(address indexed user, uint256 indexed tokenId, uint256 rewardAmount);

    // --- Custom Errors ---

    /**
     * @dev Reverts if an operation is attempted on a market ID that does not correspond to an existing market.
     */
    error MarketDoesNotExist(uint256 marketId);
    /**
     * @dev Reverts if an attempt is made to create a market with an ID that already exists.
     */
    error MarketAlreadyExists(uint256 marketId);
    /**
     * @dev Reverts if an operation (like making a prediction) is attempted on a market that has already been resolved.
     */
    error MarketAlreadyResolved(uint256 marketId);
    /**
     * @dev Reverts if an operation (like claiming a reward) is attempted on a market that has not yet been resolved.
     */
    error MarketNotResolved(uint256 marketId);
    /**
     * @dev Reverts if a user attempts to make more than one prediction in the same market.
     */
    error AlreadyPredicted(uint256 marketId, address user);
    /**
     * @dev Reverts if an invalid outcome (not 0 or 1) is provided.
     */
    error InvalidOutcome(uint8 outcome);
    /**
     * @dev Reverts if an attempt is made to set protocol fee basis points to an invalid value (e.g., >10000).
     */
    error InvalidFeeBasisPoints(uint256 fee);
    /**
     * @dev Reverts if a required address input (e.g., treasury, NFT contract) is the zero address.
     */
    error ZeroAddressInput();
    /**
     * @dev Reverts if an attempt is made to create a market with an invalid expiration time.
     */
    error InvalidExpirationTime();
    /**
     * @dev Reverts if a monetary amount (e.g., stake, fee) that must be positive is zero.
     */
    error AmountCannotBeZero();
    /**
     * @dev Reverts if the stake amount (net of fees) is below the configured minimum stake amount.
     */
    error StakeBelowMinimum(uint256 sentAmount, uint256 minRequiredAmount);
    /**
     * @dev Reverts if an NFT transfer operation fails (though NFT minting/burning is handled by SwapCastNFT).
     */
    error NFTTransferFailed(); // Potentially for future use if PredictionManager directly handles NFTs.
    /**
     * @dev Reverts if a user attempts to claim a reward with an NFT that does not correspond to the winning outcome.
     */
    error NotWinningNFT();
    /**
     * @dev Reverts during reward claim if there was no stake for the winning outcome (should be rare).
     */
    error ClaimFailedNoStakeForOutcome();
    /**
     * @dev Reverts if the transfer of ETH for a reward fails.
     */
    error RewardTransferFailed();
    /**
     * @dev Reverts if a function is called by an address that is not the designated RewardDistributor contract.
     */
    error NotRewardDistributor();
    /**
     * @dev Reverts if an invalid market ID (e.g. 0) is provided.
     */
    error InvalidMarketId();
    /**
     * @dev Reverts if the caller of a function is not the designated OracleResolver contract.
     */
    error NotOracleResolver();

    error PredictionManagerError(string message);

    /**
     * @notice The address of the OracleResolver contract authorized to resolve markets.
     */
    address public oracleResolverAddress;

    /**
     * @notice The address of the RewardDistributor contract authorized to initiate reward claims.
     */
    address public rewardDistributorAddress;

    modifier onlyOracleResolver() {
        if (msg.sender != oracleResolverAddress) revert NotOracleResolver();
        _;
    }

    /**
     * @dev Modifier to restrict a function to be callable only by the `rewardDistributorAddress`.
     *      Reverts with {NotRewardDistributor} if called by any other address.
     */
    modifier onlyRewardDistributor() {
        if (msg.sender != rewardDistributorAddress) {
            revert NotRewardDistributor();
        }
        _;
    }

    /**
     * @notice Contract constructor.
     * @param _swapCastNFTAddress The address of the SwapCastNFT contract used for minting prediction NFTs.
     * @param _treasuryAddress The address where protocol fees are sent.
     * @param _initialFeeBasisPoints The initial fee percentage in basis points (e.g., 100 for 1%).
     * @param _initialOwner The initial owner of this contract.
     * @param _initialMinStakeAmount The initial minimum stake amount required for predictions (net of fees).
     * @param _maxPriceStalenessSeconds The maximum staleness period in seconds for oracle price feeds.
     */
    constructor(
        address _swapCastNFTAddress,
        address _treasuryAddress,
        uint256 _initialFeeBasisPoints,
        address _initialOwner,
        uint256 _initialMinStakeAmount,
        uint256 _maxPriceStalenessSeconds
    ) {
        if (_swapCastNFTAddress == address(0) || _treasuryAddress == address(0)) {
            revert ZeroAddressInput();
        }

        swapCastNFT = ISwapCastNFT(_swapCastNFTAddress);
        treasuryAddress = _treasuryAddress;
        protocolFeeBasisPoints = _initialFeeBasisPoints;
        minStakeAmount = _initialMinStakeAmount;
        maxPriceStalenessSeconds = _maxPriceStalenessSeconds;

        // Create OracleResolver and RewardDistributor instances
        OracleResolver oracleResolver = new OracleResolver(_initialOwner, address(this));
        RewardDistributor rewardDistributor = new RewardDistributor(_initialOwner, address(this));

        // Store their addresses
        oracleResolverAddress = address(oracleResolver);
        rewardDistributorAddress = address(rewardDistributor);

        emit FeeConfigurationChanged(_treasuryAddress, _initialFeeBasisPoints);
        emit MinStakeAmountChanged(_initialMinStakeAmount);

        // Transfer ownership to the initialOwner if it's not the deployer
        if (_initialOwner != msg.sender) {
            transferOwnership(_initialOwner);
        }
    }

    /**
     * @notice Admin function to create/initialize a market structure.
     * @dev Only callable by the contract owner.
     *      Emits a {MarketCreated} event on success.
     * @param _marketId The unique identifier for the new market. Must be non-zero.
     */
    function createMarket(uint256 _marketId) external onlyOwner {
        if (_marketId == 0) revert InvalidMarketId();
        if (markets[_marketId].exists) revert MarketAlreadyExists(_marketId);

        Market storage market = markets[_marketId];
        market.marketId = _marketId;
        market.exists = true;
        market.resolved = false;
        market.winningOutcome = PredictionTypes.Outcome.Bearish; // Default, has no meaning until resolved
        market.totalConvictionStakeOutcome0 = 0;
        market.totalConvictionStakeOutcome1 = 0;
        // userPredictionCount mapping is implicitly initialized

        emit MarketCreated(_marketId);
    }

    /**
     * @notice Creates a market with expiration time and price feed information for automated resolution.
     * @dev Only callable by the contract owner. Emits a {MarketCreated} event on success.
     * @param _marketId The unique identifier for the new market. Must be non-zero.
     * @param _expirationTime The timestamp when this market expires and should be resolved.
     * @param _priceAggregator The Chainlink price feed aggregator address for this market.
     * @param _priceThreshold The price threshold for determining the winning outcome.
     */
    function createMarketWithOracle(
        uint256 _marketId,
        uint256 _expirationTime,
        address _priceAggregator,
        uint256 _priceThreshold
    ) external onlyOwner {
        if (_marketId == 0) revert InvalidMarketId();
        if (markets[_marketId].exists) revert MarketAlreadyExists(_marketId);
        // Allow current timestamp as expiration time for testing purposes
        if (_expirationTime < block.timestamp) revert InvalidExpirationTime();
        if (_priceAggregator == address(0)) revert ZeroAddressInput();

        Market storage market = markets[_marketId];
        market.marketId = _marketId;
        market.exists = true;
        market.resolved = false;
        market.expirationTime = _expirationTime;
        market.priceAggregator = _priceAggregator;
        market.priceThreshold = _priceThreshold;

        emit MarketCreated(_marketId);
    }

    /**
     * @notice Allows the owner to update the treasury address and protocol fee.
     * @dev Only callable by the contract owner.
     *      Emits a {FeeConfigurationChanged} event on success.
     * @param _newTreasuryAddress The new address for collecting protocol fees. Cannot be the zero address.
     * @param _newFeeBasisPoints The new fee percentage in basis points. Cannot exceed 10000 (100%).
     */
    function setFeeConfiguration(address _newTreasuryAddress, uint256 _newFeeBasisPoints) external onlyOwner {
        if (_newTreasuryAddress == address(0)) revert ZeroAddressInput();
        if (_newFeeBasisPoints > 10000) {
            revert InvalidFeeBasisPoints(_newFeeBasisPoints);
        }

        treasuryAddress = _newTreasuryAddress;
        protocolFeeBasisPoints = _newFeeBasisPoints;
        emit FeeConfigurationChanged(_newTreasuryAddress, _newFeeBasisPoints);
    }

    /**
     * @notice Sets the minimum stake amount required for predictions (net of fees).
     * @dev Only callable by the contract owner.
     *      Emits a {MinStakeAmountChanged} event on success.
     * @param _newMinStakeAmount The new minimum stake amount. Can be 0 to disable the minimum stake requirement.
     */
    function setMinStakeAmount(uint256 _newMinStakeAmount) external onlyOwner {
        minStakeAmount = _newMinStakeAmount;
        emit MinStakeAmountChanged(_newMinStakeAmount);
    }

    /**
     * @notice Sets the conditions under which the recordPrediction function should revert for testing.
     * @dev Only callable by the owner.
     * @param _shouldRevert True if recordPrediction should revert, false otherwise.
     * @param _message The message to revert with if _shouldRevert is true.
     */
    function setRevertOnRecordDetails(bool _shouldRevert, string memory _message) external onlyOwner {
        shouldRevertOnRecord = _shouldRevert;
        if (_shouldRevert) {
            revertMessageOnRecord = _message;
            customErrorSelectorOnRecord = bytes4(0); // Ensure we use the string revert
        } else {
            // Optionally reset message if not reverting, or leave as is
            revertMessageOnRecord = "PredictionManager reverted with a custom error."; // Reset to default if reverting is turned off
        }
    }

    /**
     * @inheritdoc IPredictionManager
     * @dev Records a user's prediction for a given market. The user sends ETH (msg.value) covering their
     *      conviction stake plus the protocol fee. An NFT representing this prediction is minted via SwapCastNFT.
     *      Reverts if the market doesn't exist, is already resolved, or if the user has already predicted.
     *      Validates the outcome and that msg.value is sufficient.
     *      Emits {FeePaid} and {StakeRecorded} events (defined in IPredictionManager).
     * @param _user The address of the user making the prediction (can be different from msg.sender if using meta-transactions).
     * @param _marketId The ID of the market to predict on.
     * @param _outcome The predicted outcome (Bearish or Bullish).
     * @param _convictionStakeDeclared The amount of ETH staked as conviction.
     */
    function recordPrediction(
        address _user,
        uint256 _marketId,
        PredictionTypes.Outcome _outcome,
        uint128 _convictionStakeDeclared
    ) external override {
        if (_user == address(0)) revert ZeroAddressInput();
        if (_convictionStakeDeclared == 0) revert AmountCannotBeZero(); // Stake declared in hookData must be non-zero
        // No need to validate outcome range since enum restricts to valid values
        Market storage market = markets[_marketId];
        if (!market.exists) revert MarketDoesNotExist(_marketId);
        if (market.resolved) revert MarketAlreadyResolved(_marketId);
        if (market.userPredictionCount[_user] > 0) {
            revert AlreadyPredicted(_marketId, _user);
        }

        if (shouldRevertOnRecord) {
            if (customErrorSelectorOnRecord != bytes4(0)) {
                // Revert with custom error selector and message
                // This assembly block is a placeholder for how one might encode a custom error with a selector and a string message.
                // Actual implementation would depend on the specific error's ABI encoding.
                bytes memory data = abi.encodeWithSelector(customErrorSelectorOnRecord, revertMessageOnRecord);
                assembly {
                    revert(add(data, 0x20), mload(data))
                }
            } else {
                revert PredictionManagerError(revertMessageOnRecord);
            }
        }

        uint256 totalStakeSent = _convictionStakeDeclared; // Use the stake declared in hookData
        uint256 protocolFee = (totalStakeSent * protocolFeeBasisPoints) / 10000;
        uint256 stakeAmount = totalStakeSent - protocolFee;

        if (stakeAmount == 0) revert AmountCannotBeZero(); // Net stake must be > 0 (handles cases where fee is 100%)
        if (stakeAmount < minStakeAmount) {
            revert StakeBelowMinimum(stakeAmount, minStakeAmount);
        }

        // Send fee to treasury
        if (protocolFee > 0) {
            (bool success,) = payable(treasuryAddress).call{value: protocolFee}("");
            if (!success) revert RewardTransferFailed(); // Re-use or new error FeeTransferFailed
            emit FeePaid(_marketId, _user, protocolFee);
        }

        // Update market state
        market.userPredictionCount[_user] = stakeAmount; // Or simply 1 if not storing stake amount here
        if (_outcome == PredictionTypes.Outcome.Bearish) {
            market.totalConvictionStakeOutcome0 += stakeAmount;
        } else {
            market.totalConvictionStakeOutcome1 += stakeAmount;
        }

        emit StakeRecorded(_marketId, _user, _outcome, stakeAmount);

        // Mint NFT - ISwapCastNFT should handle tokenId generation
        swapCastNFT.mint(_user, _marketId, _outcome, stakeAmount);
    }

    // --- IPredictionManagerForResolver Implementation ---
    /**
     * @inheritdoc IPredictionManagerForResolver
     * @dev Resolves a market with the winning outcome. Typically called by the OracleResolver contract.
     *      This implementation uses the `onlyOracleResolver` modifier.
     *      Emits a {MarketResolved} event (defined in IPredictionManagerForResolver).
     * @param _marketId The ID of the market to resolve.
     * @param _winningOutcome The winning outcome (Bearish or Bullish).
     * @param _oraclePrice The price reported by the oracle at the time of resolution.
     */
    function resolveMarket(uint256 _marketId, PredictionTypes.Outcome _winningOutcome, int256 _oraclePrice)
        external
        virtual
        override
    {
        // Allow calls from OracleResolver or from this contract via performUpkeep
        if (msg.sender != oracleResolverAddress && msg.sender != address(this)) {
            revert NotOracleResolver();
        }

        Market storage market = markets[_marketId];

        if (!market.exists) revert MarketDoesNotExist(_marketId);
        if (market.resolved) revert MarketAlreadyResolved(_marketId);

        market.resolved = true;
        market.winningOutcome = _winningOutcome;

        uint256 totalPrizePool = market.totalConvictionStakeOutcome0 + market.totalConvictionStakeOutcome1;

        emit MarketResolved(_marketId, _winningOutcome, _oraclePrice, totalPrizePool);
    }

    // --- IPredictionManagerForDistributor Implementation ---
    /**
     * @inheritdoc IPredictionManagerForDistributor
     * @dev Allows the designated RewardDistributor contract to claim rewards for a winning prediction NFT.
     *      The RewardDistributor is responsible for verifying NFT ownership before calling this function.
     *      The NFT is burned, and the original NFT owner (retrieved from SwapCastNFT) receives their initial stake
     *      plus a share of the losing pool's stakes.
     *      Reverts if the market is not resolved, if the NFT is not for the winning outcome, or if transfers fail.
     *      Emits a {RewardClaimed} event (defined in IPredictionManagerForDistributor).
     *      This function is restricted by the `onlyRewardDistributor` modifier.
     * @param _tokenId The ID of the SwapCastNFT representing the user's prediction.
     */
    function claimReward(uint256 _tokenId) external virtual override onlyRewardDistributor {
        // Access control: Now restricted to onlyRewardDistributor.
        // The RewardDistributor contract is expected to handle NFT ownership verification prior to calling this.

        (uint256 marketId, PredictionTypes.Outcome predictionOutcome, uint256 userConvictionStake, address nftOwner) =
            swapCastNFT.getPredictionDetails(_tokenId);

        Market storage market = markets[marketId];
        if (!market.resolved) revert MarketNotResolved(marketId);
        if (predictionOutcome != market.winningOutcome) revert NotWinningNFT();
        if (userConvictionStake == 0) revert AmountCannotBeZero(); // Should not happen if prediction was valid

        uint256 rewardAmount = userConvictionStake; // User always gets their stake back if they won.

        if (market.winningOutcome == PredictionTypes.Outcome.Bearish) {
            if (market.totalConvictionStakeOutcome0 == 0) {
                revert ClaimFailedNoStakeForOutcome();
            } // Should not be reachable if user won with Bearish outcome
            if (market.totalConvictionStakeOutcome1 > 0) {
                // Only add from losing pool if it has funds
                uint256 shareOfLosingPool =
                    (userConvictionStake * market.totalConvictionStakeOutcome1) / market.totalConvictionStakeOutcome0;
                rewardAmount += shareOfLosingPool;
            }
        } else {
            // winningOutcome == Bullish
            if (market.totalConvictionStakeOutcome1 == 0) {
                revert ClaimFailedNoStakeForOutcome();
            } // Should not be reachable if user won with Bullish outcome
            if (market.totalConvictionStakeOutcome0 > 0) {
                // Only add from losing pool if it has funds
                uint256 shareOfLosingPool =
                    (userConvictionStake * market.totalConvictionStakeOutcome0) / market.totalConvictionStakeOutcome1;
                rewardAmount += shareOfLosingPool;
            }
        }

        // Burn the NFT. SwapCastNFT.burn is restricted to be called by this PredictionManager contract.
        swapCastNFT.burn(_tokenId);

        if (rewardAmount > 0) {
            // Should always be > 0 if userConvictionStake > 0
            (bool success,) = payable(nftOwner).call{value: rewardAmount}("");
            if (!success) revert RewardTransferFailed();
        }

        // Always emit the event after burning the NFT, regardless of reward amount
        emit RewardClaimed(nftOwner, _tokenId, rewardAmount);
    }

    /**
     * @notice Retrieves details of a specific market.
     * @param _marketId The ID of the market to query.
     * @return marketId_ The ID of the market.
     * @return exists_ True if the market exists.
     * @return resolved_ True if the market has been resolved.
     * @return winningOutcome_ The winning outcome, if resolved.
     * @return totalConvictionStakeOutcome0_ Total stake on outcome 0.
     * @return totalConvictionStakeOutcome1_ Total stake on outcome 1.
     * @return expirationTime_ The timestamp when this market expires.
     * @return priceAggregator_ The Chainlink price feed aggregator address.
     * @return priceThreshold_ The price threshold for determining the outcome.
     */
    function getMarketDetails(uint256 _marketId)
        external
        view
        returns (
            uint256 marketId_,
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

    /**
     * @notice Gets the prediction count (or stake amount, depending on implementation) for a user in a specific market.
     * @param _marketId The ID of the market.
     * @param _user The address of the user.
     * @return The user's prediction count or stake amount. Returns 0 if the user has not predicted or market doesn't exist.
     */
    function getUserPredictionCount(uint256 _marketId, address _user) external view returns (uint256) {
        if (!markets[_marketId].exists) revert MarketDoesNotExist(_marketId);
        return markets[_marketId].userPredictionCount[_user];
    }

    /**
     * @dev See {IERC721Receiver-onERC721Received}.
     *      Always returns `IERC721Receiver.onERC721Received.selector`.
     *      This contract doesn't typically expect to receive NFTs via direct transfer,
     *      but implements the interface for completeness or future use cases.
     */
    function onERC721Received(
        address, // operator - The address which called `safeTransferFrom` (often msg.sender)
        address, // from - The address which previously owned the token
        uint256, // tokenId - The NFT identifier which is being transferred
        bytes calldata // data - Additional data with no specified format
    ) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    /**
     * @notice Checks if a market has expired and needs resolution.
     * @dev Called by Chainlink Automation when a MarketExpired event is detected.
     * @param log The log data containing the MarketExpired event.
     * @return upkeepNeeded Boolean indicating if the market should be resolved.
     * @return performData Encoded data to be used in performUpkeep.
     */
    function checkLog(Log calldata log, bytes memory)
        external
        view
        override
        returns (bool upkeepNeeded, bytes memory performData)
    {
        // Extract marketId from the event's topics (it should be the first indexed parameter)
        uint256 marketId = uint256(log.topics[1]);

        // Check if this market exists and isn't already resolved
        Market storage market = markets[marketId];
        if (!market.exists || market.resolved || market.priceAggregator == address(0)) {
            return (false, "");
        }

        // Market exists, has oracle data, and needs resolution
        upkeepNeeded = true;
        performData = abi.encode(marketId);

        return (upkeepNeeded, performData);
    }

    /**
     * @notice Resolves a market after it has expired.
     * @dev Called by Chainlink Automation after checkLog returns upkeepNeeded=true.
     * @param performData The encoded market ID to be resolved.
     */
    function performUpkeep(bytes calldata performData)
        external
        override(ILogAutomation, AutomationCompatibleInterface)
    {
        // Check if this is time-based or log-based upkeep
        if (performData.length >= 64) {
            // At least enough bytes for a bool and some data
            // Try to decode as time-based upkeep data (bool flag, uint256[] marketIds)
            // We can't use try/catch with abi.decode, so we'll use a different approach
            bool isTimeBased;
            uint256[] memory expiredMarketIds;

            // Use assembly to safely decode without reverting
            bool decodeSuccess;
            assembly {
                // Load the first word (32 bytes) which should contain the boolean
                if gt(calldatasize(), 64) {
                    // Ensure we have enough data
                    // Skip the 4-byte function selector and 32 bytes for the performData pointer
                    let dataPtr := add(performData.offset, 32)
                    isTimeBased := eq(mload(dataPtr), 1) // 1 = true in Solidity
                    decodeSuccess := isTimeBased // Only proceed if isTimeBased is true
                }
            }

            if (decodeSuccess) {
                // Manually decode the uint256[] portion
                (, expiredMarketIds) = abi.decode(performData, (bool, uint256[]));

                // This is time-based upkeep - emit MarketExpired events
                for (uint256 i = 0; i < expiredMarketIds.length; i++) {
                    uint256 expiredMarketId = expiredMarketIds[i];
                    Market storage market = markets[expiredMarketId];

                    // Double-check that the market still needs expiration checking
                    if (
                        market.exists && !market.resolved && market.expirationTime > 0
                            && block.timestamp >= market.expirationTime
                    ) {
                        // Emit the MarketExpired event which will trigger log-based automation
                        emit MarketExpired(expiredMarketId, block.timestamp);
                    }
                }
                return;
            }
        }

        // Default to log-based upkeep (market resolution)
        uint256 marketId = abi.decode(performData, (uint256));
        _resolveMarketWithOracle(marketId);
    }

    /**
     * @notice Checks if a market has expired and emits the MarketExpired event if needed.
     * @dev This function should be called periodically to check for expired markets.
     * @param _marketId The ID of the market to check.
     */
    function checkMarketExpiration(uint256 _marketId) external {
        Market storage market = markets[_marketId];

        if (!market.exists || market.resolved) {
            revert MarketDoesNotExist(_marketId);
        }

        if (market.expirationTime > 0 && block.timestamp >= market.expirationTime) {
            emit MarketExpired(_marketId, block.timestamp);
        }
    }

    /**
     * @notice Sets the maximum allowed staleness period for oracle price feeds.
     * @dev Only callable by the contract owner.
     * @param _newStalenessSeconds The new staleness period in seconds (e.g., 3600 for 1 hour).
     */
    function setMaxPriceStaleness(uint256 _newStalenessSeconds) external onlyOwner {
        maxPriceStalenessSeconds = _newStalenessSeconds;
    }

    /**
     * @notice Checks if any markets need to be checked for expiration.
     * @dev This function is called by Chainlink Automation on a time-based schedule (e.g., hourly).
     *      It scans through markets to find those that have reached their expiration time but haven't
     *      had the MarketExpired event emitted yet.
     * @param checkData Optional data passed by the automation service. Can be used to filter which markets to check.
     * @return upkeepNeeded Boolean indicating if there are markets that need expiration checking.
     * @return performData Encoded data containing the IDs of markets that need checking.
     */
    function checkUpkeep(bytes calldata checkData)
        external
        view
        override(AutomationCompatibleInterface)
        returns (bool upkeepNeeded, bytes memory performData)
    {
        // Parse the check data to determine which markets to scan
        // If no specific data is provided, we'll check all markets
        (uint256 startId, uint256 endId) =
            checkData.length > 0 ? abi.decode(checkData, (uint256, uint256)) : (1, type(uint256).max); // Default to checking all markets

        // Collect market IDs that need expiration checking
        uint256[] memory expiredMarketIds = new uint256[](100); // Limit to 100 markets per upkeep for gas efficiency
        uint256 count = 0;

        // Iterate through markets in the specified range
        for (uint256 i = startId; i <= endId && count < 100; i++) {
            Market storage market = markets[i];

            // Skip if market doesn't exist, is already resolved, or has no expiration time
            if (!market.exists || market.resolved || market.expirationTime == 0) continue;

            // Check if market has expired but hasn't been marked for resolution
            if (block.timestamp >= market.expirationTime) {
                expiredMarketIds[count] = i;
                count++;
            }
        }

        if (count > 0) {
            // Resize the array to the actual number of expired markets
            uint256[] memory result = new uint256[](count);
            for (uint256 i = 0; i < count; i++) {
                result[i] = expiredMarketIds[i];
            }

            // Include a flag to indicate this is for time-based upkeep
            bytes memory timeBasedData = abi.encode(true, result);
            return (true, timeBasedData);
        }

        return (false, "");
    }

    /**
     * @dev Internal function to resolve a market using oracle data.
     * @param marketId The ID of the market to resolve.
     */
    function _resolveMarketWithOracle(uint256 marketId) internal {
        // Get the market data
        Market storage market = markets[marketId];
        if (!market.exists || market.resolved) {
            return; // Safety check
        }

        // Fetch the latest price from the Chainlink oracle
        (, int256 price,, uint256 lastUpdatedAt,) = AggregatorV3Interface(market.priceAggregator).latestRoundData();

        // Check if the price is stale
        if (block.timestamp - lastUpdatedAt > maxPriceStalenessSeconds) {
            return; // Skip resolution if price is stale, will retry later
        }

        // Determine the winning outcome based on the price threshold
        PredictionTypes.Outcome winningOutcome;
        if (uint256(price) >= market.priceThreshold) {
            winningOutcome = PredictionTypes.Outcome.Bearish; // Price is AT or ABOVE threshold
        } else {
            winningOutcome = PredictionTypes.Outcome.Bullish; // Price is BELOW threshold
        }

        // Resolve the market
        this.resolveMarket(marketId, winningOutcome, price);
    }
}
