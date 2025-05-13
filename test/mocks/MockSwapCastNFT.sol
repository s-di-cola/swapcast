// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ISwapCastNFT} from "../../src/interfaces/ISwapCastNFT.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {PredictionTypes} from "../../src/types/PredictionTypes.sol";

contract MockSwapCastNFT is ISwapCastNFT, Ownable {
    struct PredictionNFT {
        uint256 marketId;
        PredictionTypes.Outcome outcome;
        uint256 convictionStake;
        address owner;
        bool exists;
    }

    mapping(uint256 => PredictionNFT) public nfts;
    mapping(address => uint256) public balances; // Track token balances per owner
    uint256 public nextTokenId;
    address public lastCallerToMint;
    address public lastCallerToBurn;
    address public predictionPoolAddress;

    // --- Events for testing ---
    event NFTMinted(
        address indexed to,
        uint256 indexed tokenId,
        uint256 marketId,
        PredictionTypes.Outcome outcome,
        uint256 convictionStake
    );
    event NFTBurned(uint256 indexed tokenId);

    // --- Errors for testing ---
    error TokenDoesNotExist(uint256 tokenId);
    error NotPredictionPool();

    // --- Control flags for testing ---
    bool public shouldRevertOnMint;
    bool public shouldRevertOnBurn;
    bool public shouldRevertOnGetPredictionDetails;

    // --- Constructor ---
    constructor() Ownable() {
        nextTokenId = 0; // Initialize token ID counter
    }

    /**
     * @notice Sets the address of the PredictionPool/Manager contract.
     * @dev Only callable by the owner.
     * @param _newAddress The address of the PredictionPool/Manager.
     */
    function setPredictionPoolAddress(address _newAddress) external onlyOwner {
        predictionPoolAddress = _newAddress;
    }

    /**
     * @notice Alias for setPredictionPoolAddress to match the test requirements.
     * @dev Only callable by the owner.
     * @param _newAddress The address of the PredictionManager.
     */
    function setPredictionManager(address _newAddress) external onlyOwner {
        predictionPoolAddress = _newAddress;
    }

    // --- ISwapCastNFT Implementation ---
    function mint(address _to, uint256 _marketId, PredictionTypes.Outcome _outcome, uint256 _convictionStake)
        external
        override
        returns (uint256 tokenId)
    {
        if (msg.sender != predictionPoolAddress) revert NotPredictionPool();
        lastCallerToMint = msg.sender; // Should be PredictionPool
        if (shouldRevertOnMint) {
            revert("MockSwapCastNFT: Mint reverted as instructed");
        }

        tokenId = nextTokenId;
        nfts[tokenId] = PredictionNFT({
            marketId: _marketId,
            outcome: _outcome,
            convictionStake: _convictionStake,
            owner: _to,
            exists: true
        });
        balances[_to]++;
        nextTokenId++;

        emit NFTMinted(_to, tokenId, _marketId, _outcome, _convictionStake);
        return tokenId;
    }

    function burn(uint256 _tokenId) external override {
        if (msg.sender != predictionPoolAddress) revert NotPredictionPool();
        lastCallerToBurn = msg.sender; // Should be PredictionPool
        if (shouldRevertOnBurn) {
            revert("MockSwapCastNFT: Burn reverted as instructed");
        }
        PredictionNFT storage nftToBurn = nfts[_tokenId];
        if (!nftToBurn.exists) {
            revert TokenDoesNotExist(_tokenId);
        }
        if (nftToBurn.owner == address(0)) {
            // Should not happen if token exists
            revert("MockSwapCastNFT: Burning token with no owner");
        }

        balances[nftToBurn.owner]--;
        delete nfts[_tokenId]; // Mark as not existing
        // nftToBurn.exists = false; // Alternative to delete if you want to keep some data but mark as burned
        // nftToBurn.owner = address(0);

        emit NFTBurned(_tokenId);
    }

    function getPredictionDetails(uint256 _tokenId)
        external
        view
        override
        returns (uint256 marketId, PredictionTypes.Outcome outcome, uint256 convictionStake, address owner)
    {
        if (shouldRevertOnGetPredictionDetails) {
            revert("MockSwapCastNFT: GetPredictionDetails reverted as instructed");
        }
        PredictionNFT storage nftDetails = nfts[_tokenId];
        if (!nftDetails.exists) {
            revert TokenDoesNotExist(_tokenId);
        }
        return (nftDetails.marketId, nftDetails.outcome, nftDetails.convictionStake, nftDetails.owner);
    }

    // --- Admin functions ---
    // function setPredictionPoolAddress(address _poolAddress) external onlyOwner {
    //     predictionPoolAddress = _poolAddress;
    // }

    // --- Test control functions ---
    function setShouldRevertOnMint(bool _revert) external {
        shouldRevertOnMint = _revert;
    }

    function setShouldRevertOnBurn(bool _revert) external {
        shouldRevertOnBurn = _revert;
    }

    function setShouldRevertOnGetPredictionDetails(bool _revert) external {
        shouldRevertOnGetPredictionDetails = _revert;
    }

    // Helper to simulate token transfer for tests (not part of ISwapCastNFT)
    // This is a simplified transfer, doesn't check for approvals etc.
    function transferFrom(address _from, address _to, uint256 _tokenId) external {
        PredictionNFT storage nftToTransfer = nfts[_tokenId];
        if (!nftToTransfer.exists) revert TokenDoesNotExist(_tokenId);
        require(nftToTransfer.owner == _from, "Not token owner"); // This require can stay as it's an auth check

        balances[_from]--;
        balances[_to]++;
        nftToTransfer.owner = _to;
    }

    function ownerOf(uint256 _tokenId) external view returns (address) {
        if (!nfts[_tokenId].exists) revert TokenDoesNotExist(_tokenId);
        return nfts[_tokenId].owner;
    }

    // --- IERC721Receiver (if this mock needs to receive NFTs itself) ---
    // function onERC721Received(address, address, uint256, bytes calldata) external pure override returns (bytes4) {
    //     return IERC721Receiver.onERC721Received.selector;
    // }
}
