// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IPredictionManagerForResolver} from "./interfaces/IPredictionManagerForResolver.sol";
import {IPyth} from "@pythnetwork/pyth-sdk-solidity/IPyth.sol";
import {PythStructs} from "@pythnetwork/pyth-sdk-solidity/PythStructs.sol";
import {PredictionTypes} from "./types/PredictionTypes.sol";

/**
 * @title PythOracleResolver
 * @author SwapCast Team
 * @notice This contract is responsible for resolving prediction markets by fetching prices from Pyth Network oracles.
 * @dev It allows the owner to register Pyth price feed IDs for specific market IDs and price thresholds.
 *      Anyone can then trigger the resolution of a registered market by providing price update data.
 *      Upon resolution, it calls the PredictionManager to update the market's state with the winning outcome.
 *
 * @dev Pyth Network provides real-time price feeds with sub-second latency and is available on many chains
 *      including newer networks like Ink where Chainlink may not be available.
 * @custom:security-contact security@swapcast.xyz
 */
contract PythOracleResolver is Ownable {
    /**
     * @notice The address of the PredictionManager contract this resolver interacts with.
     * @dev This address is set immutably during contract deployment to prevent changes.
     *      It must implement the {IPredictionManagerForResolver} interface.
     */
    IPredictionManagerForResolver public immutable predictionManager;

    /**
     * @notice The address of the Pyth Network contract.
     * @dev This is set immutably during contract deployment.
     */
    IPyth public immutable pyth;

    /**
     * @notice Represents the oracle configuration for a specific market.
     * @param priceId The Pyth price feed ID (32-byte identifier)
     * @param priceThreshold The price level that determines the winning outcome in user-friendly format.
     *                       If the oracle price is at or above this threshold, outcome 0 wins; otherwise, outcome 1 wins.
     * @param expectedExpo The expected exponent from Pyth for this price feed (e.g., -8 for USD pairs)
     * @param isRegistered A flag indicating whether an oracle has been registered for this market ID.
     */
    struct MarketOracle {
        bytes32 priceId; // Pyth price feed ID
        uint256 priceThreshold; // Price threshold in user-friendly format (e.g., 2000 for $2000)
        int32 expectedExpo; // Expected Pyth exponent (e.g., -8 for USD pairs)
        bool isRegistered;
    }

    /**
     * @notice Maps market IDs to their respective oracle configurations.
     * @dev Public visibility allows anyone to query the oracle configuration for a given market.
     */
    mapping(uint256 => MarketOracle) public marketOracles;

    /**
     * @notice Maximum acceptable delay (in seconds) for a Pyth price feed update.
     * @dev If a price feed's timestamp is older than `block.timestamp - maxPriceStalenessSeconds`,
     *      the price is considered stale, and market resolution will be prevented.
     *      Defaulted to 1 hour, settable by the owner.
     */
    uint256 public maxPriceStalenessSeconds;

    /**
     * @notice Emitted when a new oracle is registered for a market.
     * @param marketId The ID of the market for which the oracle is registered.
     * @param priceId The Pyth price feed ID.
     * @param priceThreshold The price threshold set for this market's resolution.
     */
    event OracleRegistered(uint256 indexed marketId, bytes32 priceId, uint256 priceThreshold);

    /**
     * @notice Emitted when a market is successfully resolved by this contract.
     * @param marketId The ID of the market that was resolved.
     * @param price The price reported by the oracle at the time of resolution.
     * @param winningOutcome The determined winning outcome (0 or 1).
     */
    event MarketResolved(uint256 indexed marketId, int64 price, PredictionTypes.Outcome winningOutcome);

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
     * @notice Reverts if the PredictionManager address provided during construction is the zero address.
     */
    error PredictionManagerZeroAddress();

    /**
     * @notice Reverts if the Pyth contract address provided during construction is the zero address.
     */
    error PythContractZeroAddress();

    /**
     * @notice Reverts if the call to `PredictionManager.resolveMarket()` fails during market resolution.
     * @param marketId The ID of the market for which resolution failed.
     */
    error ResolutionFailedInManager(uint256 marketId);

    /**
     * @notice Reverts if the price threshold is set to zero.
     * @dev A price threshold of zero is invalid as it cannot be used to determine a winning outcome.
     */
    error InvalidPriceThreshold();

    /**
     * @notice Reverts if the price feed ID is invalid (zero bytes).
     */
    error InvalidPriceId();

    /**
     * @notice Reverts if the Pyth price feed returns an invalid price.
     */
    error InvalidPrice();

    /**
     * @notice Reverts if insufficient fee is provided for price update.
     */
    error InsufficientUpdateFee(uint256 provided, uint256 required);

    /**
     * @notice Reverts if the price confidence interval is too wide.
     */
    error PriceConfidenceTooLow(uint256 confidence, uint256 price);

    /**
     * @notice Reverts if the price feed's exponent doesn't match the expected exponent.
     */
    error UnexpectedPriceExponent(int32 expected, int32 actual);

    /**
     * @notice Constructs a new PythOracleResolver instance.
     * @param _predictionManagerAddress The address of the PredictionManager contract this resolver will interact with.
     * @param _pythContract The address of the Pyth Network contract.
     * @param initialOwner The address that will be set as the initial owner of this contract.
     * @custom:reverts PredictionManagerZeroAddress If the prediction manager address is zero.
     * @custom:reverts PythContractZeroAddress If the Pyth contract address is zero.
     */
    constructor(address _predictionManagerAddress, address _pythContract, address initialOwner)
        Ownable(initialOwner)
    {
        if (_predictionManagerAddress == address(0)) revert PredictionManagerZeroAddress();
        if (_pythContract == address(0)) revert PythContractZeroAddress();

        predictionManager = IPredictionManagerForResolver(_predictionManagerAddress);
        pyth = IPyth(_pythContract);
        maxPriceStalenessSeconds = 3600; // 1 hour default
    }

    /**
     * @notice Registers an oracle for a market using a Pyth price feed ID.
     * @dev Only callable by the contract owner. Emits {OracleRegistered}.
     * @param _marketId The ID of the market to register the oracle for.
     * @param _priceId The Pyth price feed ID (32-byte identifier).
     * @param _priceThreshold The price threshold for determining the winning outcome in user-friendly format.
     *        Must be greater than zero (e.g., 2000 for $2000).
     * @param _expectedExpo The expected exponent from Pyth for this price feed (e.g., -8 for USD pairs).
     * @custom:reverts InvalidPriceId If the price ID is zero bytes
     * @custom:reverts OracleAlreadyRegistered If an oracle is already registered for this market
     * @custom:reverts InvalidPriceThreshold If the price threshold is set to zero
     */
    function registerOracle(uint256 _marketId, bytes32 _priceId, uint256 _priceThreshold, int32 _expectedExpo)
        external
        onlyOwner
    {
        // Check if oracle is already registered for this market
        if (marketOracles[_marketId].isRegistered) revert OracleAlreadyRegistered(_marketId);

        // Validate input parameters
        if (_priceId == bytes32(0)) revert InvalidPriceId();
        if (_priceThreshold == 0) revert InvalidPriceThreshold();

        // Create the market oracle in a single SSTORE operation
        marketOracles[_marketId] = MarketOracle({
            priceId: _priceId,
            priceThreshold: _priceThreshold,
            expectedExpo: _expectedExpo,
            isRegistered: true
        });

        emit OracleRegistered(_marketId, _priceId, _priceThreshold);
    }

    /**
     * @notice Sets the maximum allowed staleness period for oracle price feeds.
     * @dev Only callable by the contract owner. Emits {MaxPriceStalenessSet}.
     * @param _newStalenessSeconds The new staleness period in seconds (e.g., 3600 for 1 hour).
     */
    function setMaxPriceStaleness(uint256 _newStalenessSeconds) external onlyOwner {
        uint256 oldStaleness = maxPriceStalenessSeconds;
        maxPriceStalenessSeconds = _newStalenessSeconds;
        emit MaxPriceStalenessSet(oldStaleness, _newStalenessSeconds);
    }

    /**
     * @notice Resolves a prediction market using its registered Pyth oracle.
     * @dev This function can be called by anyone with valid price update data.
     *      The market outcome is determined as follows:
     *      - Bullish (Outcome 0) wins if `oracle_price >= priceThreshold`.
     *      - Bearish (Outcome 1) wins if `oracle_price < priceThreshold`.
     *
     *      The function performs validation of the price feed data to ensure reliability:
     *      1. Verifies the oracle is registered for the market
     *      2. Updates the Pyth price feeds with provided data
     *      3. Validates the price is not stale (within maxPriceStalenessSeconds)
     *      4. Confirms the price is valid (confidence interval check)
     *
     *      After validation, it calls `PredictionManager.resolveMarket()` to finalize the resolution
     *      and emits a {MarketResolved} event on success.
     *
     * @param _marketId The ID of the market to resolve.
     * @param priceUpdateData Array of price update data from Pyth Network.
     * @custom:reverts OracleNotRegistered If no oracle is set for the market
     * @custom:reverts InvalidPrice If the price is invalid or has low confidence
     * @custom:reverts PriceIsStale If the price data is too old
     * @custom:reverts ResolutionFailedInManager If the call to PredictionManager fails
     */
    function resolveMarket(uint256 _marketId, bytes[] calldata priceUpdateData) external payable {
        // Load market oracle configuration
        MarketOracle storage mo = marketOracles[_marketId];
        if (!mo.isRegistered) revert OracleNotRegistered(_marketId);

        // Cache values to avoid multiple SLOADs
        bytes32 priceId = mo.priceId;
        uint256 priceThreshold = mo.priceThreshold;
        int32 expectedExpo = mo.expectedExpo;
        uint256 maxStaleness = maxPriceStalenessSeconds;

        // Validate and handle update fee
        uint fee = pyth.getUpdateFee(priceUpdateData);
        if (msg.value < fee) revert InsufficientUpdateFee(msg.value, fee);
        
        pyth.updatePriceFeeds{value: fee}(priceUpdateData);
        
        // Refund excess payment
        if (msg.value > fee) {
            payable(msg.sender).transfer(msg.value - fee);
        }

        // Get the latest price from Pyth with automatic staleness check
        // Use the stricter of maxStaleness or 60 seconds for market resolution
        uint256 maxPriceAge = 60; // 60 seconds max for market resolution
        uint256 effectiveMaxAge = maxStaleness < maxPriceAge ? maxStaleness : maxPriceAge;
        
        PythStructs.Price memory pythPrice = pyth.getPriceNoOlderThan(priceId, effectiveMaxAge);

        // Validate price data
        if (pythPrice.price <= 0) revert InvalidPrice();
        
        // Validate exponent matches expected
        if (pythPrice.expo != expectedExpo) {
            revert UnexpectedPriceExponent(expectedExpo, pythPrice.expo);
        }
        
        // Check price confidence - reject if confidence is more than 1% of price
        uint256 confidenceInterval = pythPrice.conf;
        uint256 priceValue = uint256(uint64(pythPrice.price));
        if (confidenceInterval * 100 > priceValue) {
            revert PriceConfidenceTooLow(confidenceInterval, priceValue);
        }

        // Convert Pyth price to user-friendly format using the expected exponent
        // Since exponent is validated to match expectedExpo, we can safely convert
        uint256 currentPrice;
        if (expectedExpo >= 0) {
            // Positive exponent: multiply by 10^expo
            currentPrice = priceValue * (10 ** uint256(int256(expectedExpo)));
        } else {
            // Negative exponent: divide by 10^(-expo)
            currentPrice = priceValue / (10 ** uint256(-int256(expectedExpo)));
        }

        // Determine the winning outcome based on the price threshold
        PredictionTypes.Outcome winningOutcome = currentPrice >= priceThreshold
            ? PredictionTypes.Outcome.Bullish // Price is AT or ABOVE threshold
            : PredictionTypes.Outcome.Bearish; // Price is BELOW threshold

        // Try to resolve the market and emit event on success
        int256 priceForManager = int256(pythPrice.price);
        try predictionManager.resolveMarket(_marketId, winningOutcome, priceForManager) {
            emit MarketResolved(_marketId, pythPrice.price, winningOutcome);
        } catch {
            revert ResolutionFailedInManager(_marketId);
        }
    }

    /**
     * @notice Get the required fee for updating price feeds.
     * @param priceUpdateData Array of price update data from Pyth Network.
     * @return fee The required fee in wei.
     */
    function getUpdateFee(bytes[] calldata priceUpdateData) external view returns (uint fee) {
        return pyth.getUpdateFee(priceUpdateData);
    }

    /**
     * @notice Get the current price for a given price feed ID.
     * @dev This function will revert if the price is not available or stale.
     * @param priceId The Pyth price feed ID.
     * @return price The current price data.
     */
    function getCurrentPrice(bytes32 priceId) external view returns (PythStructs.Price memory price) {
        return pyth.getPriceUnsafe(priceId);
    }
}
