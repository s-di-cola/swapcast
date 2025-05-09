// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

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
     */
    error OracleAlreadyRegistered(uint256 marketId);
    /**
     * @notice Reverts if an attempt is made to resolve a market that doesn't have a registered oracle.
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
     */
    error ResolutionFailedInManager(uint256 marketId);
    /**
     * @notice Reverts if the Chainlink price feed data is older than `maxPriceStalenessSeconds`.
     */
    error PriceIsStale(uint256 marketId, uint256 lastUpdatedAt, uint256 currentBlockTimestamp);

    /**
     * @notice Constructs a new OracleResolver instance.
     * @param _predictionManagerAddress The address of the PredictionManager contract this resolver will interact with.
     * @param _feedRegistryAddress The address of the Chainlink Feed Registry contract.
     * @param initialOwner The address that will be set as the initial owner of this contract.
     */
    constructor(address _predictionManagerAddress, address _feedRegistryAddress, address initialOwner) {
        if (_predictionManagerAddress == address(0)) revert PredictionManagerZeroAddress();
        if (_feedRegistryAddress == address(0)) revert InvalidTokenAddress();

        predictionManager = IPredictionManagerForResolver(_predictionManagerAddress);
        feedRegistry = IFeedRegistry(_feedRegistryAddress);

        // Default to 1 hour (3600 seconds) staleness check
        maxPriceStalenessSeconds = 3600;

        _transferOwnership(initialOwner);
    }

    /**
     * @notice Registers an oracle for a market using token pair from the Feed Registry.
     * @dev Only callable by the contract owner. Emits {OracleRegistered}.
     * @param _marketId The ID of the market to register the oracle for.
     * @param _baseToken The base token address (e.g., ETH).
     * @param _quoteToken The quote token address (e.g., USD).
     * @param _priceThreshold The price threshold for determining the winning outcome.
     */
    function registerOracle(uint256 _marketId, address _baseToken, address _quoteToken, uint256 _priceThreshold)
        external
        onlyOwner
    {
        if (marketOracles[_marketId].isRegistered) revert OracleAlreadyRegistered(_marketId);
        if (_baseToken == address(0) || _quoteToken == address(0)) revert InvalidTokenAddress();

        // Verify the feed exists by attempting to get the feed address
        feedRegistry.getFeed(_baseToken, _quoteToken);

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
     *      Calls `PredictionManager.resolveMarket()` to finalize the resolution.
     *      Emits {MarketResolved} on successful resolution via the PredictionManager.
     *      Reverts with {OracleNotRegistered} if no oracle is set for the market,
     *      or {ResolutionFailedInManager} if the call to PredictionManager fails.
     * @param _marketId The ID of the market to resolve.
     */
    function resolveMarket(uint256 _marketId) external {
        MarketOracle storage mo = marketOracles[_marketId];
        if (!mo.isRegistered) revert OracleNotRegistered(_marketId);

        // Fetch the latest price from the Chainlink Feed Registry
        (, int256 price,, uint256 lastUpdatedAt,) = feedRegistry.latestRoundData(mo.baseToken, mo.quoteToken);

        if (block.timestamp - lastUpdatedAt > maxPriceStalenessSeconds) {
            revert PriceIsStale(_marketId, lastUpdatedAt, block.timestamp);
        }

        PredictionTypes.Outcome winningOutcome;
        // Note: Chainlink prices can be negative for certain data types, but for typical asset prices,
        // they are positive. Casting `price` (int256) to `uint256` is safe if positive prices are expected.
        // `priceThreshold` is uint256, implying positive comparison values.
        if (uint256(price) >= mo.priceThreshold) {
            winningOutcome = PredictionTypes.Outcome.Bullish; // e.g., Price will be AT or ABOVE X
        } else {
            winningOutcome = PredictionTypes.Outcome.Bearish; // e.g., Price will be BELOW X
        }

        try predictionManager.resolveMarket(_marketId, winningOutcome, price) {
            // Emitting MarketResolved here indicates this OracleResolver initiated and observed successful pool resolution.
            // PredictionManager might emit its own event as well (e.g., IPredictionManagerForResolver.MarketResolved).
            emit MarketResolved(_marketId, price, winningOutcome);
        } catch {
            revert ResolutionFailedInManager(_marketId);
        }
    }
}
