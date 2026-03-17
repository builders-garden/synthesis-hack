// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {YieldVault} from "./YieldVault.sol";

/// @title YieldVaultFactory
/// @notice Deploys EIP-1167 minimal-proxy YieldVault instances, one per user/team.
///         The factory owner (protocol admin) can pause all vaults globally.
contract YieldVaultFactory is Ownable {
    using Clones for address;

    // ──────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────

    address public immutable implementation;
    bool public paused;

    mapping(address => address) public vaults;
    address[] public allVaults;

    /// @notice agent address → list of vaults where it is the agent.
    mapping(address => address[]) internal _agentVaults;

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────

    event VaultCreated(address indexed owner, address indexed vault, address agent);
    event AgentUpdated(address indexed vault, address indexed oldAgent, address indexed newAgent);
    event FactoryPaused();
    event FactoryUnpaused();

    // ──────────────────────────────────────────────
    //  Errors
    // ──────────────────────────────────────────────

    error VaultAlreadyExists();
    error FactoryIsPaused();
    error ZeroAddress();
    error InvalidYieldShare();
    error NotVault();

    // ──────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────

    constructor(address _implementation) Ownable(msg.sender) {
        implementation = _implementation;
    }

    // ──────────────────────────────────────────────
    //  Vault creation
    // ──────────────────────────────────────────────

    /// @notice Deploy a new YieldVault clone for the caller.
    /// @param agent         Address of the agent wallet that can withdraw yield.
    /// @param yieldShareBps Percentage of accrued yield the agent may withdraw (basis points, 0-10 000).
    /// @param frequency     Minimum seconds between agent withdrawals.
    /// @return vault        Address of the newly created vault.
    function createVault(
        address agent,
        uint16 yieldShareBps,
        uint32 frequency
    ) external returns (address vault) {
        if (paused) revert FactoryIsPaused();
        if (vaults[msg.sender] != address(0)) revert VaultAlreadyExists();
        if (agent == address(0)) revert ZeroAddress();
        if (yieldShareBps > 10_000) revert InvalidYieldShare();

        vault = implementation.clone();
        YieldVault(vault).initialize(address(this), msg.sender, agent, yieldShareBps, frequency);

        vaults[msg.sender] = vault;
        allVaults.push(vault);
        _agentVaults[agent].push(vault);

        emit VaultCreated(msg.sender, vault, agent);
    }

    // ──────────────────────────────────────────────
    //  Admin
    // ──────────────────────────────────────────────

    function pause() external onlyOwner {
        paused = true;
        emit FactoryPaused();
    }

    function unpause() external onlyOwner {
        paused = false;
        emit FactoryUnpaused();
    }

    // ──────────────────────────────────────────────
    //  Agent mapping sync (called by vaults)
    // ──────────────────────────────────────────────

    /// @notice Called by a vault when its agent is changed via updateSettings.
    function onAgentUpdated(address oldAgent, address newAgent) external {
        // Only registered vaults may call this.
        // We check that msg.sender is a known vault by looking up its owner.
        address vaultOwner = YieldVault(msg.sender).owner();
        if (vaults[vaultOwner] != msg.sender) revert NotVault();

        // Remove vault from old agent's list.
        _removeAgentVault(oldAgent, msg.sender);

        // Add vault to new agent's list.
        _agentVaults[newAgent].push(msg.sender);

        emit AgentUpdated(msg.sender, oldAgent, newAgent);
    }

    // ──────────────────────────────────────────────
    //  Views
    // ──────────────────────────────────────────────

    function totalVaults() external view returns (uint256) {
        return allVaults.length;
    }

    /// @notice Returns all vaults where `agent` is the current agent wallet.
    function getAgentVaults(address agent) external view returns (address[] memory) {
        return _agentVaults[agent];
    }

    // ──────────────────────────────────────────────
    //  Internal
    // ──────────────────────────────────────────────

    function _removeAgentVault(address agent, address vault) internal {
        address[] storage arr = _agentVaults[agent];
        uint256 len = arr.length;
        for (uint256 i = 0; i < len; i++) {
            if (arr[i] == vault) {
                arr[i] = arr[len - 1];
                arr.pop();
                return;
            }
        }
    }
}
