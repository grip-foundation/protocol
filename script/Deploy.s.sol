// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/AgentDID.sol";
import "../src/ServiceEscrow.sol";
import "../src/SessionKeyManager.sol";
import "../src/AgentRegistry.sol";
import "../src/GripPaymaster.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address usdc = vm.envAddress("USDC_ADDRESS");
        address treasury = vm.envAddress("TREASURY_ADDRESS");
        address relayer = vm.envAddress("RELAYER_ADDRESS");

        vm.startBroadcast(deployerKey);

        AgentDID agentDID = new AgentDID();
        ServiceEscrow escrow = new ServiceEscrow(usdc, address(agentDID), treasury);
        agentDID.setEscrowContract(address(escrow));

        SessionKeyManager sessionKeys = new SessionKeyManager();
        AgentRegistry registry = new AgentRegistry(address(agentDID));
        GripPaymaster paymaster = new GripPaymaster(usdc, relayer);

        vm.stopBroadcast();

        console.log("AgentDID:", address(agentDID));
        console.log("ServiceEscrow:", address(escrow));
        console.log("SessionKeyManager:", address(sessionKeys));
        console.log("AgentRegistry:", address(registry));
        console.log("GripPaymaster:", address(paymaster));
    }
}
