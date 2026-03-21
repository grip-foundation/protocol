// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title GripPaymaster - Sponsors agent gas via USDC deposits
/// @notice Simple paymaster allowing owners to deposit USDC for agent gas sponsorship
contract GripPaymaster is Ownable2Step, Pausable {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;
    address public relayer;
    mapping(address => uint256) private _balances;

    event Deposited(address indexed owner, uint256 amount);
    event Withdrawn(address indexed owner, uint256 amount);
    event GasDeducted(address indexed owner, uint256 amount);
    event RelayerUpdated(address indexed newRelayer);

    error InsufficientBalance();
    error InvalidAmount();
    error UnauthorizedRelayer();
    error ZeroAddress();

    constructor(address _usdc, address _relayer) Ownable(msg.sender) {
        if (_usdc == address(0) || _relayer == address(0)) revert ZeroAddress();
        usdc = IERC20(_usdc);
        relayer = _relayer;
    }

    /// @notice Deposit USDC to sponsor gas
    /// @param amount Amount of USDC to deposit
    function deposit(uint256 amount) external whenNotPaused {
        if (amount == 0) revert InvalidAmount();
        _balances[msg.sender] += amount;
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        emit Deposited(msg.sender, amount);
    }

    /// @notice Withdraw USDC
    /// @param amount Amount to withdraw
    function withdraw(uint256 amount) external {
        if (amount == 0) revert InvalidAmount();
        if (_balances[msg.sender] < amount) revert InsufficientBalance();
        _balances[msg.sender] -= amount;
        usdc.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    /// @notice Get balance of an owner
    /// @param owner_ The owner address
    /// @return The USDC balance
    function balanceOf(address owner_) external view returns (uint256) {
        return _balances[owner_];
    }

    /// @notice Deduct gas cost from owner's balance (relayer only)
    /// @param owner_ The owner to deduct from
    /// @param amount The amount to deduct
    function deductGas(address owner_, uint256 amount) external whenNotPaused {
        if (msg.sender != relayer) revert UnauthorizedRelayer();
        if (_balances[owner_] < amount) revert InsufficientBalance();
        _balances[owner_] -= amount;
        emit GasDeducted(owner_, amount);
    }

    /// @notice Update relayer address
    /// @param _relayer New relayer address
    function setRelayer(address _relayer) external onlyOwner {
        if (_relayer == address(0)) revert ZeroAddress();
        relayer = _relayer;
        emit RelayerUpdated(_relayer);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }
}
