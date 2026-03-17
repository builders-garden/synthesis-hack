// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {YieldVault, IYieldVaultFactory} from "../src/YieldVault.sol";
import {YieldVaultFactory} from "../src/YieldVaultFactory.sol";
import {IAggregatorV3} from "../src/interfaces/IAggregatorV3.sol";

/// @dev Base-fork integration tests for YieldVault + YieldVaultFactory.
///      Run with:  forge test --fork-url $BASE_RPC_URL -vvv
contract YieldVaultTest is Test {
    // ── Base mainnet addresses ──────────────────
    address constant WSTETH = 0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452;
    address constant ORACLE = 0xB88BAc61a4Ca37C43a3725912B1f472c9A5bc061;

    // ── Actors ──────────────────────────────────
    address admin    = makeAddr("admin");
    address user     = makeAddr("user");
    address agent    = makeAddr("agent");
    address stranger = makeAddr("stranger");

    // ── Contracts ───────────────────────────────
    YieldVaultFactory factory;
    YieldVault vault;

    // ── Snapshot ────────────────────────────────
    uint256 initialRate;

    // ────────────────────────────────────────────
    //  Setup
    // ────────────────────────────────────────────

    function setUp() public {
        vm.createSelectFork(vm.envString("BASE_RPC_URL"));

        // Deploy protocol
        vm.startPrank(admin);
        YieldVault implementation = new YieldVault();
        factory = new YieldVaultFactory(address(implementation));
        vm.stopPrank();

        // Create a vault for `user` (50 % yield share, 7-day cooldown)
        vm.prank(user);
        address vaultAddr = factory.createVault(agent, 5_000, 7 days);
        vault = YieldVault(vaultAddr);

        // Fund user
        deal(WSTETH, user, 100 ether);

        // Store live oracle rate for assertions
        initialRate = vault.getCurrentRate();
    }

    // ────────────────────────────────────────────
    //  Helpers
    // ────────────────────────────────────────────

    /// @dev Overrides the Chainlink oracle to return a fixed rate.
    function _mockRate(uint256 rate) internal {
        vm.mockCall(
            ORACLE,
            abi.encodeWithSelector(IAggregatorV3.latestRoundData.selector),
            abi.encode(uint80(1), int256(rate), block.timestamp, block.timestamp, uint80(1))
        );
    }

    /// @dev Deposits `amount` wstETH into `vault` as `user`.
    function _deposit(uint256 amount) internal {
        vm.startPrank(user);
        IERC20(WSTETH).approve(address(vault), amount);
        vault.deposit(amount);
        vm.stopPrank();
    }

    // ════════════════════════════════════════════
    //  Factory tests
    // ════════════════════════════════════════════

    function test_factoryDeployment() public view {
        assertEq(factory.owner(), admin);
        assertFalse(factory.paused());
        assertEq(factory.totalVaults(), 1);
    }

    function test_createVault() public {
        address newUser = makeAddr("newUser");
        vm.prank(newUser);
        address v = factory.createVault(agent, 3_000, 1 days);

        assertEq(factory.vaults(newUser), v);
        assertEq(factory.totalVaults(), 2);

        YieldVault nv = YieldVault(v);
        assertEq(nv.owner(), newUser);
        assertEq(nv.agentWallet(), agent);
        assertEq(nv.yieldShareBps(), 3_000);
        assertEq(nv.withdrawalFrequency(), 1 days);
    }

    function test_cannotCreateDuplicateVault() public {
        vm.prank(user);
        vm.expectRevert(YieldVaultFactory.VaultAlreadyExists.selector);
        factory.createVault(agent, 5_000, 7 days);
    }

    function test_cannotCreateVaultWhenFactoryPaused() public {
        vm.prank(admin);
        factory.pause();

        vm.prank(makeAddr("newUser"));
        vm.expectRevert(YieldVaultFactory.FactoryIsPaused.selector);
        factory.createVault(agent, 5_000, 7 days);
    }

    function test_factoryPauseOnlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert();
        factory.pause();
    }

    // ════════════════════════════════════════════
    //  Vault initialisation
    // ════════════════════════════════════════════

    function test_vaultInitialization() public view {
        assertEq(vault.owner(), user);
        assertEq(vault.agentWallet(), agent);
        assertEq(vault.yieldShareBps(), 5_000);
        assertEq(vault.withdrawalFrequency(), 7 days);
        assertEq(vault.principalStETH(), 0);
        assertFalse(vault.paused());
    }

    function test_cannotReinitialize() public {
        vm.expectRevert(YieldVault.AlreadyInitialized.selector);
        vault.initialize(address(factory), user, agent, 5_000, 7 days);
    }

    // ════════════════════════════════════════════
    //  Deposits
    // ════════════════════════════════════════════

    function test_deposit() public {
        _deposit(10 ether);

        assertEq(IERC20(WSTETH).balanceOf(address(vault)), 10 ether);

        uint256 expectedPrincipal = (uint256(10 ether) * initialRate) / 1e18;
        assertApproxEqAbs(vault.principalStETH(), expectedPrincipal, 1);
    }

    function test_depositMultiple() public {
        _deposit(10 ether);
        uint256 p1 = vault.principalStETH();

        _deposit(5 ether);
        uint256 expectedAdd = (uint256(5 ether) * initialRate) / 1e18;
        assertApproxEqAbs(vault.principalStETH(), p1 + expectedAdd, 1);
    }

    function test_depositZeroReverts() public {
        vm.prank(user);
        vm.expectRevert(YieldVault.ZeroAmount.selector);
        vault.deposit(0);
    }

    function test_depositOnlyOwner() public {
        deal(WSTETH, stranger, 10 ether);
        vm.startPrank(stranger);
        IERC20(WSTETH).approve(address(vault), 10 ether);
        vm.expectRevert(YieldVault.NotOwner.selector);
        vault.deposit(10 ether);
        vm.stopPrank();
    }

    // ════════════════════════════════════════════
    //  Yield accrual
    // ════════════════════════════════════════════

    function test_noYieldRightAfterDeposit() public {
        _deposit(10 ether);
        assertEq(vault.getAccruedYieldInWstETH(), 0);
    }

    function test_yieldAccrual() public {
        _deposit(10 ether);

        // Simulate 5 % rate increase
        uint256 newRate = initialRate * 105 / 100;
        _mockRate(newRate);

        uint256 yield_ = vault.getAccruedYieldInWstETH();
        assertTrue(yield_ > 0);

        // Manual check
        uint256 yieldStETH = 10 ether * (newRate - initialRate) / 1e18;
        uint256 expectedYieldWstETH = yieldStETH * 1e18 / newRate;
        assertApproxEqAbs(yield_, expectedYieldWstETH, 2);
    }

    function test_noYieldWhenRateDecreases() public {
        _deposit(10 ether);

        uint256 lowerRate = initialRate * 99 / 100;
        _mockRate(lowerRate);

        assertEq(vault.getAccruedYieldInWstETH(), 0);
    }

    // ════════════════════════════════════════════
    //  Owner withdraw yield
    // ════════════════════════════════════════════

    function test_ownerWithdrawYield() public {
        _deposit(10 ether);

        uint256 newRate = initialRate * 105 / 100;
        _mockRate(newRate);

        uint256 yield_ = vault.getAccruedYieldInWstETH();
        uint256 balBefore = IERC20(WSTETH).balanceOf(user);
        uint256 principalBefore = vault.principalStETH();

        vm.prank(user);
        vault.withdrawYield(yield_);

        assertEq(vault.principalStETH(), principalBefore);
        assertEq(IERC20(WSTETH).balanceOf(user), balBefore + yield_);
        assertEq(vault.getAccruedYieldInWstETH(), 0);
    }

    function test_ownerWithdrawPartialYield() public {
        _deposit(10 ether);

        uint256 newRate = initialRate * 105 / 100;
        _mockRate(newRate);

        uint256 totalYield = vault.getAccruedYieldInWstETH();
        uint256 half = totalYield / 2;

        vm.prank(user);
        vault.withdrawYield(half);

        assertApproxEqAbs(vault.getAccruedYieldInWstETH(), totalYield - half, 1);
    }

    function test_withdrawYieldExceedsReverts() public {
        _deposit(10 ether);

        uint256 newRate = initialRate * 105 / 100;
        _mockRate(newRate);

        uint256 yield_ = vault.getAccruedYieldInWstETH();

        vm.prank(user);
        vm.expectRevert(YieldVault.ExceedsYield.selector);
        vault.withdrawYield(yield_ + 1);
    }

    // ════════════════════════════════════════════
    //  Owner withdraw principal
    // ════════════════════════════════════════════

    function test_ownerWithdrawPrincipal() public {
        _deposit(10 ether);

        uint256 balBefore = IERC20(WSTETH).balanceOf(user);

        vm.prank(user);
        vault.withdrawPrincipal(5 ether);

        assertEq(IERC20(WSTETH).balanceOf(user), balBefore + 5 ether);

        uint256 expectedReduction = 5 ether * initialRate / 1e18;
        uint256 originalPrincipal = 10 ether * initialRate / 1e18;
        assertApproxEqAbs(vault.principalStETH(), originalPrincipal - expectedReduction, 1);
    }

    function test_withdrawPrincipalPreservesYield() public {
        _deposit(10 ether);

        uint256 newRate = initialRate * 105 / 100;
        _mockRate(newRate);

        uint256 yieldBefore = vault.getAccruedYieldInWstETH();

        // Withdraw half of principal (in wstETH terms)
        uint256 principalWstETH = vault.principalStETH() * 1e18 / newRate;
        uint256 halfP = principalWstETH / 2;

        vm.prank(user);
        vault.withdrawPrincipal(halfP);

        uint256 yieldAfter = vault.getAccruedYieldInWstETH();
        assertApproxEqAbs(yieldAfter, yieldBefore, 2);
    }

    function test_withdrawPrincipalExceedsReverts() public {
        _deposit(10 ether);

        vm.prank(user);
        vm.expectRevert(YieldVault.ExceedsPrincipal.selector);
        vault.withdrawPrincipal(11 ether);
    }

    // ════════════════════════════════════════════
    //  Exit
    // ════════════════════════════════════════════

    function test_exit() public {
        _deposit(10 ether);

        uint256 balBefore = IERC20(WSTETH).balanceOf(user);

        vm.prank(user);
        vault.exit();

        assertEq(IERC20(WSTETH).balanceOf(user), balBefore + 10 ether);
        assertEq(IERC20(WSTETH).balanceOf(address(vault)), 0);
        assertEq(vault.principalStETH(), 0);
    }

    function test_exitEmptyVaultReverts() public {
        vm.prank(user);
        vm.expectRevert(YieldVault.NothingToWithdraw.selector);
        vault.exit();
    }

    function test_exitWorksWhenPaused() public {
        _deposit(10 ether);

        vm.startPrank(user);
        vault.pause();
        vault.exit();
        vm.stopPrank();

        assertEq(IERC20(WSTETH).balanceOf(address(vault)), 0);
    }

    // ════════════════════════════════════════════
    //  Agent withdrawal
    // ════════════════════════════════════════════

    function test_agentWithdraw() public {
        _deposit(10 ether);

        uint256 newRate = initialRate * 105 / 100;
        _mockRate(newRate);

        // Advance past cooldown
        vm.warp(block.timestamp + 7 days);
        _mockRate(newRate); // keep oracle fresh after warp

        uint256 budget = vault.getAgentBudget();
        assertTrue(budget > 0);

        uint256 agentBal = IERC20(WSTETH).balanceOf(agent);
        uint256 principalBefore = vault.principalStETH();

        vm.prank(agent);
        vault.agentWithdraw(budget);

        assertEq(IERC20(WSTETH).balanceOf(agent), agentBal + budget);
        assertEq(vault.principalStETH(), principalBefore);
    }

    function test_agentWithdrawPartial() public {
        _deposit(10 ether);

        uint256 newRate = initialRate * 105 / 100;
        _mockRate(newRate);

        vm.warp(block.timestamp + 7 days);
        _mockRate(newRate);

        uint256 budget = vault.getAgentBudget();

        vm.prank(agent);
        vault.agentWithdraw(budget / 2);

        assertEq(IERC20(WSTETH).balanceOf(agent), budget / 2);
    }

    function test_agentCooldownEnforced() public {
        _deposit(10 ether);

        uint256 newRate = initialRate * 105 / 100;
        _mockRate(newRate);

        vm.warp(block.timestamp + 7 days);
        _mockRate(newRate);

        uint256 budget = vault.getAgentBudget();

        vm.prank(agent);
        vault.agentWithdraw(budget / 2);

        // Immediately try again
        vm.prank(agent);
        vm.expectRevert(YieldVault.CooldownNotElapsed.selector);
        vault.agentWithdraw(1);
    }

    function test_agentCanWithdrawAfterCooldownResets() public {
        _deposit(10 ether);

        uint256 newRate = initialRate * 105 / 100;
        _mockRate(newRate);

        vm.warp(block.timestamp + 7 days);
        _mockRate(newRate);

        uint256 budget = vault.getAgentBudget();
        vm.prank(agent);
        vault.agentWithdraw(budget / 4);

        // Wait another period
        vm.warp(block.timestamp + 7 days);
        _mockRate(newRate);

        budget = vault.getAgentBudget();
        assertTrue(budget > 0);

        vm.prank(agent);
        vault.agentWithdraw(budget / 4);
    }

    function test_agentExceedsBudgetReverts() public {
        _deposit(10 ether);

        uint256 newRate = initialRate * 105 / 100;
        _mockRate(newRate);

        vm.warp(block.timestamp + 7 days);
        _mockRate(newRate);

        uint256 budget = vault.getAgentBudget();

        vm.prank(agent);
        vm.expectRevert(YieldVault.ExceedsBudget.selector);
        vault.agentWithdraw(budget + 1);
    }

    function test_agentNotAuthorizedReverts() public {
        _deposit(10 ether);

        uint256 newRate = initialRate * 105 / 100;
        _mockRate(newRate);

        vm.warp(block.timestamp + 7 days);
        _mockRate(newRate);

        vm.prank(stranger);
        vm.expectRevert(YieldVault.NotAgent.selector);
        vault.agentWithdraw(1);
    }

    function test_agentBudgetZeroDuringCooldown() public {
        _deposit(10 ether);

        uint256 newRate = initialRate * 105 / 100;
        _mockRate(newRate);

        vm.warp(block.timestamp + 7 days);
        _mockRate(newRate);

        uint256 budget = vault.getAgentBudget();
        vm.prank(agent);
        vault.agentWithdraw(budget / 2);

        // Budget should be 0 during cooldown
        assertEq(vault.getAgentBudget(), 0);
    }

    // ════════════════════════════════════════════
    //  Budget grows over time
    // ════════════════════════════════════════════

    function test_budgetGrowsAsYieldAccrues() public {
        _deposit(10 ether);

        // 2 % yield
        _mockRate(initialRate * 102 / 100);
        vm.warp(block.timestamp + 7 days);
        _mockRate(initialRate * 102 / 100);
        uint256 budget1 = vault.getAgentBudget();

        // 5 % yield
        _mockRate(initialRate * 105 / 100);
        uint256 budget2 = vault.getAgentBudget();

        assertTrue(budget2 > budget1);
    }

    // ════════════════════════════════════════════
    //  Settings
    // ════════════════════════════════════════════

    function test_updateSettings() public {
        address newAgent = makeAddr("newAgent");

        vm.prank(user);
        vault.updateSettings(newAgent, 7_500, 1 days);

        assertEq(vault.agentWallet(), newAgent);
        assertEq(vault.yieldShareBps(), 7_500);
        assertEq(vault.withdrawalFrequency(), 1 days);
    }

    function test_updateSettingsOnlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert(YieldVault.NotOwner.selector);
        vault.updateSettings(agent, 5_000, 7 days);
    }

    function test_updateSettingsInvalidBpsReverts() public {
        vm.prank(user);
        vm.expectRevert(YieldVault.InvalidYieldShare.selector);
        vault.updateSettings(agent, 10_001, 7 days);
    }

    function test_updateSettingsZeroAgentReverts() public {
        vm.prank(user);
        vm.expectRevert(YieldVault.ZeroAddress.selector);
        vault.updateSettings(address(0), 5_000, 7 days);
    }

    // ════════════════════════════════════════════
    //  Pause
    // ════════════════════════════════════════════

    function test_vaultPauseBlocksOperations() public {
        _deposit(10 ether);

        vm.prank(user);
        vault.pause();

        vm.startPrank(user);
        vm.expectRevert(YieldVault.VaultIsPaused.selector);
        vault.deposit(1 ether);

        vm.expectRevert(YieldVault.VaultIsPaused.selector);
        vault.withdrawPrincipal(1 ether);

        vm.expectRevert(YieldVault.VaultIsPaused.selector);
        vault.withdrawYield(1);
        vm.stopPrank();

        vm.prank(agent);
        vm.expectRevert(YieldVault.VaultIsPaused.selector);
        vault.agentWithdraw(1);
    }

    function test_vaultUnpauseResumesOperations() public {
        vm.startPrank(user);
        vault.pause();
        vault.unpause();

        IERC20(WSTETH).approve(address(vault), 1 ether);
        vault.deposit(1 ether); // should succeed
        vm.stopPrank();
    }

    function test_factoryPauseAffectsVault() public {
        _deposit(10 ether);

        vm.prank(admin);
        factory.pause();

        vm.prank(user);
        vm.expectRevert(YieldVault.VaultIsPaused.selector);
        vault.deposit(1 ether);
    }

    // ════════════════════════════════════════════
    //  Oracle edge cases
    // ════════════════════════════════════════════

    function test_staleOracleReverts() public {
        vm.mockCall(
            ORACLE,
            abi.encodeWithSelector(IAggregatorV3.latestRoundData.selector),
            abi.encode(uint80(1), int256(initialRate), block.timestamp - 100_000, block.timestamp - 100_000, uint80(1))
        );

        vm.startPrank(user);
        IERC20(WSTETH).approve(address(vault), 10 ether);
        vm.expectRevert(YieldVault.StaleOracle.selector);
        vault.deposit(10 ether);
        vm.stopPrank();
    }

    function test_invalidOracleAnswerReverts() public {
        vm.mockCall(
            ORACLE,
            abi.encodeWithSelector(IAggregatorV3.latestRoundData.selector),
            abi.encode(uint80(1), int256(0), block.timestamp, block.timestamp, uint80(1))
        );

        vm.startPrank(user);
        IERC20(WSTETH).approve(address(vault), 10 ether);
        vm.expectRevert(YieldVault.InvalidOracleAnswer.selector);
        vault.deposit(10 ether);
        vm.stopPrank();
    }

    // ════════════════════════════════════════════
    //  Integration – full lifecycle
    // ════════════════════════════════════════════

    function test_fullLifecycle() public {
        // 1. User deposits 50 wstETH
        _deposit(50 ether);
        assertEq(vault.getAccruedYieldInWstETH(), 0);

        // 2. Yield accrues (3 %)
        uint256 newRate = initialRate * 103 / 100;
        _mockRate(newRate);

        uint256 totalYield = vault.getAccruedYieldInWstETH();
        assertTrue(totalYield > 0);

        // 3. Agent waits for cooldown then withdraws (50 % of yield)
        vm.warp(block.timestamp + 7 days);
        _mockRate(newRate);

        uint256 agentBudget = vault.getAgentBudget();
        assertApproxEqAbs(agentBudget, totalYield / 2, 2);

        vm.prank(agent);
        vault.agentWithdraw(agentBudget);
        assertEq(IERC20(WSTETH).balanceOf(agent), agentBudget);

        // 4. Owner withdraws remaining yield
        uint256 remainingYield = vault.getAccruedYieldInWstETH();
        vm.prank(user);
        vault.withdrawYield(remainingYield);

        // 5. Owner exits (all principal)
        vm.prank(user);
        vault.exit();

        assertEq(IERC20(WSTETH).balanceOf(address(vault)), 0);
        assertEq(vault.principalStETH(), 0);
    }

    // ════════════════════════════════════════════
    //  Agent vault discovery
    // ════════════════════════════════════════════

    function test_getAgentVaultsAfterCreate() public view {
        address[] memory vaults = factory.getAgentVaults(agent);
        assertEq(vaults.length, 1);
        assertEq(vaults[0], address(vault));
    }

    function test_getAgentVaultsMultipleOwners() public {
        // A second user creates a vault with the same agent.
        address user2 = makeAddr("user2");
        vm.prank(user2);
        address vault2 = factory.createVault(agent, 3_000, 1 days);

        address[] memory vaults = factory.getAgentVaults(agent);
        assertEq(vaults.length, 2);
        assertEq(vaults[0], address(vault));
        assertEq(vaults[1], vault2);
    }

    function test_agentMappingSyncsOnUpdateSettings() public {
        address newAgent = makeAddr("newAgent");

        // Before: original agent has 1 vault, newAgent has 0.
        assertEq(factory.getAgentVaults(agent).length, 1);
        assertEq(factory.getAgentVaults(newAgent).length, 0);

        vm.prank(user);
        vault.updateSettings(newAgent, 5_000, 7 days);

        // After: original agent has 0 vaults, newAgent has 1.
        assertEq(factory.getAgentVaults(agent).length, 0);
        address[] memory newVaults = factory.getAgentVaults(newAgent);
        assertEq(newVaults.length, 1);
        assertEq(newVaults[0], address(vault));
    }

    function test_updateSettingsSameAgentNoDoubleEntry() public {
        // Updating settings without changing the agent should not duplicate.
        vm.prank(user);
        vault.updateSettings(agent, 7_500, 1 days);

        address[] memory vaults = factory.getAgentVaults(agent);
        assertEq(vaults.length, 1);
    }

    function test_onAgentUpdatedRevertsForNonVault() public {
        vm.prank(stranger);
        vm.expectRevert();
        factory.onAgentUpdated(agent, makeAddr("fake"));
    }

    // ════════════════════════════════════════════
    //  Integration – full lifecycle
    // ════════════════════════════════════════════

    function test_multipleDepositsAndYieldCycles() public {
        // First deposit
        _deposit(20 ether);

        // Yield accrues 2 %
        uint256 rate2 = initialRate * 102 / 100;
        _mockRate(rate2);
        uint256 yield1 = vault.getAccruedYieldInWstETH();
        assertTrue(yield1 > 0);

        // Second deposit (top-up) — existing yield preserved
        deal(WSTETH, user, 100 ether); // refund user
        _deposit(30 ether);

        // Yield should still be roughly the same (new deposit at current rate adds 0 yield)
        uint256 yieldAfterTopUp = vault.getAccruedYieldInWstETH();
        assertApproxEqAbs(yieldAfterTopUp, yield1, 2);

        // More yield accrues (rate goes to +5 %)
        uint256 rate5 = initialRate * 105 / 100;
        _mockRate(rate5);

        uint256 yield2 = vault.getAccruedYieldInWstETH();
        assertTrue(yield2 > yieldAfterTopUp);

        // Agent claims
        vm.warp(block.timestamp + 7 days);
        _mockRate(rate5);

        uint256 budget = vault.getAgentBudget();
        vm.prank(agent);
        vault.agentWithdraw(budget);

        // Owner exits
        vm.prank(user);
        vault.exit();

        assertEq(IERC20(WSTETH).balanceOf(address(vault)), 0);
    }
}
