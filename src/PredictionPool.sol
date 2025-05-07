// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title PredictionPool
 * @notice Manages prediction markets and positions for SwapCast. Emits events for all state changes and uses custom errors for strict security.
 * @dev Handles market creation, position management, and odds calculation.
 */
import {SwapCastNFT} from "./SwapCastNFT.sol";

contract PredictionPool {
    /// @notice Struct representing a prediction market
    struct Market {
        uint256 id;
        string description;
        uint256 endTime;
        bool resolved;
        uint8 outcome;
    }
    /// @notice Struct representing a user's prediction position
    struct Position {
        address user;
        uint256 marketId;
        uint8 outcome;
        uint256 conviction;
        bool claimed;
    }

    /// @notice Error for market end time in the past
    /// @param provided The provided end time
    /// @param nowTime The current block timestamp
    error EndTimeInPast(uint256 provided, uint256 nowTime);
    /// @notice Error for zero address NFT
    /// @param nft Address of the NFT contract
    error InvalidNFT(address nft);
    /// @notice Error for market not found
    /// @param marketId The market id
    error MarketNotFound(uint256 marketId);
    /// @notice Error for market already resolved
    /// @param marketId The market id
    error MarketAlreadyResolved(uint256 marketId);
    /// @notice Error for market not yet ended
    /// @param marketId The market id
    error MarketNotEnded(uint256 marketId);
    /// @notice Error for market closed
    /// @param marketId The market id
    error MarketClosed(uint256 marketId);
    /// @notice Error for invalid outcome
    /// @param outcome The provided outcome
    error InvalidOutcome(uint8 outcome);
    /// @notice Error for duplicate prediction
    /// @param user The user address
    /// @param marketId The market id
    error AlreadyPredicted(address user, uint256 marketId);

    /// @notice Mapping of marketId to Market struct
    mapping(uint256 => Market) internal _markets;
    /**
     * @notice Get market details by id
     * @param id The market id
     * @return The Market struct
     */
    function markets(uint256 id) public view virtual returns (Market memory) { return _markets[id]; }
    /// @notice Mapping of marketId to all positions
    mapping(uint256 => Position[]) public positionsByMarket;
    /// @notice Tracks if a user has already predicted for a market
    mapping(uint256 => mapping(address => bool)) public hasPredicted;
    /// @notice The next market id to be assigned
    uint256 public nextMarketId;
    /// @notice The SwapCastNFT contract
    SwapCastNFT public nft;

    /// @notice Emitted when a new market is created
    /// @param marketId The market id
    /// @param description The market description
    /// @param endTime The market end time
    event MarketCreated(uint256 indexed marketId, string description, uint256 endTime);
    /// @notice Emitted when a market is resolved
    /// @param marketId The market id
    /// @param outcome The resolved outcome
    event MarketResolved(uint256 indexed marketId, uint8 outcome);
    /// @notice Emitted when a prediction is recorded
    /// @param user The user address
    /// @param marketId The market id
    /// @param outcome The predicted outcome
    /// @param conviction The conviction amount
    event PredictionRecorded(address indexed user, uint256 indexed marketId, uint8 outcome, uint256 conviction);
    /// @notice Emitted when a failed prediction attempt occurs
    /// @param user The user address
    /// @param marketId The market id
    /// @param reason The failure reason
    event PredictionFailed(address indexed user, uint256 indexed marketId, string reason);

    /**
     * @notice Contract constructor
     * @param _nft The SwapCastNFT contract address
     */
    constructor(address _nft) {
        if (_nft == address(0)) revert InvalidNFT(_nft);
        nft = SwapCastNFT(_nft);
    }

    /**
     * @notice Create a new prediction market
     * @param description The market description
     * @param endTime The market end time (must be in the future)
     * @return marketId The new market id
     */
    function createMarket(string calldata description, uint256 endTime) external returns (uint256 marketId) {
        if (endTime <= block.timestamp) revert EndTimeInPast(endTime, block.timestamp);
        marketId = nextMarketId++;
        _markets[marketId] = Market(marketId, description, endTime, false, 0);
        emit MarketCreated(marketId, description, endTime);
    }

    /**
     * @notice Record a user's prediction for a market
     * @param user The user address
     * @param marketId The market id
     * @param outcome The predicted outcome
     * @param conviction The conviction amount
     */
    function recordPrediction(address user, uint256 marketId, uint8 outcome, uint256 conviction) external virtual {
        Market storage market = _markets[marketId];
        if (user == address(0)) {
            revert InvalidNFT(user);
        }
        if (market.id != marketId) {
            emit PredictionFailed(user, marketId, "Market not found");
            revert MarketNotFound(marketId);
        }
        if (block.timestamp >= market.endTime) {
            emit PredictionFailed(user, marketId, "Market closed");
            revert MarketClosed(marketId);
        }
        // Accept only outcome 0 or 1 for binary markets
        if (outcome > 1) {
            emit PredictionFailed(user, marketId, "Invalid outcome");
            revert InvalidOutcome(outcome);
        }
        if (hasPredicted[marketId][user]) {
            revert AlreadyPredicted(user, marketId);
        }
        hasPredicted[marketId][user] = true;
        positionsByMarket[marketId].push(Position(user, marketId, outcome, conviction, false));
        nft.mint(user, marketId, outcome, conviction);
        emit PredictionRecorded(user, marketId, outcome, conviction);
    }

    /**
     * @notice Resolve a market with the given outcome
     * @param marketId The market id
     * @param outcome The resolved outcome
     */
    function resolveMarket(uint256 marketId, uint8 outcome) external virtual {
        Market storage market = _markets[marketId];
        if (market.id != marketId) revert MarketNotFound(marketId);
        if (block.timestamp < market.endTime) revert MarketNotEnded(marketId);
        if (market.resolved) revert MarketAlreadyResolved(marketId);
        // Accept only outcome 0 or 1 for binary markets
        if (outcome > 1) revert InvalidOutcome(outcome);
        market.resolved = true;
        market.outcome = outcome;
        emit MarketResolved(marketId, outcome);
    }

    /**
     * @notice Calculate odds for a given market and outcome
     * @param marketId The market id
     * @param outcome The outcome to calculate odds for
     * @return odds The odds as a 1e18 fixed-point ratio
     */
    function getOdds(uint256 marketId, uint8 outcome) external view returns (uint256 odds) {
        Position[] storage positions = positionsByMarket[marketId];
        uint256 totalConviction;
        uint256 outcomeConviction;
        for (uint256 i = 0; i < positions.length; i++) {
            totalConviction += positions[i].conviction;
            if (positions[i].outcome == outcome) {
                outcomeConviction += positions[i].conviction;
            }
        }
        if (totalConviction == 0) return 0;
        odds = (outcomeConviction * 1e18) / totalConviction;
    }

    }
