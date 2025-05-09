// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {SwapCastNFT} from "src/SwapCastNFT.sol";
import {PredictionTypes} from "src/types/PredictionTypes.sol";

contract PredictionPoolMock {
    function callMint(
        SwapCastNFT nft,
        address to,
        uint256 marketId,
        PredictionTypes.Outcome outcome,
        uint256 convictionStake
    ) public {
        nft.mint(to, marketId, outcome, convictionStake);
    }

    function callBurn(SwapCastNFT nft, uint256 tokenId) public {
        nft.burn(tokenId);
    }
}

contract SwapCastNFTTest is Test {
    SwapCastNFT nft;
    PredictionPoolMock pool;
    address user = address(0x123);
    address ownerOfNFTContract; // To store the owner of the NFT contract itself

    function setUp() public {
        pool = new PredictionPoolMock();
        ownerOfNFTContract = address(this); // Test contract owns the NFT contract
        nft = new SwapCastNFT(ownerOfNFTContract, "TestSwapCastNFT", "TSCNFT");
        // Owner of NFT contract sets the prediction pool address
        vm.prank(ownerOfNFTContract);
        nft.setPredictionPoolAddress(address(pool));
    }

    /// @notice Test that minting emits event and sets metadata
    function testMintAndMetadata() public {
        pool.callMint(nft, user, 1, PredictionTypes.Outcome.Bullish, 100);
        (uint256 marketId, PredictionTypes.Outcome outcome, uint256 convictionStake, uint256 mintedAt) =
            nft.tokenPredictionMetadata(0);
        assertEq(marketId, 1, "Market ID mismatch");
        assertEq(uint8(outcome), uint8(PredictionTypes.Outcome.Bullish), "Outcome mismatch");
        assertEq(convictionStake, 100, "Conviction stake mismatch");
        assertTrue(mintedAt > 0, "MintedAt should be set");
    }

    /// @notice Test that only PredictionPool can mint
    function testOnlyPredictionPoolCanMint() public {
        vm.prank(address(0xBEEF)); // Prank as a non-pool address
        vm.expectRevert(SwapCastNFT.NotPredictionPool.selector);
        nft.mint(user, 1, PredictionTypes.Outcome.Bullish, 100);
    }

    /// @notice Test that minting to zero address reverts
    function testMintToZeroAddressReverts() public {
        // Reverts with ERC721InvalidReceiver(address receiver)
        vm.expectRevert(abi.encodeWithSignature("ERC721InvalidReceiver(address)", address(0)));
        pool.callMint(nft, address(0), 1, PredictionTypes.Outcome.Bullish, 100);
    }

    /// @notice Test that unauthorized burn reverts
    function testUnauthorizedBurnReverts() public {
        pool.callMint(nft, user, 1, PredictionTypes.Outcome.Bullish, 100); // Mint a token first
        vm.prank(address(0xBEEF)); // Prank as a non-pool address
        vm.expectRevert(SwapCastNFT.NotPredictionPool.selector);
        nft.burn(0);
    }

    /// @notice Test burning a non-existent token (if it's meant to revert)
    function testBurnNonExistentToken() public {
        // Reverts with ERC721NonexistentToken(uint256 tokenId)
        vm.expectRevert(abi.encodeWithSignature("ERC721NonexistentToken(uint256)", 0));
        pool.callBurn(nft, 0); // Attempt to burn token 0 which doesn't exist yet
    }

    /// @notice Test successful burn by PredictionPool
    function testBurnByPredictionPool() public {
        pool.callMint(nft, user, 1, PredictionTypes.Outcome.Bullish, 100); // Mint token 0
        // No need to approve, prediction pool is authorized implicitly by design
        pool.callBurn(nft, 0); // Burn as predictionPool
        // Check that token is no longer owned / URI reverts
        vm.expectRevert(abi.encodeWithSignature("ERC721NonexistentToken(uint256)", 0));
        nft.ownerOf(0);
    }

    /// @notice Test setting prediction pool address
    function testSetPredictionPoolAddress() public {
        address newPoolAddress = address(0xABCD);
        vm.prank(ownerOfNFTContract);
        vm.expectEmit(true, true, true, true);
        emit SwapCastNFT.PredictionPoolAddressSet(address(pool), newPoolAddress);
        nft.setPredictionPoolAddress(newPoolAddress);
        assertEq(nft.predictionPoolAddress(), newPoolAddress);
    }

    /// @notice Test setting prediction pool address to zero reverts
    function testSetPredictionPoolAddressToZeroReverts() public {
        vm.prank(ownerOfNFTContract);
        vm.expectRevert(SwapCastNFT.ZeroAddress.selector);
        nft.setPredictionPoolAddress(address(0));
    }

    /// @notice Test non-owner cannot set prediction pool address
    function testNonOwnerCannotSetPredictionPoolAddress() public {
        address attacker = address(0xDEAD);
        vm.prank(attacker);
        // Standard Ownable error: OwnableUnauthorizedAccount(address account)
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", attacker));
        nft.setPredictionPoolAddress(address(0xABCD));
    }

    // Test for tokenURI (optional, if you want to ensure it's generated or reverts for non-existent tokens)
    function testTokenURIForNonExistentToken() public {
        // Reverts with our custom NonExistentToken(uint256 tokenId)
        vm.expectRevert(abi.encodeWithSelector(SwapCastNFT.NonExistentToken.selector, 0));
        nft.tokenURI(0);
    }

    /// @notice Test successful tokenURI generation
    function testTokenURISuccess() public {
        string memory expectedPrefix = "data:application/json;base64,";
        uint256 marketId = 77;
        uint256 convictionStake = 1e18;
        uint256 mintTimestamp = 1; // Mock timestamp

        vm.store(address(nft), bytes32(uint256(4)), bytes32(uint256(mintTimestamp))); // Mock block.timestamp for _mintTimestamp
        nft.setPredictionPoolAddress(address(this));
        uint256 tokenId = nft.mint(address(this), marketId, PredictionTypes.Outcome.Bullish, convictionStake); // Mint NFT #0

        string memory uri = nft.tokenURI(tokenId);

        assertTrue(startsWith(uri, expectedPrefix), "URI does not start with expected prefix.");
        assertTrue(bytes(uri).length > bytes(expectedPrefix).length, "URI has no content after prefix.");

        string memory expectedNamePartBase64 = "eyJuYW1lIjogIlN3YXBDYXN0IFBvc2l0aW9uIE5GVCAjMCI";
        assertTrue(stringContains(uri, expectedNamePartBase64), "URI missing expected name part (Base64 encoded)");

        string memory expectedDescPartBase64 =
            "ImRlc2NyaXB0aW9uIjogIkEgU3dhcENhc3QgcHJlZGljdGlvbiBwb3NpdGlvbiBORlQgcmVwcmVzZW50aW5nIGEgdXNlcidzIGNvbnZpY3Rpb24gb24gYSBzcGVjaWZpYyBtYXJrZXQgb3V0Y29tZS4i";
        assertTrue(
            stringContains(uri, expectedDescPartBase64), "URI missing expected description part (Base64 encoded)"
        );

        string memory expectedMarketIdAttrStartBase64 =
            "LCJhdHRyaWJ1dGVzIjogW3sidHJhaXRfdHlwZSI6ICJNYXJrZXQgSUQiLCAidmFsdWUiOiA3N30";
        assertTrue(
            stringContains(uri, expectedMarketIdAttrStartBase64),
            "URI missing expected start of market ID attribute array (Base64 encoded)"
        );
    }

    // Helper function to check if a string contains another string (source: Solady's strings.sol)
    function stringContains(string memory self, string memory needle) internal pure returns (bool) {
        bytes memory selfBytes = bytes(self);
        bytes memory needleBytes = bytes(needle);

        if (needleBytes.length == 0) {
            return true; // Empty needle is always found
        }
        if (selfBytes.length < needleBytes.length) {
            return false; // Needle is longer than self
        }

        for (uint256 i = 0; i <= selfBytes.length - needleBytes.length; i++) {
            bool isMatch = true;
            for (uint256 j = 0; j < needleBytes.length; j++) {
                if (selfBytes[i + j] != needleBytes[j]) {
                    isMatch = false;
                    break;
                }
            }
            if (isMatch) {
                return true;
            }
        }
        return false;
    }

    // Helper function to check if a string starts with a specific prefix
    function startsWith(string memory self, string memory prefix) internal pure returns (bool) {
        bytes memory selfBytes = bytes(self);
        bytes memory prefixBytes = bytes(prefix);

        if (prefixBytes.length == 0) {
            return true; // Empty prefix always matches
        }
        if (selfBytes.length < prefixBytes.length) {
            return false; // Prefix is longer than self
        }

        for (uint256 i = 0; i < prefixBytes.length; i++) {
            if (selfBytes[i] != prefixBytes[i]) {
                return false;
            }
        }
        return true;
    }
}
