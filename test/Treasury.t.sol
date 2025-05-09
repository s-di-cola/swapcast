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

    function setUp() public {
        vm.prank(owner);
        treasury = new Treasury(owner);
    }

    function testOwnerIsDeployer() public view {
        assertEq(treasury.owner(), owner);
    }

    function testReceiveETH() public {
        vm.deal(address(this), 1 ether);
        (bool sent,) = address(treasury).call{value: 1 ether}("");
        assertTrue(sent);
        assertEq(address(treasury).balance, 1 ether);
    }

    /// @notice Test that owner can withdraw and emits event
    function testOwnerWithdrawsETH() public {
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

    /// @notice Test that only owner can withdraw
    function testNonOwnerCannotWithdraw() public {
        vm.deal(address(this), 1 ether);
        (bool sent,) = address(treasury).call{value: 1 ether}("");
        assertTrue(sent);
        vm.prank(nonOwner);
        vm.expectRevert("Ownable: caller is not the owner");
        treasury.withdraw(1 ether, recipient);
    }

    /// @notice Test that withdrawing to zero address reverts
    function testWithdrawToZeroAddressReverts() public {
        vm.deal(address(this), 1 ether);
        (bool sent,) = address(treasury).call{value: 1 ether}("");
        assertTrue(sent);
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(Treasury.ZeroAddress.selector, "Withdrawal address cannot be zero"));
        treasury.withdraw(1 ether, payable(address(0)));
    }

    /// @notice Test that withdrawing with insufficient balance reverts
    function testWithdrawInsufficientBalance() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(Treasury.NotEnoughBalance.selector, 1 ether, 0));
        treasury.withdraw(1 ether, recipient);
    }

    /// @notice Test that withdrawing zero amount reverts
    function testWithdrawZeroAmountReverts() public {
        vm.deal(address(treasury), 1 ether); // Ensure treasury has some balance
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(Treasury.ZeroAddress.selector, "Withdrawal amount cannot be zero"));
        treasury.withdraw(0, recipient);
    }

    /// @notice Test that owner can transfer ownership and emits event
    function testTransferOwnership() public {
        vm.prank(owner);
        vm.expectEmit(true, true, false, true);
        emit OwnershipTransferred(owner, nonOwner);
        treasury.transferOwnership(nonOwner);
        assertEq(treasury.owner(), nonOwner);
    }

    /// @notice Test that non-owner cannot transfer ownership
    function testNonOwnerCannotTransferOwnership() public {
        vm.prank(nonOwner);
        vm.expectRevert("Ownable: caller is not the owner");
        treasury.transferOwnership(address(0x1234));
    }

    /// @notice Test that transferring ownership to zero address reverts
    function testTransferOwnershipToZeroAddressReverts() public {
        vm.prank(owner);
        vm.expectRevert("Ownable: new owner is the zero address");
        treasury.transferOwnership(address(0));
    }

    // --- Tests for withdrawAll ---

    /// @notice Test that owner can withdraw all ETH and emits event
    function testOwnerWithdrawsAllETH() public {
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

    /// @notice Test that only owner can call withdrawAll
    function testNonOwnerCannotWithdrawAll() public {
        vm.deal(address(treasury), 1 ether); // Fund the treasury
        vm.prank(nonOwner);
        vm.expectRevert("Ownable: caller is not the owner");
        treasury.withdrawAll(recipient);
    }

    /// @notice Test that withdrawAll to zero address reverts
    function testWithdrawAllToZeroAddressReverts() public {
        vm.deal(address(treasury), 1 ether); // Fund the treasury
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(Treasury.ZeroAddress.selector, "Withdrawal address cannot be zero"));
        treasury.withdrawAll(payable(address(0)));
    }

    /// @notice Test that withdrawAll with zero balance reverts with NotEnoughBalance(0,0)
    function testWithdrawAllZeroBalanceReverts() public {
        assertEq(address(treasury).balance, 0, "Treasury should have zero balance initially for this test");
        vm.prank(owner);
        // Expecting NotEnoughBalance(currentBalance, currentBalance) which is NotEnoughBalance(0,0)
        vm.expectRevert(abi.encodeWithSelector(Treasury.NotEnoughBalance.selector, 0, 0));
        treasury.withdrawAll(recipient);
    }
}
