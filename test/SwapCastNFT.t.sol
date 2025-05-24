// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
import {SwapCastNFT} from "src/SwapCastNFT.sol";
import {PredictionTypes} from "src/types/PredictionTypes.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC721Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";

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

    // Events to test
    event PositionNFTMinted(
        address indexed owner,
        uint256 indexed tokenId,
        uint256 marketId,
        PredictionTypes.Outcome outcome,
        uint256 convictionStake
    );
    event PositionNFTBurned(uint256 indexed tokenId);
    event PredictionManagerAddressSet(address indexed oldAddress, address indexed newAddress);

    function setUp() public {
        pool = new PredictionPoolMock();
        ownerOfNFTContract = address(this); // Test contract owns the NFT contract
        nft = new SwapCastNFT(ownerOfNFTContract, "TestSwapCastNFT", "TSCNFT");
        // Owner of NFT contract sets the prediction pool address
        vm.prank(ownerOfNFTContract);
        nft.setPredictionManagerAddress(address(pool));
    }

    /// @notice Test that minting emits event and sets metadata
    function test_mint_and_metadata() public {
        // Expect the PositionNFTMinted event
        vm.expectEmit(true, true, true, true);
        emit PositionNFTMinted(user, 0, 1, PredictionTypes.Outcome.Bullish, 100);

        pool.callMint(nft, user, 1, PredictionTypes.Outcome.Bullish, 100);

        // Check metadata - use the public mapping getter which returns the storage types
        // The order of return values is based on the struct definition
        (uint128 marketId, uint64 mintedAt, uint128 convictionStake, PredictionTypes.Outcome outcome) =
            nft.tokenPredictionMetadata(0);
        assertEq(marketId, 1, "Market ID mismatch");
        assertEq(uint8(outcome), uint8(PredictionTypes.Outcome.Bullish), "Outcome mismatch");
        assertEq(convictionStake, 100, "Conviction stake mismatch");
        assertTrue(mintedAt > 0, "MintedAt should be set");
    }

    /// @notice Test that minting with zero conviction stake reverts
    function test_mint_zero_conviction_reverts() public {
        vm.expectRevert(SwapCastNFT.InvalidConvictionStake.selector);
        pool.callMint(nft, user, 1, PredictionTypes.Outcome.Bullish, 0);
    }

    /// @notice Test that only PredictionPool can mint
    function test_only_prediction_pool_can_mint() public {
        vm.prank(address(0xBEEF));
        vm.expectRevert(SwapCastNFT.NotPredictionManager.selector);
        nft.mint(user, 1, PredictionTypes.Outcome.Bullish, 100);
    }

    /// @notice Test that minting to zero address reverts
    function test_mint_to_zero_address_reverts() public {
        vm.expectRevert(SwapCastNFT.ZeroAddress.selector);
        pool.callMint(nft, address(0), 1, PredictionTypes.Outcome.Bullish, 100);
    }

    /// @notice Test that unauthorized burn reverts
    function test_unauthorized_burn_reverts() public {
        pool.callMint(nft, user, 1, PredictionTypes.Outcome.Bullish, 100);
        vm.prank(address(0xBEEF));
        vm.expectRevert(SwapCastNFT.NotPredictionManager.selector);
        nft.burn(0);
    }

    /// @notice Test that burning a non-existent token reverts
    function test_burn_non_existent_token() public {
        vm.expectRevert(abi.encodeWithSelector(SwapCastNFT.NonExistentToken.selector, 0));
        pool.callBurn(nft, 0);
    }

    /// @notice Test successful burn by PredictionPool
    function test_burn_by_prediction_pool() public {
        pool.callMint(nft, user, 1, PredictionTypes.Outcome.Bullish, 100);

        // Expect the PositionNFTBurned event
        vm.expectEmit(true, false, false, false);
        emit PositionNFTBurned(0);

        pool.callBurn(nft, 0);

        vm.expectRevert(abi.encodeWithSelector(IERC721Errors.ERC721NonexistentToken.selector, 0));
        nft.ownerOf(0);
    }

    /// @notice Test setting prediction pool address
    function test_set_prediction_pool_address() public {
        address newPoolAddress = address(0xABCD);
        vm.prank(ownerOfNFTContract);
        vm.expectEmit(true, true, true, true);
        emit SwapCastNFT.PredictionManagerAddressSet(address(pool), newPoolAddress);
        nft.setPredictionManagerAddress(newPoolAddress);
        assertEq(nft.predictionManagerAddress(), newPoolAddress);
    }

    /// @notice Test setting prediction pool address to zero reverts
    function testSetPredictionPoolAddressToZeroReverts() public {
        vm.prank(ownerOfNFTContract);
        vm.expectRevert(SwapCastNFT.ZeroAddress.selector);
        nft.setPredictionManagerAddress(address(0));
    }

    /// @notice Test non-owner cannot set prediction pool address
    /// @notice Test that non-owner cannot set prediction pool address
    function test_non_owner_cannot_set_prediction_pool_address() public {
        address attacker = address(0xDEAD);
        vm.prank(attacker);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, attacker));
        nft.setPredictionManagerAddress(address(0xABCD));
    }

    /// @notice Test that tokenURI for non-existent token reverts
    function test_token_uri_for_non_existent_token() public {
        vm.expectRevert(abi.encodeWithSelector(SwapCastNFT.NonExistentToken.selector, 0));
        nft.tokenURI(0);
    }

    /// @notice Test successful tokenURI generation
    function test_token_uri_success() public {
        string memory expectedPrefix = "data:application/json;base64,";
        uint256 marketId = 77;
        uint256 convictionStake = 1e18;
        uint256 mintTimestamp = 1; // Mock timestamp

        vm.store(address(nft), bytes32(uint256(4)), bytes32(uint256(mintTimestamp))); // Mock block.timestamp for _mintTimestamp
        nft.setPredictionManagerAddress(address(this));
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
