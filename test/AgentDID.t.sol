// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/AgentDID.sol";

contract AgentDIDTest is Test {
    AgentDID public did;
    address public owner = address(this);
    address public agent1 = address(0x1);
    address public agent2 = address(0x2);

    function setUp() public {
        did = new AgentDID();
    }

    function test_registerAgent() public {
        bytes32[] memory skills = new bytes32[](2);
        skills[0] = keccak256("coding");
        skills[1] = keccak256("trading");

        vm.prank(agent1);
        did.registerAgent("gpt-4", skills);

        IAgentDID.AgentInfo memory info = did.getAgent(agent1);
        assertEq(info.createdBy, agent1);
        assertEq(info.modelVersion, "gpt-4");
        assertEq(info.skillset.length, 2);
        assertEq(info.reputationScore, 5000);
        assertEq(info.successRate, 10000);
        assertTrue(did.agentExists(agent1));
    }

    function test_registerAgent_duplicate_reverts() public {
        bytes32[] memory skills = new bytes32[](0);
        vm.startPrank(agent1);
        did.registerAgent("v1", skills);
        vm.expectRevert(IAgentDID.AgentAlreadyRegistered.selector);
        did.registerAgent("v2", skills);
        vm.stopPrank();
    }

    function test_updateAgent() public {
        bytes32[] memory skills = new bytes32[](1);
        skills[0] = keccak256("a");

        vm.startPrank(agent1);
        did.registerAgent("v1", skills);

        bytes32[] memory newSkills = new bytes32[](1);
        newSkills[0] = keccak256("b");
        did.updateAgent("v2", newSkills);
        vm.stopPrank();

        IAgentDID.AgentInfo memory info = did.getAgent(agent1);
        assertEq(info.modelVersion, "v2");
    }

    function test_updateAgent_notRegistered_reverts() public {
        bytes32[] memory skills = new bytes32[](0);
        vm.prank(agent1);
        vm.expectRevert(IAgentDID.AgentNotFound.selector);
        did.updateAgent("v1", skills);
    }

    function test_getAgent_notFound_reverts() public {
        vm.expectRevert(IAgentDID.AgentNotFound.selector);
        did.getAgent(agent1);
    }

    function test_updateReputation_unauthorized_reverts() public {
        vm.expectRevert(IAgentDID.UnauthorizedCaller.selector);
        did.updateReputation(agent1, true);
    }

    function test_updateReputation_success() public {
        // Register agent
        bytes32[] memory skills = new bytes32[](0);
        vm.prank(agent1);
        did.registerAgent("v1", skills);

        // Set escrow contract
        address escrow = address(0x99);
        did.setEscrowContract(escrow);

        // Update reputation
        vm.prank(escrow);
        did.updateReputation(agent1, true);

        IAgentDID.AgentInfo memory info = did.getAgent(agent1);
        assertEq(info.totalTxs, 1);
        assertGt(info.reputationScore, 5000); // should increase
    }

    function test_updateReputation_failure() public {
        bytes32[] memory skills = new bytes32[](0);
        vm.prank(agent1);
        did.registerAgent("v1", skills);

        address escrow = address(0x99);
        did.setEscrowContract(escrow);

        vm.prank(escrow);
        did.updateReputation(agent1, false);

        IAgentDID.AgentInfo memory info = did.getAgent(agent1);
        assertEq(info.totalTxs, 1);
        assertLt(info.reputationScore, 5000); // should decrease
    }

    function test_setEscrowContract_onlyOwner() public {
        vm.prank(agent1);
        vm.expectRevert();
        did.setEscrowContract(address(0x99));
    }

    function test_setEscrowContract_zeroAddress() public {
        vm.expectRevert(AgentDID.ZeroAddress.selector);
        did.setEscrowContract(address(0));
    }

    function test_pause_unpause() public {
        did.pause();

        bytes32[] memory skills = new bytes32[](0);
        vm.prank(agent1);
        vm.expectRevert();
        did.registerAgent("v1", skills);

        did.unpause();

        vm.prank(agent1);
        did.registerAgent("v1", skills);
    }
}
