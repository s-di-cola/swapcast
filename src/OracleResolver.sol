// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IPredictionManagerForResolver} from "./interfaces/IPredictionManagerForResolver.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/v0.8/interfaces/AggregatorV3Interface.sol";
import {IFeedRegistry} from "./interfaces/IFeedRegistry.sol";
import {PredictionTypes} from "./types/PredictionTypes.sol";

/**
 * @title OracleResolver
 * @author Simone Di Cola
 * @notice This contract is responsible for resolving prediction markets by fetching prices from Chainlink oracles.
 * @dev It allows the owner to register Chainlink price feed aggregators for specific market IDs and price thresholds.
 *      Anyone can then trigger the resolution of a registered market. Upon resolution, it calls the PredictionManager
 *      to update the market's state with the winning outcome. The PredictionManager address is set immutably at deployment.
 *
 * @dev Price feeds are expected to return values with 8 decimal places, which is the standard for most Chainlink feeds.
 *      The contract validates the integrity of the price feed data before using it for market resolution.
 * @custom:security-contact security@swapcast.xyz
 */
contract OracleResolver is Ownable {
    /**
     * @notice The address of the PredictionManager contract this resolver interacts with.
     * @dev This address is set immutably during contract deployment to prevent changes.
     *      It must implement the {IPredictionManagerForResolver} interface.
     */
    IPredictionManagerForResolver public immutable predictionManager;

    /**
     * @notice The address of the Chainlink Feed Registry contract.
     * @dev This is set immutably during contract deployment.
     */
    IFeedRegistry public immutable feedRegistry;

    /**
     * @notice Represents the oracle configuration for a specific market.
     * @param baseToken The base token address (e.g., ETH)
     * @param quoteToken The quote token address (e.g., USD)
     * @param priceThreshold The price level that determines the winning outcome. If the oracle price is at or above this threshold,
     *                       outcome 0 wins; otherwise, outcome 1 wins.
     * @param isRegistered A flag indicating whether an oracle has been registered for this market ID.
     */
    struct MarketOracle {
        address baseToken; // Base token address
        address quoteToken; // Quote token address
        uint256 priceThreshold; // Price at or above which outcome 0 is winning
        bool isRegistered;
    }

    /**
     * @notice Maps market IDs to their respective oracle configurations.
     * @dev Public visibility allows anyone to query the oracle configuration for a given market.
     */
    mapping(uint256 => MarketOracle) public marketOracles;

    /**
     * @notice Maximum acceptable delay (in seconds) for a Chainlink price feed update.
     * @dev If a price feed's `updatedAt` timestamp is older than `block.timestamp - maxPriceStalenessSeconds`,
     *      the price is considered stale, and market resolution will be prevented.
     *      Defaulted to 1 hour, settable by the owner.
     */
    uint256 public maxPriceStalenessSeconds;

    /**
     * @notice Emitted when a new oracle is registered for a market.
     * @param marketId The ID of the market for which the oracle is registered.
     * @param baseToken The base token address.
     * @param quoteToken The quote token address.
     * @param priceThreshold The price threshold set for this market's resolution.
     */
    event OracleRegistered(uint256 indexed marketId, address baseToken, address quoteToken, uint256 priceThreshold);

    /**
     * @notice Emitted when a market is successfully resolved by this contract.
     * @param marketId The ID of the market that was resolved.
     * @param price The price reported by the oracle at the time of resolution.
     * @param winningOutcome The determined winning outcome (0 or 1).
     */
    event MarketResolved(uint256 indexed marketId, int256 price, PredictionTypes.Outcome winningOutcome);

    /**
     * @notice Emitted when the `maxPriceStalenessSeconds` value is updated by the owner.
     */
    event MaxPriceStalenessSet(uint256 oldStaleness, uint256 newStaleness);

    /**
     * @notice Reverts if an attempt is made to register an oracle for a market that already has one registered.
     * @param marketId The ID of the market for which registration was attempted.
     */
    error OracleAlreadyRegistered(uint256 marketId);

    /**
     * @notice Reverts if an attempt is made to resolve a market that doesn't have a registered oracle.
     * @param marketId The ID of the market for which resolution was attempted.
     */
    error OracleNotRegistered(uint256 marketId);

    /**
     * @notice Reverts if an attempt is made to register an oracle with a zero address for the token.
     */
    error InvalidTokenAddress();

    /**
     * @notice Reverts if the PredictionManager address provided during construction is the zero address.
     */
    error PredictionManagerZeroAddress();

    /**
     * @notice Reverts if the call to `PredictionManager.resolveMarket()` fails during market resolution.
     * @param marketId The ID of the market for which resolution failed.
     */
    error ResolutionFailedInManager(uint256 marketId);

    /**
     * @notice Reverts if the Chainlink price feed data is older than `maxPriceStalenessSeconds`.
     * @param marketId The ID of the market being resolved.
     * @param lastUpdatedAt The timestamp when the price feed was last updated.
     * @param currentBlockTimestamp The current block timestamp.
     */
    error PriceIsStale(uint256 marketId, uint256 lastUpdatedAt, uint256 currentBlockTimestamp);

    /**
     * @notice Reverts if the price feed returns an invalid round ID.
     * @dev This occurs when the roundId returned by the Chainlink oracle is 0, which indicates an invalid round.
     */
    error InvalidRound();

    /**
     * @notice Reverts if the price feed returns a stale round.
     * @dev This occurs when the answeredInRound value is less than the roundId, indicating the round data is stale.
     */
    error StaleRound();

    /**
     * @notice Reverts if the price feed returns an invalid price (zero or negative).
     * @dev Chainlink prices should always be positive for asset prices. A zero or negative value indicates an error.
     */
    error InvalidPrice();

    /**
     * @notice Reverts if the price threshold is set to zero.
     * @dev A price threshold of zero is invalid as it cannot be used to determine a winning outcome.
     */
    error InvalidPriceThreshold();

    /**
     * @notice Reverts if the feed registry returns a zero address for the feed.
     * @dev This occurs when the requested token pair does not have a registered price feed in the Chainlink Feed Registry.
     */
    error FeedRegistryNotSet();

    /**
     * @notice Constructs a new OracleResolver instance.
     * @param _predictionManagerAddress The address of the PredictionManager contract this resolver will interact with.
     * @param _feedRegistryAddress The address of the Chainlink Feed Registry contract.
     * @param initialOwner The address that will be set as the initial owner of this contract.
     * @custom:reverts PredictionManagerZeroAddress If the prediction manager address is zero.
     * @custom:reverts InvalidTokenAddress If the feed registry address is zero.
     */
    constructor(address _predictionManagerAddress, address _feedRegistryAddress, address initialOwner)
        Ownable(initialOwner)
    {
        if (_predictionManagerAddress == address(0)) revert PredictionManagerZeroAddress();
        if (_feedRegistryAddress == address(0)) revert InvalidTokenAddress();

        predictionManager = IPredictionManagerForResolver(_predictionManagerAddress);
        feedRegistry = IFeedRegistry(_feedRegistryAddress);
        maxPriceStalenessSeconds = 3600; // 1 hour default
    }

    /**
     * @notice Registers an oracle for a market using token pair from the Feed Registry.
     * @dev Only callable by the contract owner. Emits {OracleRegistered}.
     * @param _marketId The ID of the market to register the oracle for.
     * @param _baseToken The base token address (e.g., ETH).
     * @param _quoteToken The quote token address (e.g., USD).
     * @param _priceThreshold The price threshold for determining the winning outcome.
     *        Must be greater than zero and is assumed to be in the feed's native decimals (typically 8).
     * @custom:reverts InvalidTokenAddress If either token address is zero
     * @custom:reverts OracleAlreadyRegistered If an oracle is already registered for this market
     * @custom:reverts FeedRegistryNotSet If the feed registry returns a zero address for the feed
     * @custom:reverts InvalidPriceThreshold If the price threshold is set to zero
     */
    function registerOracle(uint256 _marketId, address _baseToken, address _quoteToken, uint256 _priceThreshold)
        external
        onlyOwner
    {
        // Check if oracle is already registered for this market (saves gas by avoiding storage write if it fails)
        if (marketOracles[_marketId].isRegistered) revert OracleAlreadyRegistered(_marketId);

        // Validate input parameters
        if (_baseToken == address(0) || _quoteToken == address(0)) revert InvalidTokenAddress();
        if (_priceThreshold == 0) revert InvalidPriceThreshold();

        // Verify the feed exists by attempting to get the feed address
        address feedAddress = feedRegistry.getFeed(_baseToken, _quoteToken);
        if (feedAddress == address(0)) revert FeedRegistryNotSet();

        // Create the market oracle in a single SSTORE operation
        marketOracles[_marketId] = MarketOracle({
            baseToken: _baseToken,
            quoteToken: _quoteToken,
            priceThreshold: _priceThreshold,
            isRegistered: true
        });

        emit OracleRegistered(_marketId, _baseToken, _quoteToken, _priceThreshold);
    }

    /**
     * @notice Sets the maximum allowed staleness period for oracle price feeds.
     * @dev Only callable by the contract owner. Emits {MaxPriceStalenessSet}.
     *      This value determines how old a price feed update can be before it's considered stale.
     *      A lower value provides more up-to-date prices but may cause more failures during high network congestion.
     *      A higher value allows for more tolerance during network congestion but may use outdated prices.
     * @param _newStalenessSeconds The new staleness period in seconds (e.g., 3600 for 1 hour).
     */
    function setMaxPriceStaleness(uint256 _newStalenessSeconds) external onlyOwner {
        // Cache the old value for the event
        uint256 oldStaleness = maxPriceStalenessSeconds;

        // Update the staleness period
        maxPriceStalenessSeconds = _newStalenessSeconds;

        // Emit event with old and new values
        emit MaxPriceStalenessSet(oldStaleness, _newStalenessSeconds);
    }

    /**
     * @notice Resolves a prediction market using its registered Chainlink oracle.
     * @dev This function can be called by anyone. It fetches the latest price from the specified Chainlink aggregator.
     *      The market outcome is determined as follows:
     *      - Bullish (Outcome 0) wins if `oracle_price >= priceThreshold`.
     *      - Bearish (Outcome 1) wins if `oracle_price < priceThreshold`.
     *
     *      The function performs extensive validation of the price feed data to ensure reliability:
     *      1. Verifies the oracle is registered for the market
     *      2. Checks that the round ID is valid (not zero)
     *      3. Ensures the round is not stale (answeredInRound >= roundId)
     *      4. Validates the price is positive (> 0)
     *      5. Confirms the price data is not too old (within maxPriceStalenessSeconds)
     *
     *      After validation, it calls `PredictionManager.resolveMarket()` to finalize the resolution
     *      and emits a {MarketResolved} event on success.
     *
     * @param _marketId The ID of the market to resolve.
     * @custom:reverts OracleNotRegistered If no oracle is set for the market
     * @custom:reverts InvalidRound If the round ID is invalid (zero)
     * @custom:reverts StaleRound If the round is not the latest (answeredInRound < roundId)
     * @custom:reverts InvalidPrice If the price is zero or negative
     * @custom:reverts PriceIsStale If the price data is too old (beyond maxPriceStalenessSeconds)
     * @custom:reverts ResolutionFailedInManager If the call to PredictionManager fails
     */
    function resolveMarket(uint256 _marketId) external {
        // Load market oracle configuration into memory to save gas on multiple accesses
        MarketOracle storage mo = marketOracles[_marketId];
        if (!mo.isRegistered) revert OracleNotRegistered(_marketId);

        // Cache these values to avoid multiple SLOADs
        address baseToken = mo.baseToken;
        address quoteToken = mo.quoteToken;
        uint256 priceThreshold = mo.priceThreshold;
        uint256 maxStaleness = maxPriceStalenessSeconds;

        // Fetch the latest price from the Chainlink Feed Registry with full validation
        (uint80 roundId, int256 price,, uint256 updatedAt, uint80 answeredInRound) =
            feedRegistry.latestRoundData(baseToken, quoteToken);

        // Validate price feed data with detailed error messages
        if (roundId == 0) revert InvalidRound();
        if (answeredInRound < roundId) revert StaleRound();
        if (price <= 0) revert InvalidPrice();

        // Cache the current timestamp to avoid multiple calls to block.timestamp
        uint256 currentTime = block.timestamp;
        if (currentTime - updatedAt > maxStaleness) {
            revert PriceIsStale(_marketId, updatedAt, currentTime);
        }

        // Determine the winning outcome based on the price threshold
        // Note: Safe to cast price to uint256 after validating it's positive
        // Using direct comparison is more gas efficient than enum comparison
        PredictionTypes.Outcome winningOutcome = uint256(price) >= priceThreshold
            ? PredictionTypes.Outcome.Bullish // Price is AT or ABOVE threshold
            : PredictionTypes.Outcome.Bearish; // Price is BELOW threshold

        // Try to resolve the market and emit event on success, or revert with detailed error
        try predictionManager.resolveMarket(_marketId, winningOutcome, price) {
            emit MarketResolved(_marketId, price, winningOutcome);
        } catch {
            revert ResolutionFailedInManager(_marketId);
        }
    }
}
