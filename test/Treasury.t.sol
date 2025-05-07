// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

import "forge-std/Test.sol";
import "../src/Treasury.sol";

contract TreasuryTest is Test {
    Treasury treasury;
    address owner = address(0xABCD);
    address nonOwner = address(0xBEEF);
    address payable recipient = payable(address(0xCAFE));

    function setUp() public {
        vm.prank(owner);
        treasury = new Treasury();
    }

    function testOwnerIsDeployer() public view {
        assertEq(treasury.owner(), owner);
    }

    function testReceiveETH() public {
        vm.deal(address(this), 1 ether);
        (bool sent, ) = address(treasury).call{value: 1 ether}("");
        assertTrue(sent);
        assertEq(address(treasury).balance, 1 ether);
    }

    /// @notice Test that owner can withdraw and emits event
    function testOwnerWithdrawsETH() public {
        vm.deal(address(this), 1 ether);
        (bool sent, ) = address(treasury).call{value: 1 ether}("");
        assertTrue(sent);
        uint256 treasuryBalance = address(treasury).balance;
        vm.expectEmit(true, true, false, true);
        emit Treasury.Withdraw(recipient, treasuryBalance);
        vm.prank(owner);
        treasury.withdraw(recipient, treasuryBalance);
        assertEq(address(treasury).balance, 0);
        assertEq(recipient.balance, treasuryBalance);
    }

    /// @notice Test that only owner can withdraw
    function testNonOwnerCannotWithdraw() public {
        vm.deal(address(this), 1 ether);
        (bool sent, ) = address(treasury).call{value: 1 ether}("");
        assertTrue(sent);
        vm.prank(nonOwner);
        vm.expectRevert("Not owner");
        treasury.withdraw(recipient, 1 ether);
    }

    /// @notice Test that withdrawing to zero address reverts
    function testWithdrawToZeroAddressReverts() public {
        vm.deal(address(this), 1 ether);
        (bool sent, ) = address(treasury).call{value: 1 ether}("");
        assertTrue(sent);
        vm.prank(owner);
        vm.expectRevert("Zero address");
        treasury.withdraw(payable(address(0)), 1 ether);
    }

    /// @notice Test that withdrawing with insufficient balance reverts
    function testWithdrawInsufficientBalance() public {
        vm.prank(owner);
        vm.expectRevert("Insufficient balance");
        treasury.withdraw(recipient, 1 ether);
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
        vm.expectRevert("Not owner");
        treasury.transferOwnership(address(0x1234));
    }

    /// @notice Test that transferring ownership to zero address reverts
    function testTransferOwnershipToZeroAddressReverts() public {
        vm.prank(owner);
        vm.expectRevert("Zero address");
        treasury.transferOwnership(address(0));
    }

    function testTransferOwnershipZeroAddress() public {
        vm.prank(owner);
        vm.expectRevert("Zero address");
        treasury.transferOwnership(address(0));
    }
}
