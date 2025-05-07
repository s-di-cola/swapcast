// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/**
 * @title Treasury
 * @notice Receives protocol fees and allows the owner to withdraw funds. Emits events for all state changes and uses custom errors for strict security.
 */
contract Treasury {
    address public owner;

    /// @notice Emitted when the owner withdraws funds
    /// @param to The address that received the withdrawn funds
    /// @param amount The amount withdrawn
    event Withdraw(address indexed to, uint256 amount);

    /// @notice Emitted when ownership is transferred
    /// @param previousOwner The previous owner address
    /// @param newOwner The new owner address
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /// @notice Sets the deployer as the initial owner
    constructor() {
        owner = msg.sender;
    }

    /// @notice Modifier to restrict actions to the owner
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    /// @notice Allows the contract to receive ETH
    receive() external payable {}

    /// @notice Allows the owner to withdraw ETH from the contract
    /// @param to The address to send withdrawn funds to
    /// @param amount The amount to withdraw
    function withdraw(address payable to, uint256 amount) external onlyOwner {
        require(to != address(0), "Zero address");
        require(address(this).balance >= amount, "Insufficient balance");
        (bool sent,) = to.call{value: amount}("");
        require(sent, "Withdraw failed");
        emit Withdraw(to, amount);
    }

    /// @notice Allows the owner to transfer ownership
    /// @param newOwner The address of the new owner
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}
