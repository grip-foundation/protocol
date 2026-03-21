// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IAgentDID - Interface for the Agent DID Registry
interface IAgentDID {
    struct AgentInfo {
        address createdBy;
        string modelVersion;
        bytes32[] skillset;
        uint256 operationalSince;
        uint256 reputationScore;
        uint256 totalTxs;
        uint256 successRate; // basis points 0-10000
    }

    event AgentRegistered(address indexed agent, address indexed creator, string modelVersion);
    event AgentUpdated(address indexed agent, string modelVersion);
    event ReputationUpdated(address indexed agent, uint256 newScore, uint256 totalTxs, uint256 successRate);

    error AgentAlreadyRegistered();
    error AgentNotFound();
    error NotAgentOwner();
    error UnauthorizedCaller();

    function registerAgent(string calldata modelVersion, bytes32[] calldata skillset) external;
    function updateAgent(string calldata modelVersion, bytes32[] calldata skillset) external;
    function getAgent(address agent) external view returns (AgentInfo memory);
    function updateReputation(address agent, bool success) external;
    function agentExists(address agent) external view returns (bool);
}
