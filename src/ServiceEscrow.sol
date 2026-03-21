// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IAgentDID} from "./interfaces/IAgentDID.sol";

/// @title ServiceEscrow - Core escrow contract for agent-to-agent payments
/// @notice Handles USDC escrow with reputation updates for AI agent services
contract ServiceEscrow is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum EscrowStatus { Created, Released, Refunded, Disputed }

    struct Escrow {
        address payer;
        address payee;
        uint256 amount;
        bytes32 serviceId;
        bytes32 commitHash;
        uint256 timeout;
        uint256 createdAt;
        EscrowStatus status;
    }

    IERC20 public immutable usdc;
    IAgentDID public agentDID;
    address public treasury;
    uint256 public constant FEE_BPS = 10; // 0.1%
    uint256 public constant BPS_DENOMINATOR = 10000;
    uint256 public nextEscrowId;

    mapping(uint256 => Escrow) public escrows;

    event EscrowCreated(uint256 indexed escrowId, address indexed payer, address indexed payee, uint256 amount, bytes32 serviceId);
    event EscrowReleased(uint256 indexed escrowId, uint256 fee);
    event EscrowRefunded(uint256 indexed escrowId);
    event EscrowDisputed(uint256 indexed escrowId, address indexed disputedBy);
    event DisputeResolved(uint256 indexed escrowId, bool payerWins);
    event TreasuryUpdated(address indexed newTreasury);
    event AgentDIDUpdated(address indexed newAgentDID);

    error InvalidAmount();
    error InvalidTimeout();
    error ZeroAddress();
    error NotPayer();
    error NotParty();
    error EscrowNotCreated();
    error EscrowNotDisputed();
    error TimeoutNotReached();
    error TimeoutReached();

    constructor(address _usdc, address _agentDID, address _treasury) Ownable(msg.sender) {
        if (_usdc == address(0) || _agentDID == address(0) || _treasury == address(0)) revert ZeroAddress();
        usdc = IERC20(_usdc);
        agentDID = IAgentDID(_agentDID);
        treasury = _treasury;
    }

    /// @notice Create a new escrow
    /// @param payee The service provider address
    /// @param amount USDC amount to escrow
    /// @param serviceId Service identifier
    /// @param commitHash Hash of the service commitment
    /// @param timeout Duration in seconds before refund is possible
    /// @return escrowId The new escrow ID
    function createEscrow(
        address payee,
        uint256 amount,
        bytes32 serviceId,
        bytes32 commitHash,
        uint256 timeout
    ) external whenNotPaused nonReentrant returns (uint256 escrowId) {
        if (amount == 0) revert InvalidAmount();
        if (timeout == 0) revert InvalidTimeout();
        if (payee == address(0)) revert ZeroAddress();

        escrowId = nextEscrowId++;
        escrows[escrowId] = Escrow({
            payer: msg.sender,
            payee: payee,
            amount: amount,
            serviceId: serviceId,
            commitHash: commitHash,
            timeout: timeout,
            createdAt: block.timestamp,
            status: EscrowStatus.Created
        });

        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit EscrowCreated(escrowId, msg.sender, payee, amount, serviceId);
    }

    /// @notice Release escrow to payee (payer confirms delivery)
    /// @param escrowId The escrow to release
    function releaseEscrow(uint256 escrowId) external whenNotPaused nonReentrant {
        Escrow storage e = escrows[escrowId];
        if (e.status != EscrowStatus.Created) revert EscrowNotCreated();
        if (msg.sender != e.payer) revert NotPayer();

        e.status = EscrowStatus.Released;

        uint256 fee = (e.amount * FEE_BPS) / BPS_DENOMINATOR;
        uint256 payout = e.amount - fee;

        usdc.safeTransfer(e.payee, payout);
        if (fee > 0) usdc.safeTransfer(treasury, fee);

        // Update reputation for both parties
        agentDID.updateReputation(e.payee, true);
        agentDID.updateReputation(e.payer, true);

        emit EscrowReleased(escrowId, fee);
    }

    /// @notice Refund escrow after timeout
    /// @param escrowId The escrow to refund
    function refundOnTimeout(uint256 escrowId) external whenNotPaused nonReentrant {
        Escrow storage e = escrows[escrowId];
        if (e.status != EscrowStatus.Created) revert EscrowNotCreated();
        if (block.timestamp < e.createdAt + e.timeout) revert TimeoutNotReached();

        e.status = EscrowStatus.Refunded;
        usdc.safeTransfer(e.payer, e.amount);

        agentDID.updateReputation(e.payee, false);

        emit EscrowRefunded(escrowId);
    }

    /// @notice Dispute an escrow
    /// @param escrowId The escrow to dispute
    function dispute(uint256 escrowId) external whenNotPaused {
        Escrow storage e = escrows[escrowId];
        if (e.status != EscrowStatus.Created) revert EscrowNotCreated();
        if (msg.sender != e.payer && msg.sender != e.payee) revert NotParty();

        e.status = EscrowStatus.Disputed;
        emit EscrowDisputed(escrowId, msg.sender);
    }

    /// @notice Resolve a dispute (arbitrator only)
    /// @param escrowId The disputed escrow
    /// @param payerWins True if payer wins the dispute
    function resolveDispute(uint256 escrowId, bool payerWins) external onlyOwner nonReentrant {
        Escrow storage e = escrows[escrowId];
        if (e.status != EscrowStatus.Disputed) revert EscrowNotDisputed();

        if (payerWins) {
            e.status = EscrowStatus.Refunded;
            usdc.safeTransfer(e.payer, e.amount);
            agentDID.updateReputation(e.payee, false);
        } else {
            e.status = EscrowStatus.Released;
            uint256 fee = (e.amount * FEE_BPS) / BPS_DENOMINATOR;
            uint256 payout = e.amount - fee;
            usdc.safeTransfer(e.payee, payout);
            if (fee > 0) usdc.safeTransfer(treasury, fee);
            agentDID.updateReputation(e.payee, true);
            agentDID.updateReputation(e.payer, true);
        }

        emit DisputeResolved(escrowId, payerWins);
    }

    /// @notice Update treasury address
    /// @param _treasury New treasury address
    function setTreasury(address _treasury) external onlyOwner {
        if (_treasury == address(0)) revert ZeroAddress();
        treasury = _treasury;
        emit TreasuryUpdated(_treasury);
    }

    /// @notice Update AgentDID contract reference
    /// @param _agentDID New AgentDID address
    function setAgentDID(address _agentDID) external onlyOwner {
        if (_agentDID == address(0)) revert ZeroAddress();
        agentDID = IAgentDID(_agentDID);
        emit AgentDIDUpdated(_agentDID);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
