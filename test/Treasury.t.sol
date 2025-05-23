// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import {Treasury} from "../src/Treasury.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract TreasuryTest is Test {
    Treasury public treasury;
    address public owner = address(0xABCD);
    address public nonOwner = address(0xBEEF);
    address payable public recipient = payable(address(0xCAFE));

    // Events to test
    event FeeReceived(address indexed from, uint256 amount);
    event OwnerWithdrawal(address indexed to, uint256 amount);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    /// @notice Sets up the test environment for Treasury tests.
    function setUp() public {
        vm.prank(owner);
        treasury = new Treasury(owner);

        // Fund the test contract
        vm.deal(address(this), 100 ether);
    }

    /// @notice Tests that the Treasury contract can receive ETH.
    function test_receive_eth() public {
        uint256 amount = 1 ether;
        uint256 initialBalance = address(treasury).balance;

        // Test direct transfer
        (bool sent,) = address(treasury).call{value: amount}("");
        assertTrue(sent, "ETH transfer failed");
        assertEq(address(treasury).balance, initialBalance + amount, "Treasury balance mismatch");

        // Test receive fallback
        uint256 additionalAmount = 0.5 ether;
        (sent,) = address(treasury).call{value: additionalAmount}("");
        assertTrue(sent, "Additional ETH transfer failed");
        assertEq(
            address(treasury).balance,
            initialBalance + amount + additionalAmount,
            "Treasury balance after second transfer mismatch"
        );
    }

    /// @notice Tests that the owner can withdraw ETH and emits the correct event.
    function test_owner_withdraws_eth() public {
        // Arrange
        uint256 amount = 1 ether;
        uint256 initialRecipientBalance = recipient.balance;
        vm.deal(address(treasury), amount);

        // Act & Assert
        vm.expectEmit(true, true, false, true);
        emit OwnerWithdrawal(recipient, amount);

        vm.prank(owner);
        treasury.withdraw(amount, recipient);

        // Assert
        assertEq(address(treasury).balance, 0, "Treasury should be empty after withdrawal");
        assertEq(recipient.balance, initialRecipientBalance + amount, "Recipient should receive the withdrawn amount");
    }

    /// @notice Tests that non-owner cannot withdraw ETH.
    function test_non_owner_cannot_withdraw() public {
        // Arrange
        uint256 amount = 1 ether;
        vm.deal(address(treasury), amount);

        // Act & Assert
        vm.prank(nonOwner);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, nonOwner));
        treasury.withdraw(amount, recipient);
    }

    /// @notice Tests that withdrawing to zero address reverts.
    function test_withdraw_to_zero_address_reverts() public {
        // Arrange
        uint256 amount = 1 ether;
        vm.deal(address(treasury), amount);

        // Act & Assert
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(Treasury.ZeroAddress.selector, "Withdrawal address cannot be zero"));
        treasury.withdraw(amount, payable(address(0)));
    }

    /// @notice Tests that withdrawing zero amount reverts.
    function test_withdraw_zero_amount_reverts() public {
        // Arrange
        uint256 amount = 0;
        vm.deal(address(treasury), 1 ether);

        // Act & Assert
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(Treasury.ZeroAddress.selector, "Withdrawal amount cannot be zero"));
        treasury.withdraw(amount, recipient);
    }

    /// @notice Tests that the owner can withdraw all ETH in a single transaction
    function test_owner_can_withdraw_all() public {
        // Arrange
        uint256 amount = 1 ether;
        uint256 initialRecipientBalance = recipient.balance;
        vm.deal(address(treasury), amount);

        // Act
        vm.prank(owner);
        treasury.withdrawAll(recipient);

        // Assert
        assertEq(address(treasury).balance, 0, "Treasury should be empty after withdrawal");
        assertEq(recipient.balance, initialRecipientBalance + amount, "Recipient should receive all ETH");
    }

    /// @notice Tests that withdrawing more than the balance reverts.
    function test_withdraw_insufficient_balance() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(Treasury.NotEnoughBalance.selector, 1 ether, 0));
        treasury.withdraw(1 ether, recipient);
    }

    /// @notice Tests that the owner can transfer ownership and emits the correct event.
    function test_transfer_ownership() public {
        vm.prank(owner);
        vm.expectEmit(true, true, false, true);
        emit OwnershipTransferred(owner, nonOwner);
        treasury.transferOwnership(nonOwner);
        assertEq(treasury.owner(), nonOwner);
    }

    /// @notice Tests that only the owner can transfer ownership.
    function test_non_owner_cannot_transfer_ownership() public {
        vm.prank(nonOwner);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, nonOwner));
        treasury.transferOwnership(nonOwner);
    }

    /// @notice Tests that ownership cannot be transferred to the zero address.
    function test_transfer_ownership_to_zero_address_reverts() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableInvalidOwner.selector, address(0)));
        treasury.transferOwnership(address(0));
    }

    // --- Tests for withdrawAll ---

    /// @notice Test that owner can withdraw all ETH and emits event
    /// @notice Tests that the owner can withdraw all ETH and emits the correct event.
    function test_owner_withdraws_all_eth() public {
        vm.deal(address(treasury), 1 ether); // Fund the treasury
        uint256 initialRecipientBalance = recipient.balance;
        uint256 treasuryBalance = address(treasury).balance;
        assertTrue(treasuryBalance > 0, "Treasury should have balance before withdrawAll");

        vm.expectEmit(true, true, false, true); // Checking for event Treasury.OwnerWithdrawal
        emit Treasury.OwnerWithdrawal(recipient, treasuryBalance);

        vm.prank(owner);
        treasury.withdrawAll(recipient);

        assertEq(address(treasury).balance, 0, "Treasury balance should be 0 after withdrawAll");
        assertEq(recipient.balance, initialRecipientBalance + treasuryBalance, "Recipient did not receive all funds");
    }

    /// @notice Tests that only the owner can withdraw all ETH.
    function test_non_owner_cannot_withdraw_all() public {
        vm.deal(address(treasury), 1 ether); // Fund the treasury
        vm.prank(nonOwner);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, nonOwner));
        treasury.withdrawAll(recipient);
    }

    /// @notice Tests that withdrawAll to the zero address reverts.
    function test_withdraw_all_to_zero_address_reverts() public {
        vm.deal(address(treasury), 1 ether); // Fund the treasury
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(Treasury.ZeroAddress.selector, "Withdrawal address cannot be zero"));
        treasury.withdrawAll(payable(address(0)));
    }

    /// @notice Tests that withdrawAll with zero balance reverts with NotEnoughBalance(0,0).
    function test_withdraw_all_zero_balance_reverts() public {
        assertEq(address(treasury).balance, 0, "Treasury should have zero balance initially for this test");
        vm.prank(owner);
        // Expecting NotEnoughBalance(currentBalance, currentBalance) which is NotEnoughBalance(0,0)
        vm.expectRevert(abi.encodeWithSelector(Treasury.NotEnoughBalance.selector, 0, 0));
        treasury.withdrawAll(recipient);
    }
}
