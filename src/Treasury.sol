// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title Treasury
 * @author Simone Di Cola
 * @notice Holds protocol fees (ETH) collected, primarily from the PredictionManager, and allows the owner to withdraw them.
 * @dev This contract uses a `receive()` fallback to accept ETH deposits. Only the owner, designated
 *      at deployment, can initiate withdrawals. It employs standard OpenZeppelin Ownable for access control
 *      and ReentrancyGuard to prevent reentrancy attacks during withdrawals.
 *
 *      The contract has the following key features:
 *      1. Secure ETH storage with reentrancy protection on withdrawals
 *      2. Owner-only withdrawal functions with comprehensive validation
 *      3. Detailed event emissions for all fund movements
 *      4. Comprehensive error handling with descriptive error messages
 *
 * @custom:security-contact security@swapcast.xyz
 */
contract Treasury is Ownable, ReentrancyGuard {
    /**
     * @notice Emitted when ETH is successfully received by the Treasury via the `receive()` function.
     * @param from The address that sent the ETH (e.g., PredictionPool).
     * @param amount The amount of ETH received.
     */
    event FeeReceived(address indexed from, uint256 amount);
    /**
     * @notice Emitted when the owner successfully withdraws ETH from the Treasury.
     * @param to The address to which the ETH was sent.
     * @param amount The amount of ETH withdrawn.
     */
    event OwnerWithdrawal(address indexed to, uint256 amount);

    /**
     * @notice Thrown when an ETH withdrawal call fails due to a low-level error.
     * @dev This can happen if the recipient is a contract that reverts in its receive function,
     *      or if there's a gas-related issue during the transfer.
     */
    error WithdrawalFailed();

    /**
     * @notice Thrown when a withdrawal is attempted for an amount greater than the Treasury's current balance.
     * @dev This error includes both the requested amount and available balance to provide clear feedback.
     *      It's also used when attempting to withdraw all funds from an empty treasury.
     * @param requested The amount of ETH requested for withdrawal.
     * @param available The current ETH balance available in the Treasury.
     */
    error NotEnoughBalance(uint256 requested, uint256 available);

    /**
     * @notice Thrown when an operation is attempted with a zero address or zero amount where it's not allowed.
     * @dev This error includes a descriptive message to clarify the specific context of the error,
     *      such as "Withdrawal address cannot be zero" or "Withdrawal amount cannot be zero".
     * @param message A descriptive message explaining the context of the zero address or zero value error.
     */
    error ZeroAddress(string message);

    /**
     * @notice Contract constructor that initializes the Treasury with an owner address.
     * @dev Sets up the owner who will have withdrawal privileges. The owner address is validated
     *      to ensure it's not the zero address, which would lock the contract's funds permanently.
     *
     * @param initialOwner The initial owner of this Treasury contract, who will have withdrawal privileges.
     * @custom:reverts ZeroAddress If the initialOwner is the zero address.
     */
    constructor(address initialOwner) Ownable(initialOwner) {
        if (initialOwner == address(0)) revert ZeroAddress("Initial owner cannot be zero address");
    }

    /**
     * @notice Allows the Treasury to receive ETH. This is the primary mechanism for fee deposits.
     * @dev This `receive()` external payable function is called when ETH is sent to this contract's address
     *      without any specific function signature. It emits a {FeeReceived} event if value is greater than zero,
     *      providing transparency for all incoming funds.
     *
     *      Primarily intended for use by the PredictionManager contract to transfer collected protocol fees,
     *      but can receive ETH from any source. No access control is applied to incoming transfers.
     *
     *      The function is intentionally kept simple and gas-efficient, with minimal logic to reduce the
     *      chance of failures when receiving funds.
     */
    receive() external payable {
        // Only emit an event if actual value was sent to avoid empty logs
        if (msg.value > 0) {
            emit FeeReceived(msg.sender, msg.value);
        }
    }

    /**
     * @notice Allows the contract owner to withdraw a specified amount of ETH from the Treasury.
     * @dev This function includes multiple security features:
     *      1. Owner-only access control via the onlyOwner modifier
     *      2. Reentrancy protection via the nonReentrant modifier
     *      3. Comprehensive input validation for both address and amount
     *      4. Balance verification before attempting the transfer
     *      5. Low-level call with success verification
     *
     *      The function performs the following steps:
     *      1. Validates that the recipient address is not zero
     *      2. Validates that the withdrawal amount is not zero
     *      3. Checks that the requested amount does not exceed the available balance
     *      4. Performs the ETH transfer using a low-level call
     *      5. Verifies the success of the transfer
     *      6. Emits an OwnerWithdrawal event with details of the transaction
     *
     * @param _amount The amount of ETH to withdraw.
     * @param _to The payable address to which the ETH should be sent.
     * @custom:reverts ZeroAddress If the recipient address is the zero address or the amount is zero.
     * @custom:reverts NotEnoughBalance If the requested amount exceeds the contract's balance.
     * @custom:reverts WithdrawalFailed If the ETH transfer fails for any reason.
     * @custom:emits OwnerWithdrawal On successful withdrawal with recipient and amount.
     */
    function withdraw(uint256 _amount, address payable _to) external onlyOwner nonReentrant {
        // Input validation - fail fast to save gas
        if (_to == address(0)) revert ZeroAddress("Withdrawal address cannot be zero");
        if (_amount == 0) revert ZeroAddress("Withdrawal amount cannot be zero");

        // Cache the balance to avoid multiple SLOAD operations
        uint256 balance = address(this).balance;
        if (_amount > balance) revert NotEnoughBalance(_amount, balance);

        // Perform the transfer using a low-level call for maximum compatibility
        (bool success,) = _to.call{value: _amount}("");
        if (!success) revert WithdrawalFailed();

        // Emit event for transparency and off-chain tracking
        emit OwnerWithdrawal(_to, _amount);
    }

    /**
     * @notice Allows the contract owner to withdraw the entire ETH balance from the Treasury in a single transaction.
     * @dev This is a convenience function that withdraws all available ETH at once. It includes the same
     *      security features as the withdraw function:
     *      1. Owner-only access control via the onlyOwner modifier
     *      2. Reentrancy protection via the nonReentrant modifier
     *      3. Comprehensive input validation for the recipient address
     *      4. Balance verification to prevent empty withdrawals
     *      5. Low-level call with success verification
     *
     *      The function performs the following steps:
     *      1. Validates that the recipient address is not zero
     *      2. Retrieves and validates the current contract balance
     *      3. Performs the ETH transfer using a low-level call
     *      4. Verifies the success of the transfer
     *      5. Emits an OwnerWithdrawal event with details of the transaction
     *
     * @param _to The payable address to which the entire balance should be sent.
     * @custom:reverts ZeroAddress If the recipient address is the zero address.
     * @custom:reverts NotEnoughBalance If the Treasury's balance is zero.
     * @custom:reverts WithdrawalFailed If the ETH transfer fails for any reason.
     * @custom:emits OwnerWithdrawal On successful withdrawal with recipient and the full balance amount.
     */
    function withdrawAll(address payable _to) external onlyOwner nonReentrant {
        // Input validation - fail fast to save gas
        if (_to == address(0)) revert ZeroAddress("Withdrawal address cannot be zero");

        // Cache the balance to avoid multiple SLOAD operations
        uint256 balance = address(this).balance;
        if (balance == 0) revert NotEnoughBalance(balance, balance);

        // Perform the transfer using a low-level call for maximum compatibility
        (bool success,) = _to.call{value: balance}("");
        if (!success) revert WithdrawalFailed();

        // Emit event for transparency and off-chain tracking
        emit OwnerWithdrawal(_to, balance);
    }
}
