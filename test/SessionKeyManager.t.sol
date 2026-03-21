// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/SessionKeyManager.sol";

contract SessionKeyManagerTest is Test {
    SessionKeyManager public mgr;
    address public agentOwner = address(0x1);
    address public agent = address(0x2);
    address public target = address(0x3);

    function setUp() public {
        mgr = new SessionKeyManager();

        vm.prank(agentOwner);
        mgr.setAgentOwner(agent);
    }

    function _defaultParams() internal view returns (SessionKeyManager.SessionKeyParams memory) {
        address[] memory allowed = new address[](1);
        allowed[0] = target;
        return SessionKeyManager.SessionKeyParams({
            validUntil: block.timestamp + 1 days,
            allowedContracts: allowed,
            dailySpendingLimit: 1000e6,
            perTxLimit: 100e6,
            escalationThreshold: 900e6
        });
    }

    function test_grantAndValidate() public {
        vm.prank(agentOwner);
        bytes32 keyId = mgr.grantSessionKey(agent, _defaultParams());

        bool valid = mgr.validateSession(agent, keyId, target, 50e6);
        assertTrue(valid);
    }

    function test_grantKey_notOwner_reverts() public {
        vm.prank(address(0x99));
        vm.expectRevert(SessionKeyManager.NotAgentOwner.selector);
        mgr.grantSessionKey(agent, _defaultParams());
    }

    function test_validateSession_expired_reverts() public {
        vm.prank(agentOwner);
        bytes32 keyId = mgr.grantSessionKey(agent, _defaultParams());

        vm.warp(block.timestamp + 2 days);
        vm.expectRevert(SessionKeyManager.SessionExpired.selector);
        mgr.validateSession(agent, keyId, target, 1e6);
    }

    function test_validateSession_wrongContract_reverts() public {
        vm.prank(agentOwner);
        bytes32 keyId = mgr.grantSessionKey(agent, _defaultParams());

        vm.expectRevert(SessionKeyManager.ContractNotAllowed.selector);
        mgr.validateSession(agent, keyId, address(0x99), 1e6);
    }

    function test_validateSession_perTxLimit_reverts() public {
        vm.prank(agentOwner);
        bytes32 keyId = mgr.grantSessionKey(agent, _defaultParams());

        vm.expectRevert(SessionKeyManager.PerTxLimitExceeded.selector);
        mgr.validateSession(agent, keyId, target, 200e6);
    }

    function test_validateSession_dailyLimit_reverts() public {
        // Use high escalation threshold so circuit breaker doesn't interfere
        address[] memory allowed = new address[](1);
        allowed[0] = target;
        vm.prank(agentOwner);
        bytes32 keyId = mgr.grantSessionKey(agent, SessionKeyManager.SessionKeyParams({
            validUntil: block.timestamp + 1 days,
            allowedContracts: allowed,
            dailySpendingLimit: 1000e6,
            perTxLimit: 100e6,
            escalationThreshold: type(uint256).max
        }));

        // Spend up to daily limit
        for (uint256 i = 0; i < 10; i++) {
            mgr.validateSession(agent, keyId, target, 100e6);
        }
        // Now at 1000e6 = daily limit, next should fail
        vm.expectRevert(SessionKeyManager.DailyLimitExceeded.selector);
        mgr.validateSession(agent, keyId, target, 1e6);
    }

    function test_circuitBreaker() public {
        vm.prank(agentOwner);
        bytes32 keyId = mgr.grantSessionKey(agent, _defaultParams());

        // Spend up to escalation threshold (900e6)
        for (uint256 i = 0; i < 9; i++) {
            mgr.validateSession(agent, keyId, target, 100e6);
        }

        // Circuit breaker should be tripped
        vm.expectRevert(SessionKeyManager.CircuitBreakerActive.selector);
        mgr.validateSession(agent, keyId, target, 1e6);
    }

    function test_dailyReset() public {
        vm.prank(agentOwner);

        // Use higher escalation threshold so circuit breaker doesn't trip
        address[] memory allowed = new address[](1);
        allowed[0] = target;
        bytes32 keyId = mgr.grantSessionKey(agent, SessionKeyManager.SessionKeyParams({
            validUntil: block.timestamp + 10 days,
            allowedContracts: allowed,
            dailySpendingLimit: 500e6,
            perTxLimit: 500e6,
            escalationThreshold: type(uint256).max
        }));

        mgr.validateSession(agent, keyId, target, 500e6);

        vm.expectRevert(SessionKeyManager.DailyLimitExceeded.selector);
        mgr.validateSession(agent, keyId, target, 1e6);

        // Next day
        vm.warp(block.timestamp + 1 days);
        bool valid = mgr.validateSession(agent, keyId, target, 100e6);
        assertTrue(valid);
    }

    function test_revokeKey() public {
        vm.prank(agentOwner);
        bytes32 keyId = mgr.grantSessionKey(agent, _defaultParams());

        vm.prank(agentOwner);
        mgr.revokeSessionKey(agent, keyId);

        vm.expectRevert(SessionKeyManager.KeyNotFound.selector);
        mgr.validateSession(agent, keyId, target, 1e6);
    }
}
