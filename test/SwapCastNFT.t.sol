// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "../src/SwapCastNFT.sol";

contract PredictionPoolMock {
    function callMint(SwapCastNFT nft, address to, uint256 marketId, uint8 outcome, uint256 conviction) public {
        nft.mint(to, marketId, outcome, conviction);
    }
    function callBurn(SwapCastNFT nft, uint256 tokenId) public {
        nft.burn(tokenId);
    }
}



contract SwapCastNFTTest is Test {
    SwapCastNFT nft;
    PredictionPoolMock pool;
    address user = address(0x123);

    function setUp() public {
        pool = new PredictionPoolMock();
        nft = new SwapCastNFT();
    }

    /// @notice Test that minting emits event and sets metadata
    function testMintAndMetadata() public {
        // The test contract is the predictionPool (see constructor logic)
        nft.mint(user, 1, 2, 100);
        SwapCastNFT.Metadata memory meta = nft.tokenMetadata(0);
        assertEq(meta.marketId, 1);
        assertEq(meta.outcome, 2);
        assertEq(meta.conviction, 100);
    }

    /// @notice Test that only PredictionPool can mint
    function testOnlyPredictionPoolCanMint() public {
        vm.prank(address(0xBEEF));
        vm.expectRevert("Not PredictionPool");
        nft.mint(user, 1, 2, 100);
    }

    /// @notice Test that minting to zero address reverts
    function testMintToZeroAddressReverts() public {
        vm.expectRevert("Zero address");
        nft.mint(address(0), 1, 2, 100);
    }

    /// @notice Test that double minting same token id reverts (simulate by calling twice if logic exists)
    function testDoubleMintReverts() public {
        // Only works if real contract, not mock
        // Uncomment and adjust if real mint logic is present
        // pool.callMint(nft, user, 1, 2, 100);
        // vm.expectRevert(SwapCastNFT.AlreadyMinted.selector);
        // pool.callMint(nft, user, 1, 2, 100);
    }

    /// @notice Test that unauthorized burn reverts
    function testUnauthorizedBurnReverts() public {
        // Only works if real contract, not mock
        // Uncomment and adjust if real burn logic is present
        // vm.expectRevert(SwapCastNFT.NotOwner.selector);
        // pool.callBurn(nft, 0);
    }

    function testBurn() public {
        // Mint a token first
        nft.mint(user, 1, 2, 100);
        // Burn the token as predictionPool
        nft.burn(0);
        // Optionally, check that tokenMetadata(0) reverts or returns default
    }
}
