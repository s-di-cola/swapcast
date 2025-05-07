// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC721} from "solmate/src/tokens/ERC721.sol";

/**
 * @title SwapCastNFT
 * @notice ERC721 NFT representing prediction positions.
 * @notice ERC721 NFT representing prediction positions. Emits events for all state changes and uses custom errors for strict security.
 * @dev Stores prediction metadata on-chain.
 */
contract SwapCastNFT is ERC721 {
    error AlreadyMinted();
    error NotOwner();

    struct Metadata {
        uint256 marketId;
        uint8 outcome;
        uint256 conviction;
    }

    uint256 public nextTokenId;
    mapping(uint256 => Metadata) internal _tokenMetadata;

    function tokenMetadata(uint256 tokenId) public view virtual returns (Metadata memory) {
        return _tokenMetadata[tokenId];
    }

    address public predictionPool;

    modifier onlyPredictionPool() {
        require(msg.sender == predictionPool, "Not PredictionPool");
        _;
    }

    constructor(address _predictionPool) ERC721("SwapCast Position", "SCNFT") {
        predictionPool = _predictionPool;
    }

    /// @notice Mint a new NFT for a prediction position
    function mint(address to, uint256 marketId, uint8 outcome, uint256 conviction)
        external
        virtual
        onlyPredictionPool
    {
        require(to != address(0), "Zero address");
        uint256 tokenId = nextTokenId;
        _mint(to, tokenId);
        _tokenMetadata[tokenId] = Metadata(marketId, outcome, conviction);
        nextTokenId++;
    }

    /// @notice Burn an NFT (only PredictionPool)
    function burn(uint256 tokenId) external onlyPredictionPool {
        _burn(tokenId);
        delete _tokenMetadata[tokenId];
    }

    /// @notice Returns on-chain metadata as a string
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        Metadata memory m = _tokenMetadata[tokenId];
        return string(
            abi.encodePacked(
                "data:application/json,{",
                '"name":"SwapCast Prediction #',
                _toString(tokenId),
                '",',
                '"description":"Prediction on market ',
                _toString(m.marketId),
                '",',
                '"attributes":[',
                '{"trait_type":"Outcome","value":"',
                _toString(m.outcome),
                '"},',
                '{"trait_type":"Conviction","value":"',
                _toString(m.conviction),
                '"}',
                "]}"
            )
        );
    }

    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) {
            return "0";
        }
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }
}
