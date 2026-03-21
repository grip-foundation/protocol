// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IAgentDID} from "./interfaces/IAgentDID.sol";

/// @title AgentDID - On-chain identity registry for AI agents
/// @notice Manages agent DIDs with reputation tracking on Base L2
contract AgentDID is IAgentDID, Ownable2Step, Pausable {
    mapping(address => AgentInfo) private _agents;
    mapping(address => bool) private _registered;
    address public escrowContract;

    event EscrowContractSet(address indexed escrow);

    error ZeroAddress();

    constructor() Ownable(msg.sender) {}

    /// @notice Register a new agent DID for msg.sender
    /// @param modelVersion The AI model version string
    /// @param skillset Array of skill identifiers
    function registerAgent(string calldata modelVersion, bytes32[] calldata skillset) external whenNotPaused {
        if (_registered[msg.sender]) revert AgentAlreadyRegistered();

        _agents[msg.sender] = AgentInfo({
            createdBy: msg.sender,
            modelVersion: modelVersion,
            skillset: skillset,
            operationalSince: block.timestamp,
            reputationScore: 5000, // start at 50%
            totalTxs: 0,
            successRate: 10000 // 100% until proven otherwise
        });
        _registered[msg.sender] = true;

        emit AgentRegistered(msg.sender, msg.sender, modelVersion);
    }

    /// @notice Update an existing agent's metadata
    /// @param modelVersion New model version
    /// @param skillset New skillset
    function updateAgent(string calldata modelVersion, bytes32[] calldata skillset) external whenNotPaused {
        if (!_registered[msg.sender]) revert AgentNotFound();
        if (_agents[msg.sender].createdBy != msg.sender) revert NotAgentOwner();

        _agents[msg.sender].modelVersion = modelVersion;
        _agents[msg.sender].skillset = skillset;

        emit AgentUpdated(msg.sender, modelVersion);
    }

    /// @notice Get agent info
    /// @param agent The agent address
    /// @return The AgentInfo struct
    function getAgent(address agent) external view returns (AgentInfo memory) {
        if (!_registered[agent]) revert AgentNotFound();
        return _agents[agent];
    }

    /// @notice Check if an agent exists
    /// @param agent The agent address
    /// @return True if registered
    function agentExists(address agent) external view returns (bool) {
        return _registered[agent];
    }

    /// @notice Update agent reputation — only callable by ServiceEscrow
    /// @param agent The agent address
    /// @param success Whether the transaction was successful
    function updateReputation(address agent, bool success) external whenNotPaused {
        if (msg.sender != escrowContract) revert UnauthorizedCaller();
        if (!_registered[agent]) revert AgentNotFound();

        AgentInfo storage info = _agents[agent];
        info.totalTxs++;

        uint256 successCount = (info.successRate * (info.totalTxs - 1)) / 10000;
        if (success) successCount++;
        info.successRate = (successCount * 10000) / info.totalTxs;

        // EMA reputation: 90% old + 10% new signal
        uint256 signal = success ? 10000 : 0;
        info.reputationScore = (info.reputationScore * 9 + signal) / 10;

        emit ReputationUpdated(agent, info.reputationScore, info.totalTxs, info.successRate);
    }

    /// @notice Set the authorized escrow contract
    /// @param _escrow The escrow contract address
    function setEscrowContract(address _escrow) external onlyOwner {
        if (_escrow == address(0)) revert ZeroAddress();
        escrowContract = _escrow;
        emit EscrowContractSet(_escrow);
    }

    /// @notice Pause the contract
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpause the contract
    function unpause() external onlyOwner {
        _unpause();
    }
}
