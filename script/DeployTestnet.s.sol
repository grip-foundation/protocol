// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/AgentDID.sol";
import "../src/ServiceEscrow.sol";
import "../src/SessionKeyManager.sol";
import "../src/AgentRegistry.sol";
import "../src/GripPaymaster.sol";
import "../test/mocks/MockERC20.sol";

contract DeployTestnet is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("PRIVATE_KEY");
        address treasury = vm.envAddress("TREASURY_ADDRESS");
        address relayer = vm.envAddress("RELAYER_ADDRESS");

        vm.startBroadcast(deployerKey);

        // Deploy mock USDC (6 decimals)
        MockERC20 usdc = new MockERC20();
        
        // Mint 1M USDC to deployer for testing
        usdc.mint(vm.addr(deployerKey), 1_000_000e6);

        // Deploy protocol
        AgentDID agentDID = new AgentDID();
        ServiceEscrow escrow = new ServiceEscrow(address(usdc), address(agentDID), treasury);
        agentDID.setEscrowContract(address(escrow));

        SessionKeyManager sessionKeys = new SessionKeyManager();
        AgentRegistry registry = new AgentRegistry(address(agentDID));
        GripPaymaster paymaster = new GripPaymaster(address(usdc), relayer);

        vm.stopBroadcast();

        console.log("=== Grip Protocol Deployed on Base Sepolia ===");
        console.log("MockUSDC:", address(usdc));
        console.log("AgentDID:", address(agentDID));
        console.log("ServiceEscrow:", address(escrow));
        console.log("SessionKeyManager:", address(sessionKeys));
        console.log("AgentRegistry:", address(registry));
        console.log("GripPaymaster:", address(paymaster));
    }
}
