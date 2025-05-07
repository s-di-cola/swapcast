// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title RewardDistributor
 * @notice Handles reward claims and verification for winning prediction positions. Emits events for all state changes and uses custom errors for strict security.
 * @dev Only NFT holders can claim rewards.
 */
import {PredictionPool} from "./PredictionPool.sol";
import {SwapCastNFT} from "./SwapCastNFT.sol";

contract RewardDistributor {
    PredictionPool public predictionPool;
    SwapCastNFT public nft;
    address public owner;
    mapping(uint256 => bool) public claimed;

    event RewardClaimed(address indexed user, uint256 indexed tokenId, uint256 amount);

    constructor(address _predictionPool, address _nft) {
        predictionPool = PredictionPool(_predictionPool);
        nft = SwapCastNFT(_nft);
        owner = msg.sender;
    }

    /// @notice Claim reward for a winning NFT
    /// @param tokenId The NFT tokenId
    /**
     * @notice Claim reward for a winning NFT
     * @param tokenId The NFT tokenId
     */
    function claim(uint256 tokenId) external {
        require(msg.sender != address(0), "Zero address");
        require(nft.ownerOf(tokenId) == msg.sender, "Not NFT holder");
        require(!claimed[tokenId], "Already claimed");
        SwapCastNFT.Metadata memory meta = nft.tokenMetadata(tokenId);
        uint256 marketId = meta.marketId;
        uint8 outcome = meta.outcome;
        uint256 conviction = meta.conviction;
        PredictionPool.Market memory market = predictionPool.markets(marketId);
        bool resolved = market.resolved;
        uint8 winningOutcome = market.outcome;
        require(resolved, "Market not resolved");
        require(winningOutcome == outcome, "Not winning outcome");
        claimed[tokenId] = true;
        uint256 reward = conviction * 1e15; // Example: 0.001 ETH per conviction unit
        (bool sent, ) = msg.sender.call{value: reward}("");
        require(sent, "Reward transfer failed");
        emit RewardClaimed(msg.sender, tokenId, reward);
    }

    receive() external payable {}
}
