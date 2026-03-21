// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// @title SessionKeyManager - Manages session keys for AI agents
/// @notice Allows agent owners to grant scoped, time-limited session keys
contract SessionKeyManager is Ownable2Step, Pausable {
    struct SessionKey {
        uint256 validUntil;
        address[] allowedContracts;
        uint256 dailySpendingLimit;
        uint256 perTxLimit;
        uint256 escalationThreshold;
        bool circuitBreaker;
        uint256 dailySpent;
        uint256 lastResetDay;
    }

    struct SessionKeyParams {
        uint256 validUntil;
        address[] allowedContracts;
        uint256 dailySpendingLimit;
        uint256 perTxLimit;
        uint256 escalationThreshold;
    }

    // agent => keyId => SessionKey
    mapping(address => mapping(bytes32 => SessionKey)) private _keys;
    // agent => owner
    mapping(address => address) public agentOwners;

    event SessionKeyGranted(address indexed agent, bytes32 indexed keyId, uint256 validUntil);
    event SessionKeyRevoked(address indexed agent, bytes32 indexed keyId);
    event SessionValidated(address indexed agent, bytes32 indexed keyId, address target, uint256 amount);
    event AgentOwnerSet(address indexed agent, address indexed owner);
    event CircuitBreakerTripped(address indexed agent, bytes32 indexed keyId);

    error NotAgentOwner();
    error SessionExpired();
    error ContractNotAllowed();
    error DailyLimitExceeded();
    error PerTxLimitExceeded();
    error CircuitBreakerActive();
    error KeyNotFound();
    error InvalidParams();

    constructor() Ownable(msg.sender) {}

    /// @notice Set agent owner (agent or owner calls this)
    /// @param agent The agent address
    function setAgentOwner(address agent) external whenNotPaused {
        agentOwners[agent] = msg.sender;
        emit AgentOwnerSet(agent, msg.sender);
    }

    /// @notice Grant a session key to an agent
    /// @param agent The agent address
    /// @param params Session key parameters
    /// @return keyId The generated key ID
    function grantSessionKey(address agent, SessionKeyParams calldata params)
        external
        whenNotPaused
        returns (bytes32 keyId)
    {
        if (agentOwners[agent] != msg.sender) revert NotAgentOwner();
        if (params.validUntil <= block.timestamp) revert InvalidParams();

        keyId = keccak256(abi.encodePacked(agent, msg.sender, block.timestamp, params.validUntil));

        _keys[agent][keyId] = SessionKey({
            validUntil: params.validUntil,
            allowedContracts: params.allowedContracts,
            dailySpendingLimit: params.dailySpendingLimit,
            perTxLimit: params.perTxLimit,
            escalationThreshold: params.escalationThreshold,
            circuitBreaker: false,
            dailySpent: 0,
            lastResetDay: block.timestamp / 1 days
        });

        emit SessionKeyGranted(agent, keyId, params.validUntil);
    }

    /// @notice Revoke a session key
    /// @param agent The agent address
    /// @param keyId The key to revoke
    function revokeSessionKey(address agent, bytes32 keyId) external {
        if (agentOwners[agent] != msg.sender) revert NotAgentOwner();
        if (_keys[agent][keyId].validUntil == 0) revert KeyNotFound();

        delete _keys[agent][keyId];
        emit SessionKeyRevoked(agent, keyId);
    }

    /// @notice Validate and consume a session key usage
    /// @param agent The agent address
    /// @param keyId The session key ID
    /// @param target The target contract
    /// @param amount The transaction amount
    /// @return valid Whether the session is valid
    function validateSession(address agent, bytes32 keyId, address target, uint256 amount)
        external
        whenNotPaused
        returns (bool valid)
    {
        SessionKey storage key = _keys[agent][keyId];
        if (key.validUntil == 0) revert KeyNotFound();
        if (block.timestamp > key.validUntil) revert SessionExpired();
        if (key.circuitBreaker) revert CircuitBreakerActive();
        if (amount > key.perTxLimit) revert PerTxLimitExceeded();

        // Check allowed contracts
        bool allowed = false;
        for (uint256 i = 0; i < key.allowedContracts.length; i++) {
            if (key.allowedContracts[i] == target) {
                allowed = true;
                break;
            }
        }
        if (!allowed) revert ContractNotAllowed();

        // Reset daily spending if new day
        uint256 today = block.timestamp / 1 days;
        if (today > key.lastResetDay) {
            key.dailySpent = 0;
            key.lastResetDay = today;
        }

        if (key.dailySpent + amount > key.dailySpendingLimit) revert DailyLimitExceeded();
        key.dailySpent += amount;

        // Trip circuit breaker if escalation threshold hit
        if (key.dailySpent >= key.escalationThreshold) {
            key.circuitBreaker = true;
            emit CircuitBreakerTripped(agent, keyId);
        }

        emit SessionValidated(agent, keyId, target, amount);
        return true;
    }

    /// @notice Get session key details
    /// @param agent The agent address
    /// @param keyId The key ID
    function getSessionKey(address agent, bytes32 keyId) external view returns (SessionKey memory) {
        if (_keys[agent][keyId].validUntil == 0) revert KeyNotFound();
        return _keys[agent][keyId];
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
