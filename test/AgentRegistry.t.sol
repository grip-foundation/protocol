// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/AgentRegistry.sol";
import "../src/AgentDID.sol";

contract AgentRegistryTest is Test {
    AgentRegistry public registry;
    AgentDID public did;
    address public agent1 = address(0x1);

    function setUp() public {
        did = new AgentDID();
        registry = new AgentRegistry(address(did));

        // Register agent DID
        bytes32[] memory skills = new bytes32[](0);
        vm.prank(agent1);
        did.registerAgent("v1", skills);
    }

    function test_register() public {
        string[] memory caps = new string[](2);
        caps[0] = "coding";
        caps[1] = "trading";

        vm.prank(agent1);
        registry.register(caps, 10e6, "https://agent1.api", 30);

        AgentRegistry.AgentProfile memory p = registry.getProfile(agent1);
        assertEq(p.capabilities.length, 2);
        assertEq(p.pricePerCall, 10e6);
        assertTrue(p.active);
    }

    function test_register_noDID_reverts() public {
        string[] memory caps = new string[](1);
        caps[0] = "x";

        vm.prank(address(0x99));
        vm.expectRevert(AgentRegistry.NoDID.selector);
        registry.register(caps, 10e6, "https://x", 30);
    }

    function test_register_duplicate_reverts() public {
        string[] memory caps = new string[](1);
        caps[0] = "x";

        vm.startPrank(agent1);
        registry.register(caps, 10e6, "https://x", 30);
        vm.expectRevert(AgentRegistry.AlreadyRegistered.selector);
        registry.register(caps, 10e6, "https://x", 30);
        vm.stopPrank();
    }

    function test_register_emptyCaps_reverts() public {
        string[] memory caps = new string[](0);
        vm.prank(agent1);
        vm.expectRevert(AgentRegistry.InvalidParams.selector);
        registry.register(caps, 10e6, "https://x", 30);
    }

    function test_updateProfile() public {
        string[] memory caps = new string[](1);
        caps[0] = "coding";

        vm.startPrank(agent1);
        registry.register(caps, 10e6, "https://old", 30);

        string[] memory newCaps = new string[](1);
        newCaps[0] = "trading";
        registry.updateProfile(newCaps, 20e6, "https://new", 60);
        vm.stopPrank();

        AgentRegistry.AgentProfile memory p = registry.getProfile(agent1);
        assertEq(p.pricePerCall, 20e6);
    }

    function test_deregister() public {
        string[] memory caps = new string[](1);
        caps[0] = "x";

        vm.startPrank(agent1);
        registry.register(caps, 10e6, "https://x", 30);
        registry.deregister();
        vm.stopPrank();

        AgentRegistry.AgentProfile memory p = registry.getProfile(agent1);
        assertFalse(p.active);
    }

    function test_getProfile_notRegistered_reverts() public {
        vm.expectRevert(AgentRegistry.NotRegistered.selector);
        registry.getProfile(address(0x99));
    }
}
