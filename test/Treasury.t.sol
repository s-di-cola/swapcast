// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

import "forge-std/Test.sol";
import {Treasury} from "../src/Treasury.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract TreasuryTest is Test {
    Treasury treasury;
    address owner = address(0xABCD);
    address nonOwner = address(0xBEEF);
    address payable recipient = payable(address(0xCAFE));

    /// @notice Sets up the test environment for Treasury tests.
    function setUp() public {
        vm.prank(owner);
        treasury = new Treasury(owner);
    }

    /// @notice Tests that the Treasury contract can receive ETH.
    function test_receive_eth() public {
        vm.deal(address(this), 1 ether);
        (bool sent,) = address(treasury).call{value: 1 ether}("");
        assertTrue(sent);
        assertEq(address(treasury).balance, 1 ether);
    }

    /// @notice Tests that the owner can withdraw ETH and emits the correct event.
    function test_owner_withdraws_eth() public {
        vm.deal(address(this), 1 ether);
        (bool sent,) = address(treasury).call{value: 1 ether}("");
        assertTrue(sent);
        uint256 treasuryBalance = address(treasury).balance;
        vm.expectEmit(true, true, false, true);
        emit Treasury.OwnerWithdrawal(recipient, treasuryBalance);
        vm.prank(owner);
        treasury.withdraw(treasuryBalance, recipient);
        assertEq(address(treasury).balance, 0);
        assertEq(recipient.balance, treasuryBalance);
    }

    /// @notice Tests that only the owner can withdraw ETH.
    function test_non_owner_cannot_withdraw() public {
        vm.deal(address(this), 1 ether);
        (bool sent,) = address(treasury).call{value: 1 ether}("");
        assertTrue(sent);
        vm.prank(nonOwner);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, nonOwner));
        treasury.withdraw(1 ether, recipient);
    }

    /// @notice Tests that withdrawing to the zero address reverts.
    function test_withdraw_to_zero_address_reverts() public {
        vm.deal(address(this), 1 ether);
        (bool sent,) = address(treasury).call{value: 1 ether}("");
        assertTrue(sent);
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(Treasury.ZeroAddress.selector, "Withdrawal address cannot be zero"));
        treasury.withdraw(1 ether, payable(address(0)));
    }

    /// @notice Tests that withdrawing more than the balance reverts.
    function test_withdraw_insufficient_balance() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(Treasury.NotEnoughBalance.selector, 1 ether, 0));
        treasury.withdraw(1 ether, recipient);
    }

    /// @notice Tests that withdrawing zero amount reverts.
    function test_withdraw_zero_amount_reverts() public {
        vm.deal(address(treasury), 1 ether); // Ensure treasury has some balance
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(Treasury.ZeroAddress.selector, "Withdrawal amount cannot be zero"));
        treasury.withdraw(0, recipient);
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
