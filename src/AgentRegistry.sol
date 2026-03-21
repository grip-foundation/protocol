// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IAgentDID} from "./interfaces/IAgentDID.sol";

/// @title AgentRegistry - Service discovery for AI agents
/// @notice Agents register their capabilities and pricing for discovery
contract AgentRegistry is Ownable2Step, Pausable {
    struct AgentProfile {
        string[] capabilities;
        uint256 pricePerCall;
        string endpoint;
        uint256 slaSeconds;
        bool active;
    }

    IAgentDID public agentDID;
    mapping(address => AgentProfile) private _profiles;
    mapping(address => bool) private _hasProfile;

    event AgentProfileRegistered(address indexed agent, uint256 pricePerCall);
    event AgentProfileUpdated(address indexed agent);
    event AgentDeregistered(address indexed agent);

    error NoDID();
    error AlreadyRegistered();
    error NotRegistered();
    error InvalidParams();

    constructor(address _agentDID) Ownable(msg.sender) {
        agentDID = IAgentDID(_agentDID);
    }

    /// @notice Register an agent profile (requires existing DID)
    /// @param capabilities List of service capabilities
    /// @param pricePerCall Price in USDC per service call
    /// @param endpoint Off-chain service endpoint
    /// @param slaSeconds SLA response time in seconds
    function register(
        string[] calldata capabilities,
        uint256 pricePerCall,
        string calldata endpoint,
        uint256 slaSeconds
    ) external whenNotPaused {
        if (!agentDID.agentExists(msg.sender)) revert NoDID();
        if (_hasProfile[msg.sender]) revert AlreadyRegistered();
        if (capabilities.length == 0) revert InvalidParams();

        _profiles[msg.sender] = AgentProfile({
            capabilities: capabilities,
            pricePerCall: pricePerCall,
            endpoint: endpoint,
            slaSeconds: slaSeconds,
            active: true
        });
        _hasProfile[msg.sender] = true;

        emit AgentProfileRegistered(msg.sender, pricePerCall);
    }

    /// @notice Update an existing agent profile
    function updateProfile(
        string[] calldata capabilities,
        uint256 pricePerCall,
        string calldata endpoint,
        uint256 slaSeconds
    ) external whenNotPaused {
        if (!_hasProfile[msg.sender]) revert NotRegistered();

        AgentProfile storage p = _profiles[msg.sender];
        p.capabilities = capabilities;
        p.pricePerCall = pricePerCall;
        p.endpoint = endpoint;
        p.slaSeconds = slaSeconds;

        emit AgentProfileUpdated(msg.sender);
    }

    /// @notice Deregister (deactivate) an agent profile
    function deregister() external {
        if (!_hasProfile[msg.sender]) revert NotRegistered();
        _profiles[msg.sender].active = false;
        emit AgentDeregistered(msg.sender);
    }

    /// @notice Get an agent's profile
    /// @param agent The agent address
    /// @return The AgentProfile struct
    function getProfile(address agent) external view returns (AgentProfile memory) {
        if (!_hasProfile[agent]) revert NotRegistered();
        return _profiles[agent];
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
