// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/ServiceEscrow.sol";
import "../src/AgentDID.sol";
import "./mocks/MockERC20.sol";

contract ServiceEscrowTest is Test {
    ServiceEscrow public escrow;
    AgentDID public did;
    MockERC20 public usdc;

    address public owner = address(this);
    address public payer = address(0x1);
    address public payee = address(0x2);
    address public treasury = address(0x3);

    uint256 constant AMOUNT = 1000e6; // 1000 USDC

    function setUp() public {
        usdc = new MockERC20();
        did = new AgentDID();
        escrow = new ServiceEscrow(address(usdc), address(did), treasury);

        // Link escrow to DID
        did.setEscrowContract(address(escrow));

        // Register both agents
        bytes32[] memory skills = new bytes32[](0);
        vm.prank(payer);
        did.registerAgent("v1", skills);
        vm.prank(payee);
        did.registerAgent("v1", skills);

        // Fund payer
        usdc.mint(payer, AMOUNT * 10);
        vm.prank(payer);
        usdc.approve(address(escrow), type(uint256).max);
    }

    function test_createEscrow() public {
        vm.prank(payer);
        uint256 id = escrow.createEscrow(payee, AMOUNT, bytes32("svc1"), bytes32("hash1"), 1 days);

        (address p, address py, uint256 amt,,, uint256 timeout,, ServiceEscrow.EscrowStatus status) = escrow.escrows(id);
        assertEq(p, payer);
        assertEq(py, payee);
        assertEq(amt, AMOUNT);
        assertEq(timeout, 1 days);
        assertEq(uint8(status), uint8(ServiceEscrow.EscrowStatus.Created));
        assertEq(usdc.balanceOf(address(escrow)), AMOUNT);
    }

    function test_createEscrow_zeroAmount_reverts() public {
        vm.prank(payer);
        vm.expectRevert(ServiceEscrow.InvalidAmount.selector);
        escrow.createEscrow(payee, 0, bytes32("svc1"), bytes32("hash1"), 1 days);
    }

    function test_releaseEscrow() public {
        vm.prank(payer);
        uint256 id = escrow.createEscrow(payee, AMOUNT, bytes32("svc1"), bytes32("hash1"), 1 days);

        uint256 payeeBefore = usdc.balanceOf(payee);
        uint256 treasuryBefore = usdc.balanceOf(treasury);

        vm.prank(payer);
        escrow.releaseEscrow(id);

        uint256 fee = (AMOUNT * 10) / 10000; // 0.1%
        assertEq(usdc.balanceOf(payee), payeeBefore + AMOUNT - fee);
        assertEq(usdc.balanceOf(treasury), treasuryBefore + fee);
    }

    function test_releaseEscrow_notPayer_reverts() public {
        vm.prank(payer);
        uint256 id = escrow.createEscrow(payee, AMOUNT, bytes32("svc1"), bytes32("hash1"), 1 days);

        vm.prank(payee);
        vm.expectRevert(ServiceEscrow.NotPayer.selector);
        escrow.releaseEscrow(id);
    }

    function test_refundOnTimeout() public {
        vm.prank(payer);
        uint256 id = escrow.createEscrow(payee, AMOUNT, bytes32("svc1"), bytes32("hash1"), 1 days);

        // Before timeout
        vm.expectRevert(ServiceEscrow.TimeoutNotReached.selector);
        escrow.refundOnTimeout(id);

        // After timeout
        vm.warp(block.timestamp + 1 days + 1);
        uint256 payerBefore = usdc.balanceOf(payer);
        escrow.refundOnTimeout(id);
        assertEq(usdc.balanceOf(payer), payerBefore + AMOUNT);
    }

    function test_dispute_and_resolve_payerWins() public {
        vm.prank(payer);
        uint256 id = escrow.createEscrow(payee, AMOUNT, bytes32("svc1"), bytes32("hash1"), 1 days);

        vm.prank(payer);
        escrow.dispute(id);

        uint256 payerBefore = usdc.balanceOf(payer);
        escrow.resolveDispute(id, true);
        assertEq(usdc.balanceOf(payer), payerBefore + AMOUNT);
    }

    function test_dispute_and_resolve_payeeWins() public {
        vm.prank(payer);
        uint256 id = escrow.createEscrow(payee, AMOUNT, bytes32("svc1"), bytes32("hash1"), 1 days);

        vm.prank(payee);
        escrow.dispute(id);

        uint256 payeeBefore = usdc.balanceOf(payee);
        escrow.resolveDispute(id, false);

        uint256 fee = (AMOUNT * 10) / 10000;
        assertEq(usdc.balanceOf(payee), payeeBefore + AMOUNT - fee);
    }

    function test_dispute_notParty_reverts() public {
        vm.prank(payer);
        uint256 id = escrow.createEscrow(payee, AMOUNT, bytes32("svc1"), bytes32("hash1"), 1 days);

        vm.prank(address(0x99));
        vm.expectRevert(ServiceEscrow.NotParty.selector);
        escrow.dispute(id);
    }

    function test_resolveDispute_notDisputed_reverts() public {
        vm.prank(payer);
        uint256 id = escrow.createEscrow(payee, AMOUNT, bytes32("svc1"), bytes32("hash1"), 1 days);

        vm.expectRevert(ServiceEscrow.EscrowNotDisputed.selector);
        escrow.resolveDispute(id, true);
    }

    function test_doubleRelease_reverts() public {
        vm.prank(payer);
        uint256 id = escrow.createEscrow(payee, AMOUNT, bytes32("svc1"), bytes32("hash1"), 1 days);

        vm.prank(payer);
        escrow.releaseEscrow(id);

        vm.prank(payer);
        vm.expectRevert(ServiceEscrow.EscrowNotCreated.selector);
        escrow.releaseEscrow(id);
    }

    function test_createEscrow_selfDeal_reverts() public {
        vm.prank(payer);
        vm.expectRevert(ServiceEscrow.InvalidPayee.selector);
        escrow.createEscrow(payer, AMOUNT, bytes32("svc1"), bytes32("hash1"), 1 days);
    }
}
