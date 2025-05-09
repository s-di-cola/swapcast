// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {ISwapCastNFT} from "./interfaces/ISwapCastNFT.sol";
import {PredictionTypes} from "./types/PredictionTypes.sol";

/**
 * @title SwapCastNFT
 * @author SwapCast Team (Please update with actual author/team name)
 * @notice Represents a user's prediction position as an ERC721 Non-Fungible Token.
 *         Each NFT stores metadata about the prediction, such as market ID, outcome, and conviction stake.
 * @dev This contract handles the lifecycle of prediction NFTs: minting, burning, and metadata provision.
 *      Minting and burning operations are restricted to an authorized PredictionPool contract, set by the owner.
 *      Token URIs, containing JSON metadata and attributes, are generated dynamically and on-chain.
 *      It inherits from OpenZeppelin's ERC721 and Ownable contracts and implements the ISwapCastNFT interface.
 */
contract SwapCastNFT is ERC721, Ownable, ISwapCastNFT {
    /**
     * @notice The address of the PredictionPool contract authorized to mint and burn these NFTs.
     * @dev Only this address can call `mint()` and `burn()`. Settable by the contract owner.
     */
    address public predictionPoolAddress;

    /**
     * @notice Stores the detailed metadata associated with each prediction NFT.
     * @param marketId The unique identifier of the market this prediction pertains to.
     * @param outcome The predicted outcome (Bearish or Bullish).
     * @param convictionStake The amount of value (e.g., in Wei) staked on this prediction, representing its conviction.
     * @param mintedAt The Unix timestamp indicating when the NFT was minted.
     */
    struct PredictionMetadata {
        uint256 marketId;
        PredictionTypes.Outcome outcome;
        uint256 convictionStake;
        uint256 mintedAt;
    }

    /**
     * @notice Mapping from token ID to its {PredictionMetadata}.
     * @dev Publicly accessible, allowing anyone to query the metadata for a given token ID using the auto-generated getter `tokenPredictionMetadata(uint256 tokenId)`.
     */
    mapping(uint256 => PredictionMetadata) public tokenPredictionMetadata;

    /**
     * @notice Counter for the next token ID to be minted, ensuring unique token IDs.
     * @dev Starts at 0. Incremented after each mint operation. Private to control ID assignment strictly through `mint()`.
     */
    uint256 private _nextTokenId;

    /**
     * @notice Emitted when the `predictionPoolAddress` is successfully updated.
     * @param oldAddress The previous address of the PredictionPool (address(0) if not previously set).
     * @param newAddress The new, updated address of the PredictionPool.
     */
    event PredictionPoolAddressSet(address indexed oldAddress, address indexed newAddress);
    /**
     * @notice Emitted when a new prediction NFT (position) is minted.
     * @param owner The address receiving the minted NFT (the predictor).
     * @param tokenId The unique identifier of the minted NFT.
     * @param marketId The market ID for which the prediction is made.
     * @param outcome The predicted outcome (Bearish or Bullish).
     * @param convictionStake The amount of conviction (stake) declared for this prediction.
     */
    event PositionNFTMinted(
        address indexed owner,
        uint256 indexed tokenId,
        uint256 marketId,
        PredictionTypes.Outcome outcome,
        uint256 convictionStake
    );
    /**
     * @notice Emitted when a prediction NFT (position) is burned, typically after a claim or resolution.
     * @param tokenId The unique ID of the burned NFT.
     */
    event PositionNFTBurned(uint256 indexed tokenId);

    /**
     * @notice Reverts if a restricted function is called by an address other than the authorized `predictionPoolAddress`.
     */
    error NotPredictionPool();
    /**
     * @notice Reverts if an address parameter is the zero address when a non-zero address is required (e.g., setting PredictionPool address).
     */
    error ZeroAddress();
    /**
     * @notice Reverts if an operation (e.g., querying `tokenURI` or `getPredictionDetails`) is attempted on a non-existent token ID.
     * @param tokenId The token ID that does not exist.
     */
    error NonExistentToken(uint256 tokenId);

    /**
     * @notice Contract constructor.
     * @param _initialOwner The initial owner of this SwapCastNFT contract (e.g., a deployer or governance multisig).
     *                      This owner can set the `predictionPoolAddress`.
     * @param _name The name of the NFT collection (e.g., "SwapCast Positions"). Passed to the ERC721 constructor.
     * @param _symbol The symbol of the NFT collection (e.g., "SCPOS"). Passed to the ERC721 constructor.
     */
    constructor(address _initialOwner, string memory _name, string memory _symbol) ERC721(_name, _symbol) {
        // Transfer ownership to the initialOwner if it's not the deployer
        if (_initialOwner != msg.sender) {
            transferOwnership(_initialOwner);
        }
    }

    /**
     * @notice Sets or updates the address of the PredictionPool contract authorized to mint/burn NFTs.
     * @dev Only callable by the contract owner. Emits {PredictionPoolAddressSet}.
     *      The provided `_newPredictionPoolAddress` must not be the zero address.
     * @param _newPredictionPoolAddress The new address for the PredictionPool contract.
     */
    function setPredictionPoolAddress(address _newPredictionPoolAddress) external onlyOwner {
        if (_newPredictionPoolAddress == address(0)) revert ZeroAddress();
        address oldAddress = predictionPoolAddress;
        predictionPoolAddress = _newPredictionPoolAddress;
        emit PredictionPoolAddressSet(oldAddress, _newPredictionPoolAddress);
    }

    /**
     * @dev Modifier to restrict certain functions (like `mint` and `burn`) to be callable only by the `predictionPoolAddress`.
     *      Reverts with {NotPredictionPool} if called by any other address.
     */
    modifier onlyPredictionPool() {
        if (msg.sender != predictionPoolAddress) revert NotPredictionPool();
        _;
    }

    /**
     * @notice Mints a new NFT representing a user's prediction position.
     * @dev Implements `ISwapCastNFT.mint`. Only callable by the authorized `predictionPoolAddress` (via {onlyPredictionPool} modifier).
     *      Assigns a new unique token ID, mints the ERC721 token to the specified owner (`_to`),
     *      and stores the associated {PredictionMetadata}. Emits {PositionNFTMinted}.
     * @param _to The address that will own the newly minted NFT.
     * @param _marketId The market ID for which the prediction is made.
     * @param _outcome The predicted outcome.
     * @param _convictionStake The conviction stake amount for this prediction.
     * @return tokenId The ID of the newly minted NFT.
     */
    function mint(address _to, uint256 _marketId, PredictionTypes.Outcome _outcome, uint256 _convictionStake)
        external
        override
        onlyPredictionPool
        returns (uint256)
    {
        uint256 tokenId = _nextTokenId;
        _nextTokenId++; // Increment for the next mint

        _mint(_to, tokenId); // ERC721 _mint function

        tokenPredictionMetadata[tokenId] = PredictionMetadata({
            marketId: _marketId,
            outcome: _outcome,
            convictionStake: _convictionStake,
            mintedAt: block.timestamp
        });

        emit PositionNFTMinted(_to, tokenId, _marketId, _outcome, _convictionStake);
        return tokenId;
    }

    /**
     * @notice Burns (destroys) an existing NFT, typically after its prediction has been resolved and claimed.
     * @dev Implements `ISwapCastNFT.burn`. Only callable by the authorized `predictionPoolAddress` (via {onlyPredictionPool} modifier).
     *      Deletes the associated {PredictionMetadata} and burns the ERC721 token. Emits {PositionNFTBurned}.
     *      The `PredictionPool` is responsible for verifying token ownership and authorization before calling this function.
     * @param _tokenId The ID of the NFT to burn.
     */
    function burn(uint256 _tokenId) external override onlyPredictionPool {
        // The PredictionPool is responsible for ensuring it has the authority to burn this token.
        // This typically means the PredictionPool has confirmed the original owner's intent (e.g., during a claim process)
        // or that the token is effectively controlled/escrowed by the PredictionPool for burning.
        _burn(_tokenId); // ERC721 _burn function
        delete tokenPredictionMetadata[_tokenId];
        emit PositionNFTBurned(_tokenId);
    }

    /**
     * @notice Retrieves the core prediction details associated with a given NFT.
     * @dev Implements `ISwapCastNFT.getPredictionDetails`. View function.
     *      Reverts with {NonExistentToken} if the `_tokenId` does not exist.
     * @param _tokenId The ID of the NFT to query.
     * @return marketId The market ID of the prediction.
     * @return outcome The predicted outcome.
     * @return convictionStake The conviction stake amount.
     * @return owner_ The current owner of the NFT.
     */
    function getPredictionDetails(uint256 _tokenId)
        external
        view
        override
        returns (uint256 marketId, PredictionTypes.Outcome outcome, uint256 convictionStake, address owner_)
    {
        if (_ownerOf(_tokenId) == address(0)) revert NonExistentToken(_tokenId);
        PredictionMetadata storage meta = tokenPredictionMetadata[_tokenId];
        return (meta.marketId, meta.outcome, meta.convictionStake, _ownerOf(_tokenId));
    }

    /**
     * @notice Returns the Uniform Resource Identifier (URI) for a given token ID.
     * @dev Overrides `ERC721.tokenURI`. Generates on-chain JSON metadata, Base64 encoded.
     *      The JSON includes name, description, and attributes: Market ID, Predicted Outcome, Conviction Stake, and Minted At Timestamp.
     *      Reverts with {NonExistentToken} if the token does not exist.
     *      Note: This implementation does not currently include an 'image' field in the JSON metadata.
     * @param _tokenId The ID of the token to get the URI for.
     * @return A string URI containing Base64 encoded JSON metadata (e.g., "data:application/json;base64,eyJuYW1lIjoiU3dhcENhc3QgTkZUIyIsICJkZXNjcmlwdGlvbiI6IkEgUHJlZGljdGlvbiBwb3NpdGlvbiIsICJhdHRyaWJ1dGVzIjpbXX0=").
     */
    function tokenURI(uint256 _tokenId) public view override returns (string memory) {
        // Check if the token exists by verifying if its owner is not the zero address.
        // _ownerOf is an internal function in OpenZeppelin's ERC721 contract.
        if (_ownerOf(_tokenId) == address(0)) revert NonExistentToken(_tokenId);

        PredictionMetadata memory meta = tokenPredictionMetadata[_tokenId];

        string memory outcomeStr;
        if (meta.outcome == PredictionTypes.Outcome.Bearish) {
            outcomeStr = "Bearish"; // Example outcome string
        } else if (meta.outcome == PredictionTypes.Outcome.Bullish) {
            outcomeStr = "Bullish"; // Example outcome string
        } else {
            // Fallback for other potential outcome values, or could revert if outcomes are strictly 0 or 1.
            outcomeStr = "Undefined/Other";
        }

        // Structured JSON Metadata Generation using helper functions

        // 1. Name and Description parts
        string memory namePart = string.concat('"name": "SwapCast Position NFT #', Strings.toString(_tokenId));
        namePart = string.concat(namePart, '"'); // Close name string

        string memory descPart =
            '"description": "A SwapCast prediction position NFT representing a user\'s conviction on a specific market outcome."';

        // 2. Use helper functions for attributes
        string memory marketIdAttr = _formatJsonAttributeUintValue("Market ID", meta.marketId);
        string memory outcomeAttr = _formatJsonAttributeStringValue("Predicted Outcome", outcomeStr);
        string memory stakeAttr = _formatJsonAttributeUintValue("Conviction Stake (Wei)", meta.convictionStake);
        string memory mintedAtAttr = _formatJsonAttributeUintValue("Minted At Timestamp", meta.mintedAt);

        // 3. Combine attributes into an array string (pairwise concatenation)
        string memory attributesArrayContents = marketIdAttr; // Start with the first
        attributesArrayContents = string.concat(attributesArrayContents, ",");
        attributesArrayContents = string.concat(attributesArrayContents, outcomeAttr);
        attributesArrayContents = string.concat(attributesArrayContents, ",");
        attributesArrayContents = string.concat(attributesArrayContents, stakeAttr);
        attributesArrayContents = string.concat(attributesArrayContents, ",");
        attributesArrayContents = string.concat(attributesArrayContents, mintedAtAttr);

        string memory attributesPart = string.concat('"attributes": [', attributesArrayContents);
        attributesPart = string.concat(attributesPart, "]");

        // 4. Assemble final JSON payload (pairwise concatenation)
        // Example: {"name":"...","description":"...","attributes":[{"trait_type":"...","value":"..."},...]}
        string memory json_payload = string.concat("{", namePart);
        json_payload = string.concat(json_payload, ",");
        json_payload = string.concat(json_payload, descPart);
        json_payload = string.concat(json_payload, ",");
        // TODO (V2/Future): Consider adding an 'image' field if SVG or other on-chain image data generation is desired.
        // This would involve more complex string manipulation and higher gas costs.
        // json_payload = string.concat(json_payload, '"image": "data:image/svg+xml;base64,...",');
        json_payload = string.concat(json_payload, attributesPart);
        json_payload = string.concat(json_payload, "}");

        string memory finalJson = Base64.encode(bytes(json_payload));
        return string.concat("data:application/json;base64,", finalJson);
    }

    // --- Internal Helper Functions for JSON Construction ---

    /**
     * @dev Internal helper function to format a JSON attribute where the attribute's value is a string.
     *      Used for constructing the `attributes` array in the token URI JSON.
     * @param _traitType The type or name of the trait (e.g., "Predicted Outcome").
     * @param _value The string value of the trait (e.g., "Bullish").
     * @return A string representing the JSON attribute object (e.g., '{"trait_type": "Predicted Outcome", "value": "Bullish"}').
     */
    function _formatJsonAttributeStringValue(string memory _traitType, string memory _value)
        internal
        pure
        returns (string memory)
    {
        string memory part1 = '{"trait_type": "';
        part1 = string.concat(part1, _traitType);
        part1 = string.concat(part1, '", "value": "');
        part1 = string.concat(part1, _value);
        return string.concat(part1, '"}');
    }

    /**
     * @dev Internal helper function to format a JSON attribute where the attribute's value is a uint256.
     *      Used for constructing the `attributes` array in the token URI JSON.
     * @param _traitType The type or name of the trait (e.g., "Market ID", "Conviction Stake (Wei)").
     * @param _value The uint256 value of the trait.
     * @return A string representing the JSON attribute object (e.g., '{"trait_type": "Market ID", "value": 123}').
     */
    function _formatJsonAttributeUintValue(string memory _traitType, uint256 _value)
        internal
        pure
        returns (string memory)
    {
        string memory part1 = '{"trait_type": "';
        part1 = string.concat(part1, _traitType);
        part1 = string.concat(part1, '", "value": '); // Note: No quotes around uint value in JSON
        part1 = string.concat(part1, Strings.toString(_value));
        return string.concat(part1, "}");
    }
}
