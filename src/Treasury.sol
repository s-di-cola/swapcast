// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Treasury
 * @author SwapCast Team (Please update with actual author/team name)
 * @notice Holds protocol fees (ETH) collected, primarily from the PredictionPool, and allows the owner to withdraw them.
 * @dev This contract uses a `receive()` fallback to accept ETH deposits. Only the owner, designated
 *      at deployment, can initiate withdrawals. It employs standard OpenZeppelin Ownable for access control.
 */
contract Treasury is Ownable {
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
     * @notice Reverts if an ETH withdrawal call (e.g., to the owner's address) fails.
     */
    error WithdrawalFailed();
    /**
     * @notice Reverts if a withdrawal is attempted for an amount greater than the Treasury's current balance.
     * @param requested The amount of ETH requested for withdrawal.
     * @param available The current ETH balance available in the Treasury.
     */
    error NotEnoughBalance(uint256 requested, uint256 available);
    /**
     * @notice Reverts if an operation is attempted with a zero address where it's not allowed (e.g., withdrawing to address(0)).
     * @param message A descriptive message explaining the context of the zero address error.
     */
    error ZeroAddress(string message); // Define the custom error

    /**
     * @notice Contract constructor.
     * @param initialOwner The initial owner of this Treasury contract, who will have withdrawal privileges.
     */
    constructor(address initialOwner) Ownable(initialOwner) {}

    /**
     * @notice Allows the Treasury to receive ETH. This is the primary mechanism for fee deposits.
     * @dev This `receive()` external payable function is called when ETH is sent to this contract's address
     *      without any specific function signature. Emits a {FeeReceived} event if value is greater than zero.
     *      Primarily intended for use by the PredictionPool contract to transfer collected fees.
     */
    receive() external payable {
        if (msg.value > 0) {
            emit FeeReceived(msg.sender, msg.value);
        }
    }

    /**
     * @notice Allows the contract owner to withdraw a specified amount of ETH from the Treasury.
     * @dev Only callable by the owner. The recipient address `_to` must not be the zero address.
     *      Reverts with {NotEnoughBalance} if `_amount` exceeds the contract's balance.
     *      Reverts with {WithdrawalFailed} if the ETH transfer fails.
     *      Emits an {OwnerWithdrawal} event on successful withdrawal.
     * @param _amount The amount of ETH to withdraw.
     * @param _to The payable address to which the ETH should be sent.
     */
    function withdraw(uint256 _amount, address payable _to) external onlyOwner {
        if (_to == address(0)) revert ZeroAddress("Withdrawal address cannot be zero");

        uint256 balance = address(this).balance;
        if (_amount == 0) revert ZeroAddress("Withdrawal amount cannot be zero"); // Added check for zero amount
        if (_amount > balance) revert NotEnoughBalance(_amount, balance);

        (bool success,) = _to.call{value: _amount}("");
        if (!success) revert WithdrawalFailed();

        emit OwnerWithdrawal(_to, _amount);
    }

    /**
     * @notice Allows the contract owner to withdraw the entire ETH balance from the Treasury.
     * @dev Only callable by the owner. The recipient address `_to` must not be the zero address.
     *      Reverts if the Treasury's balance is zero using {NotEnoughBalance}.
     *      Reverts with {WithdrawalFailed} if the ETH transfer fails.
     *      Emits an {OwnerWithdrawal} event on successful withdrawal.
     * @param _to The payable address to which the entire balance should be sent.
     */
    function withdrawAll(address payable _to) external onlyOwner {
        if (_to == address(0)) revert ZeroAddress("Withdrawal address cannot be zero");
        uint256 balance = address(this).balance;
        // The NotEnoughBalance(0,0) is a bit unconventional for a zero balance check.
        // More explicit would be `if (balance == 0) revert NoBalanceToWithdraw();` (custom error)
        // However, NotEnoughBalance(0,0) will correctly prevent a zero-value transfer from emitting an event if that's the intent.
        if (balance == 0) revert NotEnoughBalance(balance, balance); // Using balance for both params for clarity

        (bool success,) = _to.call{value: balance}("");
        if (!success) revert WithdrawalFailed();

        emit OwnerWithdrawal(_to, balance);
    }
}
