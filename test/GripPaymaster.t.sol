// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/GripPaymaster.sol";
import "./mocks/MockERC20.sol";

contract GripPaymasterTest is Test {
    GripPaymaster public paymaster;
    MockERC20 public usdc;
    address public relayer = address(0x1);
    address public depositor = address(0x2);

    function setUp() public {
        usdc = new MockERC20();
        paymaster = new GripPaymaster(address(usdc), relayer);

        usdc.mint(depositor, 10000e6);
        vm.prank(depositor);
        usdc.approve(address(paymaster), type(uint256).max);
    }

    function test_deposit() public {
        vm.prank(depositor);
        paymaster.deposit(100e6);
        assertEq(paymaster.balanceOf(depositor), 100e6);
        assertEq(usdc.balanceOf(address(paymaster)), 100e6);
    }

    function test_deposit_zero_reverts() public {
        vm.prank(depositor);
        vm.expectRevert(GripPaymaster.InvalidAmount.selector);
        paymaster.deposit(0);
    }

    function test_withdraw() public {
        vm.startPrank(depositor);
        paymaster.deposit(100e6);
        paymaster.withdraw(50e6);
        vm.stopPrank();

        assertEq(paymaster.balanceOf(depositor), 50e6);
    }

    function test_withdraw_insufficient_reverts() public {
        vm.prank(depositor);
        vm.expectRevert(GripPaymaster.InsufficientBalance.selector);
        paymaster.withdraw(1e6);
    }

    function test_deductGas() public {
        vm.prank(depositor);
        paymaster.deposit(100e6);

        vm.prank(relayer);
        paymaster.deductGas(depositor, 10e6);

        assertEq(paymaster.balanceOf(depositor), 90e6);
    }

    function test_deductGas_notRelayer_reverts() public {
        vm.prank(depositor);
        paymaster.deposit(100e6);

        vm.prank(address(0x99));
        vm.expectRevert(GripPaymaster.UnauthorizedRelayer.selector);
        paymaster.deductGas(depositor, 10e6);
    }

    function test_deductGas_insufficient_reverts() public {
        vm.prank(relayer);
        vm.expectRevert(GripPaymaster.InsufficientBalance.selector);
        paymaster.deductGas(depositor, 1e6);
    }

    function test_setRelayer() public {
        address newRelayer = address(0x99);
        paymaster.setRelayer(newRelayer);
        assertEq(paymaster.relayer(), newRelayer);
    }

    function test_setRelayer_notOwner_reverts() public {
        vm.prank(address(0x99));
        vm.expectRevert();
        paymaster.setRelayer(address(0x88));
    }
}
