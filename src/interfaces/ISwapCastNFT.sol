// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title ISwapCastNFT
 * @author SwapCast Developers
 * @notice Interface for the SwapCastNFT contract, defining the external functions
 *         callable by other contracts, particularly the PredictionPool.
 * @dev This interface ensures that implementing contracts adhere to a specific set of functions
 *      for minting, burning, and retrieving details of prediction NFTs.
 */
interface ISwapCastNFT {
    /**
     * @notice Mints a new NFT representing a prediction.
     * @dev This function should be implemented by the SwapCastNFT contract and be callable
     *      by an authorized PredictionPool contract. It is responsible for creating a new NFT
     *      and associating it with the provided prediction details.
     * @param _to The address to mint the NFT to.
     * @param _marketId The ID of the market the prediction is for.
     * @param _outcome The predicted outcome (e.g., 0 for Bearish, 1 for Bullish).
     * @param _convictionStake The amount of conviction (e.g., in wei) staked on this prediction.
     * @return tokenId The unique ID of the newly minted token.
     */
    function mint(address _to, uint256 _marketId, uint8 _outcome, uint256 _convictionStake)
        external
        returns (uint256 tokenId);

    /**
     * @notice Burns an existing NFT.
     * @dev This function should be implemented by the SwapCastNFT contract and be callable
     *      by an authorized PredictionPool contract. Burning typically occurs after a prediction
     *      is resolved and any associated rewards are claimed, or if a position is otherwise invalidated.
     * @param _tokenId The ID of the token to burn.
     */
    function burn(uint256 _tokenId) external;

    /**
     * @notice Retrieves the details associated with a specific prediction NFT.
     * @dev This function allows querying of the core attributes of a prediction NFT.
     *      It should be implemented by the SwapCastNFT contract.
     * @param _tokenId The ID of the token to query.
     * @return marketId The market ID associated with the NFT.
     * @return outcome The predicted outcome stored in the NFT (e.g., 0 or 1).
     * @return convictionStake The conviction stake amount recorded for this prediction NFT.
     * @return owner The current owner of the NFT.
     */
    function getPredictionDetails(uint256 _tokenId)
        external
        view
        returns (uint256 marketId, uint8 outcome, uint256 convictionStake, address owner);
}
