// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IPredictionPoolForResolver} from "./interfaces/IPredictionPoolForResolver.sol";
import {AggregatorV3Interface} from "@chainlink/contracts/v0.8/interfaces/AggregatorV3Interface.sol";

/**
 * @title OracleResolver
 * @author SwapCast Team (Please update with actual author/team name)
 * @notice This contract is responsible for resolving prediction markets by fetching prices from Chainlink oracles.
 * @dev It allows the owner to register Chainlink price feed aggregators for specific market IDs and price thresholds.
 *      Anyone can then trigger the resolution of a registered market. Upon resolution, it calls the PredictionPool
 *      to update the market's state with the winning outcome. The PredictionPool address is set immutably at deployment.
 */
contract OracleResolver is Ownable {
    /**
     * @notice The address of the PredictionPool contract this resolver interacts with.
     * @dev This address is set immutably during contract deployment to prevent changes.
     *      It must implement the {IPredictionPoolForResolver} interface.
     */
    IPredictionPoolForResolver public immutable predictionPool;

    /**
     * @notice Represents the oracle configuration for a specific market.
     * @param aggregator The address of the Chainlink price feed aggregator for this market.
     * @param priceThreshold The price level that determines the winning outcome. If the oracle price is at or above this threshold,
     *                       outcome 0 wins; otherwise, outcome 1 wins.
     * @param isRegistered A flag indicating whether an oracle has been registered for this market ID.
     */
    struct MarketOracle {
        address aggregator; // Chainlink price feed address
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
     * @param aggregator The address of the Chainlink price feed aggregator.
     * @param priceThreshold The price threshold set for this market's resolution.
     */
    event OracleRegistered(uint256 indexed marketId, address indexed aggregator, uint256 priceThreshold);

    /**
     * @notice Emitted when a market is successfully resolved by this contract.
     * @param marketId The ID of the market that was resolved.
     * @param price The price reported by the oracle at the time of resolution.
     * @param winningOutcome The determined winning outcome (0 or 1).
     */
    event MarketResolved(uint256 indexed marketId, int256 price, uint8 winningOutcome);

    /**
     * @notice Emitted when the `maxPriceStalenessSeconds` value is updated by the owner.
     */
    event MaxPriceStalenessSet(uint256 oldStalenessSeconds, uint256 newStalenessSeconds);

    /**
     * @notice Reverts if an attempt is made to resolve a market for which no oracle is registered.
     */
    error OracleNotRegistered(uint256 marketId);
    /**
     * @notice Reverts if an attempt is made to register an oracle for a market that already has one registered.
     */
    error OracleAlreadyRegistered(uint256 marketId);
    /**
     * @notice Reverts if an attempt is made to register an oracle with a zero address for the aggregator.
     */
    error InvalidAggregatorAddress();
    /**
     * @notice Reverts if the PredictionPool address provided during construction is the zero address.
     */
    error PredictionPoolZeroAddress();
    /**
     * @notice Reverts if the call to `PredictionPool.resolveMarket()` fails during market resolution.
     */
    error ResolutionFailedInPool(uint256 marketId);
    /**
     * @notice Reverts if the Chainlink price feed data is older than `maxPriceStalenessSeconds`.
     */
    error PriceIsStale(uint256 marketId, uint256 lastUpdatedAt, uint256 currentBlockTimestamp);

    /**
     * @notice Contract constructor.
     * @param _predictionPoolAddress The address of the PredictionPool contract. Must not be the zero address.
     *                               This address is stored immutably.
     * @param initialOwner The initial owner of this OracleResolver contract.
     */
    constructor(address _predictionPoolAddress, address initialOwner) Ownable(initialOwner) {
        if (_predictionPoolAddress == address(0)) revert PredictionPoolZeroAddress();
        predictionPool = IPredictionPoolForResolver(_predictionPoolAddress);
        maxPriceStalenessSeconds = 3600; // Default to 1 hour
        emit MaxPriceStalenessSet(0, maxPriceStalenessSeconds);
    }

    /**
     * @notice Registers a Chainlink oracle for a specific market, defining its price feed and resolution threshold.
     * @dev Only callable by the contract owner. Emits {OracleRegistered}.
     *      The market must not have an oracle already registered, and the aggregator address must not be zero.
     * @param _marketId The ID of the market to register the oracle for.
     * @param _aggregator The address of the Chainlink price feed aggregator (e.g., ETH/USD feed).
     * @param _priceThreshold The price threshold. If the oracle reports a price at or above this value,
     *                        outcome 0 is considered the winner; otherwise, outcome 1 wins.
     */
    function registerOracle(uint256 _marketId, address _aggregator, uint256 _priceThreshold) external onlyOwner {
        if (marketOracles[_marketId].isRegistered) revert OracleAlreadyRegistered(_marketId);
        if (_aggregator == address(0)) revert InvalidAggregatorAddress();

        marketOracles[_marketId] =
            MarketOracle({aggregator: _aggregator, priceThreshold: _priceThreshold, isRegistered: true});

        emit OracleRegistered(_marketId, _aggregator, _priceThreshold);
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
     * @notice Resolves a prediction market using its registered Chainlink oracle.
     * @dev This function can be called by anyone. It fetches the latest price from the specified Chainlink aggregator.
     *      Outcome 0 is declared winner if `oracle_price >= priceThreshold`.
     *      Outcome 1 is declared winner if `oracle_price < priceThreshold`.
     *      Calls `PredictionPool.resolveMarket()` to finalize the resolution.
     *      Emits {MarketResolved} on successful resolution via the PredictionPool.
     *      Reverts with {OracleNotRegistered} if no oracle is set for the market,
     *      or {ResolutionFailedInPool} if the call to PredictionPool fails.
     * @param _marketId The ID of the market to resolve.
     */
    function resolveMarket(uint256 _marketId) external {
        MarketOracle storage mo = marketOracles[_marketId];
        if (!mo.isRegistered) revert OracleNotRegistered(_marketId);

        // Fetch the latest price from the Chainlink oracle
        (, int256 price,, uint256 lastUpdatedAt,) = AggregatorV3Interface(mo.aggregator).latestRoundData();

        if (block.timestamp - lastUpdatedAt > maxPriceStalenessSeconds) {
            revert PriceIsStale(_marketId, lastUpdatedAt, block.timestamp);
        }

        uint8 winningOutcome;
        // Note: Chainlink prices can be negative for certain data types, but for typical asset prices,
        // they are positive. Casting `price` (int256) to `uint256` is safe if positive prices are expected.
        // `priceThreshold` is uint256, implying positive comparison values.
        if (uint256(price) >= mo.priceThreshold) {
            winningOutcome = 0; // e.g., Price will be AT or ABOVE X
        } else {
            winningOutcome = 1; // e.g., Price will be BELOW X
        }

        try predictionPool.resolveMarket(_marketId, winningOutcome, price) {
            // Emitting MarketResolved here indicates this OracleResolver initiated and observed successful pool resolution.
            // PredictionPool might emit its own event as well (e.g., IPredictionPoolForResolver.MarketResolved).
            emit MarketResolved(_marketId, price, winningOutcome);
        } catch {
            revert ResolutionFailedInPool(_marketId);
        }
    }
}
