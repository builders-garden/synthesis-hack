// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IAggregatorV3} from "./interfaces/IAggregatorV3.sol";

/// @title YieldVault
/// @notice Per-user vault that holds wstETH on Base. The owner (human) deposits principal,
///         and an agent wallet can withdraw a configurable share of accrued yield on a cooldown.
///         Yield is computed via the Chainlink wstETH/stETH exchange rate oracle.
///         Deployed as an EIP-1167 clone by YieldVaultFactory.
contract YieldVault {
    using SafeERC20 for IERC20;
    using Math for uint256;

    // ──────────────────────────────────────────────
    //  Constants
    // ──────────────────────────────────────────────

    address public constant WSTETH = 0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452;
    address public constant ORACLE = 0xB88BAc61a4Ca37C43a3725912B1f472c9A5bc061;
    uint256 public constant ORACLE_STALENESS = 90_000; // 25 hours
    uint256 public constant BPS_DENOMINATOR = 10_000;

    // ──────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────

    address public factory;
    address public owner;

    /// @notice The depositor's principal denominated in stETH (18 decimals).
    ///         Yield = totalValueInStETH - principalStETH.
    uint256 public principalStETH;

    // Agent configuration
    address public agentWallet;
    uint16 public yieldShareBps;
    uint32 public withdrawalFrequency;
    uint32 public lastAgentWithdrawal;

    // Safety
    bool public paused;
    bool public initialized;

    // Reentrancy lock (0 = unlocked, 1 = locked). Works in clones (storage starts at 0).
    uint256 private _locked;

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────

    event Deposited(uint256 wstETHAmount, uint256 newPrincipalStETH);
    event PrincipalWithdrawn(address indexed to, uint256 wstETHAmount);
    event YieldWithdrawn(address indexed to, uint256 wstETHAmount);
    event AgentWithdrawal(address indexed agent, uint256 wstETHAmount);
    event SettingsUpdated(address agent, uint16 yieldShareBps, uint32 frequency);
    event VaultPaused();
    event VaultUnpaused();

    // ──────────────────────────────────────────────
    //  Errors
    // ──────────────────────────────────────────────

    error AlreadyInitialized();
    error NotOwner();
    error NotAgent();
    error Reentrancy();
    error VaultIsPaused();
    error ZeroAmount();
    error ZeroAddress();
    error ExceedsPrincipal();
    error ExceedsYield();
    error ExceedsBudget();
    error CooldownNotElapsed();
    error StaleOracle();
    error InvalidOracleAnswer();
    error InvalidYieldShare();
    error NothingToWithdraw();

    // ──────────────────────────────────────────────
    //  Modifiers
    // ──────────────────────────────────────────────

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert VaultIsPaused();
        if (IYieldVaultFactory(factory).paused()) revert VaultIsPaused();
        _;
    }

    modifier nonReentrant() {
        if (_locked == 1) revert Reentrancy();
        _locked = 1;
        _;
        _locked = 0;
    }

    // ──────────────────────────────────────────────
    //  Initialization (called once by factory)
    // ──────────────────────────────────────────────

    function initialize(
        address _factory,
        address _owner,
        address _agent,
        uint16 _yieldShareBps,
        uint32 _frequency
    ) external {
        if (initialized) revert AlreadyInitialized();
        if (_owner == address(0)) revert ZeroAddress();
        if (_agent == address(0)) revert ZeroAddress();
        if (_yieldShareBps > BPS_DENOMINATOR) revert InvalidYieldShare();

        initialized = true;
        factory = _factory;
        owner = _owner;
        agentWallet = _agent;
        yieldShareBps = _yieldShareBps;
        withdrawalFrequency = _frequency;
    }

    // ──────────────────────────────────────────────
    //  Owner (human) functions
    // ──────────────────────────────────────────────

    /// @notice Deposit wstETH into the vault. Caller must have approved this contract.
    function deposit(uint256 wstETHAmount) external onlyOwner whenNotPaused nonReentrant {
        if (wstETHAmount == 0) revert ZeroAmount();

        uint256 currentRate = _getCurrentRate();
        principalStETH += wstETHAmount.mulDiv(currentRate, 1e18);

        IERC20(WSTETH).safeTransferFrom(msg.sender, address(this), wstETHAmount);

        emit Deposited(wstETHAmount, principalStETH);
    }

    /// @notice Withdraw wstETH that belongs to principal (does not touch yield).
    function withdrawPrincipal(uint256 wstETHAmount) external onlyOwner whenNotPaused nonReentrant {
        if (wstETHAmount == 0) revert ZeroAmount();

        uint256 currentRate = _getCurrentRate();
        uint256 principalInWstETH = principalStETH.mulDiv(1e18, currentRate);
        if (wstETHAmount > principalInWstETH) revert ExceedsPrincipal();

        principalStETH -= wstETHAmount.mulDiv(currentRate, 1e18);

        IERC20(WSTETH).safeTransfer(owner, wstETHAmount);

        emit PrincipalWithdrawn(owner, wstETHAmount);
    }

    /// @notice Withdraw accrued yield (owner has full access to yield).
    function withdrawYield(uint256 wstETHAmount) external onlyOwner whenNotPaused nonReentrant {
        if (wstETHAmount == 0) revert ZeroAmount();

        uint256 yieldWstETH = getAccruedYieldInWstETH();
        if (wstETHAmount > yieldWstETH) revert ExceedsYield();

        // principalStETH unchanged — only yield leaves
        IERC20(WSTETH).safeTransfer(owner, wstETHAmount);

        emit YieldWithdrawn(owner, wstETHAmount);
    }

    /// @notice Emergency exit: withdraw everything. Works even when paused.
    function exit() external onlyOwner nonReentrant {
        uint256 balance = IERC20(WSTETH).balanceOf(address(this));
        if (balance == 0) revert NothingToWithdraw();

        principalStETH = 0;

        IERC20(WSTETH).safeTransfer(owner, balance);

        emit PrincipalWithdrawn(owner, balance);
    }

    /// @notice Update agent wallet, yield share, and withdrawal frequency.
    function updateSettings(address _agent, uint16 _yieldShareBps, uint32 _frequency) external onlyOwner {
        if (_agent == address(0)) revert ZeroAddress();
        if (_yieldShareBps > BPS_DENOMINATOR) revert InvalidYieldShare();

        address oldAgent = agentWallet;
        agentWallet = _agent;
        yieldShareBps = _yieldShareBps;
        withdrawalFrequency = _frequency;

        // Sync factory mapping if agent changed.
        if (_agent != oldAgent) {
            IYieldVaultFactory(factory).onAgentUpdated(oldAgent, _agent);
        }

        emit SettingsUpdated(_agent, _yieldShareBps, _frequency);
    }

    function pause() external onlyOwner {
        paused = true;
        emit VaultPaused();
    }

    function unpause() external onlyOwner {
        paused = false;
        emit VaultUnpaused();
    }

    // ──────────────────────────────────────────────
    //  Agent functions
    // ──────────────────────────────────────────────

    /// @notice Agent withdraws up to `yieldShareBps` percent of accrued yield.
    ///         Subject to `withdrawalFrequency` cooldown between calls.
    function agentWithdraw(uint256 wstETHAmount) external whenNotPaused nonReentrant {
        if (msg.sender != agentWallet) revert NotAgent();
        if (wstETHAmount == 0) revert ZeroAmount();
        if (block.timestamp < uint256(lastAgentWithdrawal) + uint256(withdrawalFrequency)) {
            revert CooldownNotElapsed();
        }

        uint256 yieldWstETH = getAccruedYieldInWstETH();
        uint256 budget = yieldWstETH.mulDiv(yieldShareBps, BPS_DENOMINATOR);
        if (wstETHAmount > budget) revert ExceedsBudget();

        lastAgentWithdrawal = uint32(block.timestamp);

        // principalStETH unchanged — agent only touches yield
        IERC20(WSTETH).safeTransfer(agentWallet, wstETHAmount);

        emit AgentWithdrawal(agentWallet, wstETHAmount);
    }

    // ──────────────────────────────────────────────
    //  View functions
    // ──────────────────────────────────────────────

    /// @notice Returns accrued yield denominated in wstETH.
    function getAccruedYieldInWstETH() public view returns (uint256) {
        uint256 balance = IERC20(WSTETH).balanceOf(address(this));
        if (balance == 0) return 0;

        uint256 currentRate = _getCurrentRate();
        uint256 totalValueStETH = balance.mulDiv(currentRate, 1e18);

        if (totalValueStETH <= principalStETH) return 0;

        uint256 yieldStETH = totalValueStETH - principalStETH;
        return yieldStETH.mulDiv(1e18, currentRate);
    }

    /// @notice Returns the wstETH amount the agent can withdraw right now.
    ///         Returns 0 if the cooldown has not elapsed.
    function getAgentBudget() external view returns (uint256) {
        if (block.timestamp < uint256(lastAgentWithdrawal) + uint256(withdrawalFrequency)) return 0;

        uint256 yieldWstETH = getAccruedYieldInWstETH();
        return yieldWstETH.mulDiv(yieldShareBps, BPS_DENOMINATOR);
    }

    /// @notice Total value held in the vault, denominated in stETH.
    function getTotalValueInStETH() external view returns (uint256) {
        uint256 balance = IERC20(WSTETH).balanceOf(address(this));
        if (balance == 0) return 0;
        uint256 currentRate = _getCurrentRate();
        return balance.mulDiv(currentRate, 1e18);
    }

    /// @notice Current wstETH/stETH exchange rate from Chainlink (18 decimals).
    function getCurrentRate() external view returns (uint256) {
        return _getCurrentRate();
    }

    // ──────────────────────────────────────────────
    //  Internal
    // ──────────────────────────────────────────────

    function _getCurrentRate() internal view returns (uint256) {
        (, int256 answer,, uint256 updatedAt,) = IAggregatorV3(ORACLE).latestRoundData();
        if (answer <= 0) revert InvalidOracleAnswer();
        if (block.timestamp - updatedAt > ORACLE_STALENESS) revert StaleOracle();
        return uint256(answer);
    }
}

/// @dev Minimal interface the vault uses to interact with the factory.
interface IYieldVaultFactory {
    function paused() external view returns (bool);
    function onAgentUpdated(address oldAgent, address newAgent) external;
}
