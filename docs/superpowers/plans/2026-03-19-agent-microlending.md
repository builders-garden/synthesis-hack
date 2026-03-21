# Agent Microlending Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a P2P non-collateralized microlending protocol where agents (EVM addresses) can request, fill, and repay loans — all readable on-chain without an indexer.

**Architecture:** Single contract `AgentMicrolending.sol` that stores all loan requests in an array with mappings for per-borrower and per-lender lookups. Loans go through a lifecycle: `Open → Funded → Repaid | Defaulted` (plus `Cancelled` for borrower-cancelled unfunded requests). All state is queryable via view functions (no subgraph needed). Uses native token (CELO) for simplicity — no ERC20 dependency needed for the MVP.

**Tech Stack:** Solidity 0.8.24, Foundry (forge), hand-rolled reentrancy guard (no OZ dependency needed).

---

## File Structure

| Action | Path | Responsibility |
|--------|------|---------------|
| **Delete** | `src/YieldVault.sol` | Old vault contract |
| **Delete** | `src/YieldVaultFactory.sol` | Old factory contract |
| **Delete** | `src/interfaces/IAggregatorV3.sol` | Old Chainlink interface |
| **Delete** | `test/YieldVault.t.sol` | Old test suite |
| **Create** | `src/AgentMicrolending.sol` | Core lending protocol |
| **Create** | `test/AgentMicrolending.t.sol` | Full test suite |
| **Modify** | `script/Deploy.s.sol` | Updated deployment script |

## Data Model

```solidity
enum LoanStatus { Open, Funded, Repaid, Defaulted, Cancelled }

struct LoanRequest {
    uint256 id;
    address borrower;
    address lender;          // requested lender (address(0) = anyone can fill)
    address actualLender;    // who actually funded it
    uint256 amount;          // loan amount in native token (wei)
    uint256 repayAmount;     // principal + interest to repay (wei)
    uint256 deadline;        // unix timestamp — repay by this time
    uint256 fundedAt;        // timestamp when funded
    LoanStatus status;
}
```

## Contract Interface (key functions)

**Borrower actions:**
- `createLoanRequest(uint256 amount, uint256 repayAmount, uint256 deadline, address lender)` → returns loanId
- `repayLoan(uint256 loanId)` — borrower sends `repayAmount` native token
- `cancelLoanRequest(uint256 loanId)` — cancel an unfunded request

**Lender actions:**
- `fundLoan(uint256 loanId)` — lender sends exactly `amount` native token
- `claimDefaulted(uint256 loanId)` — mark loan as defaulted after deadline (no funds to claim since non-collateralized, but marks status)

**View functions (no indexer needed):**
- `getLoan(uint256 loanId)` → LoanRequest
- `totalLoans()` → uint256
- `getBorrowerLoans(address borrower)` → uint256[] (loan IDs)
- `getLenderLoans(address lender)` → uint256[] (loan IDs)
- `getOpenLoans(uint256 offset, uint256 limit)` → LoanRequest[] (paginated)
- `getBorrowerOpenLoans(address borrower)` → LoanRequest[]
- `getLenderActiveLoanIds(address lender)` → uint256[]

---

### Task 1: Delete old contracts and tests

**Files:**
- Delete: `src/YieldVault.sol`
- Delete: `src/YieldVaultFactory.sol`
- Delete: `src/interfaces/IAggregatorV3.sol`
- Delete: `test/YieldVault.t.sol`

- [ ] **Step 1: Delete old source files**

```bash
rm packages/contracts/src/YieldVault.sol
rm packages/contracts/src/YieldVaultFactory.sol
rm packages/contracts/src/interfaces/IAggregatorV3.sol
rm -rf packages/contracts/src/interfaces
rm packages/contracts/test/YieldVault.t.sol
```

- [ ] **Step 2: Verify clean state**

Run: `cd packages/contracts && forge build 2>&1 | head -5`
Expected: No source files to compile (or empty build), no errors about missing files.

- [ ] **Step 3: Commit**

```bash
git add -u
git commit -m "chore: remove old YieldVault contracts and tests"
```

---

### Task 2: Create AgentMicrolending contract — data model and loan creation

**Files:**
- Create: `src/AgentMicrolending.sol`
- Create: `test/AgentMicrolending.t.sol`

- [ ] **Step 1: Write the failing test for createLoanRequest**

```solidity
// test/AgentMicrolending.t.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {AgentMicrolending} from "../src/AgentMicrolending.sol";

contract AgentMicrolendingTest is Test {
    AgentMicrolending lending;

    address borrower = makeAddr("borrower");
    address lender = makeAddr("lender");
    address stranger = makeAddr("stranger");

    function setUp() public {
        lending = new AgentMicrolending();
        vm.deal(borrower, 100 ether);
        vm.deal(lender, 100 ether);
        vm.deal(stranger, 100 ether);
    }

    // ════════════════════════════════════════════
    //  Loan creation
    // ════════════════════════════════════════════

    function test_createLoanRequest() public {
        uint256 deadline = block.timestamp + 30 days;

        vm.prank(borrower);
        uint256 loanId = lending.createLoanRequest(1 ether, 1.1 ether, deadline, lender);

        assertEq(loanId, 0);
        assertEq(lending.totalLoans(), 1);

        AgentMicrolending.LoanRequest memory loan = lending.getLoan(0);
        assertEq(loan.id, 0);
        assertEq(loan.borrower, borrower);
        assertEq(loan.lender, lender);
        assertEq(loan.actualLender, address(0));
        assertEq(loan.amount, 1 ether);
        assertEq(loan.repayAmount, 1.1 ether);
        assertEq(loan.deadline, deadline);
        assertEq(uint8(loan.status), uint8(AgentMicrolending.LoanStatus.Open));
    }

    function test_createLoanRequestOpenToAnyone() public {
        uint256 deadline = block.timestamp + 30 days;

        vm.prank(borrower);
        uint256 loanId = lending.createLoanRequest(1 ether, 1.1 ether, deadline, address(0));

        AgentMicrolending.LoanRequest memory loan = lending.getLoan(loanId);
        assertEq(loan.lender, address(0));
    }

    function test_createLoanZeroAmountReverts() public {
        vm.prank(borrower);
        vm.expectRevert(AgentMicrolending.ZeroAmount.selector);
        lending.createLoanRequest(0, 1 ether, block.timestamp + 1 days, lender);
    }

    function test_createLoanRepayLessThanAmountReverts() public {
        vm.prank(borrower);
        vm.expectRevert(AgentMicrolending.RepayTooLow.selector);
        lending.createLoanRequest(1 ether, 0.5 ether, block.timestamp + 1 days, lender);
    }

    function test_createLoanDeadlineInPastReverts() public {
        vm.prank(borrower);
        vm.expectRevert(AgentMicrolending.DeadlineInPast.selector);
        lending.createLoanRequest(1 ether, 1.1 ether, block.timestamp - 1, lender);
    }

    function test_createMultipleLoans() public {
        vm.startPrank(borrower);
        uint256 id0 = lending.createLoanRequest(1 ether, 1.1 ether, block.timestamp + 30 days, lender);
        uint256 id1 = lending.createLoanRequest(2 ether, 2.2 ether, block.timestamp + 60 days, address(0));
        vm.stopPrank();

        assertEq(id0, 0);
        assertEq(id1, 1);
        assertEq(lending.totalLoans(), 2);
    }

    function test_borrowerLoansTracked() public {
        vm.startPrank(borrower);
        lending.createLoanRequest(1 ether, 1.1 ether, block.timestamp + 30 days, lender);
        lending.createLoanRequest(2 ether, 2.2 ether, block.timestamp + 60 days, address(0));
        vm.stopPrank();

        uint256[] memory ids = lending.getBorrowerLoans(borrower);
        assertEq(ids.length, 2);
        assertEq(ids[0], 0);
        assertEq(ids[1], 1);
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/contracts && forge test --match-contract AgentMicrolendingTest -v 2>&1 | tail -5`
Expected: Compilation failure — `AgentMicrolending` not found.

- [ ] **Step 3: Write the contract with data model + createLoanRequest**

```solidity
// src/AgentMicrolending.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title AgentMicrolending
/// @notice P2P non-collateralized microlending protocol for autonomous agents.
///         Agents are simply EVM addresses. All data is stored on-chain and
///         queryable via view functions — no indexer or database required.
contract AgentMicrolending {

    // ──────────────────────────────────────────────
    //  Types
    // ──────────────────────────────────────────────

    enum LoanStatus { Open, Funded, Repaid, Defaulted, Cancelled }

    struct LoanRequest {
        uint256 id;
        address borrower;
        address lender;        // requested lender (address(0) = open to anyone)
        address actualLender;  // who actually funded the loan
        uint256 amount;        // loan amount in native token (wei)
        uint256 repayAmount;   // principal + interest borrower must repay
        uint256 deadline;      // unix timestamp — must repay by this time
        uint256 fundedAt;      // timestamp when funded (0 if not funded)
        LoanStatus status;
    }

    // ──────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────

    LoanRequest[] private loans;

    mapping(address => uint256[]) internal _borrowerLoans;
    mapping(address => uint256[]) internal _lenderLoans;

    // Reentrancy lock
    uint256 private _locked;

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────

    event LoanRequested(uint256 indexed loanId, address indexed borrower, address lender, uint256 amount, uint256 repayAmount, uint256 deadline);
    event LoanFunded(uint256 indexed loanId, address indexed lender);
    event LoanRepaid(uint256 indexed loanId);
    event LoanDefaulted(uint256 indexed loanId);
    event LoanCancelled(uint256 indexed loanId);

    // ──────────────────────────────────────────────
    //  Errors
    // ──────────────────────────────────────────────

    error ZeroAmount();
    error RepayTooLow();
    error DeadlineInPast();
    error LoanNotOpen();
    error LoanNotFunded();
    error NotBorrower();
    error NotAuthorizedLender();
    error IncorrectAmount();
    error DeadlineNotReached();
    error DeadlineReached();
    error Reentrancy();
    error TransferFailed();

    // ──────────────────────────────────────────────
    //  Modifiers
    // ──────────────────────────────────────────────

    modifier nonReentrant() {
        if (_locked == 1) revert Reentrancy();
        _locked = 1;
        _;
        _locked = 0;
    }

    // ──────────────────────────────────────────────
    //  Borrower actions
    // ──────────────────────────────────────────────

    /// @notice Create a new loan request.
    /// @param amount      Amount to borrow (in native token wei).
    /// @param repayAmount Total amount to repay (principal + interest).
    /// @param deadline    Unix timestamp by which the loan must be repaid.
    /// @param lender      Specific lender address, or address(0) for open request.
    /// @return loanId     The ID of the created loan request.
    function createLoanRequest(
        uint256 amount,
        uint256 repayAmount,
        uint256 deadline,
        address lender
    ) external returns (uint256 loanId) {
        if (amount == 0) revert ZeroAmount();
        if (repayAmount < amount) revert RepayTooLow();
        if (deadline <= block.timestamp) revert DeadlineInPast();

        loanId = loans.length;

        loans.push(LoanRequest({
            id: loanId,
            borrower: msg.sender,
            lender: lender,
            actualLender: address(0),
            amount: amount,
            repayAmount: repayAmount,
            deadline: deadline,
            fundedAt: 0,
            status: LoanStatus.Open
        }));

        _borrowerLoans[msg.sender].push(loanId);

        emit LoanRequested(loanId, msg.sender, lender, amount, repayAmount, deadline);
    }

    // ──────────────────────────────────────────────
    //  View functions (basic — more added later)
    // ──────────────────────────────────────────────

    /// @notice Get a loan by ID.
    function getLoan(uint256 loanId) external view returns (LoanRequest memory) {
        return loans[loanId];
    }

    /// @notice Total number of loan requests ever created.
    function totalLoans() external view returns (uint256) {
        return loans.length;
    }

    /// @notice Get all loan IDs for a borrower.
    function getBorrowerLoans(address borrower) external view returns (uint256[] memory) {
        return _borrowerLoans[borrower];
    }

    /// @notice Get all loan IDs for a lender (loans they funded).
    function getLenderLoans(address lender) external view returns (uint256[] memory) {
        return _lenderLoans[lender];
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/contracts && forge test --match-contract AgentMicrolendingTest -v`
Expected: All 7 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/AgentMicrolending.sol test/AgentMicrolending.t.sol
git commit -m "feat: add AgentMicrolending contract with loan creation"
```

---

### Task 3: Implement fundLoan

**Files:**
- Modify: `src/AgentMicrolending.sol`
- Modify: `test/AgentMicrolending.t.sol`

- [ ] **Step 1: Write failing tests for fundLoan**

Add to the test file:

```solidity
    // ════════════════════════════════════════════
    //  Fund loan
    // ════════════════════════════════════════════

    function _createDefaultLoan() internal returns (uint256) {
        vm.prank(borrower);
        return lending.createLoanRequest(1 ether, 1.1 ether, block.timestamp + 30 days, lender);
    }

    function _createOpenLoan() internal returns (uint256) {
        vm.prank(borrower);
        return lending.createLoanRequest(1 ether, 1.1 ether, block.timestamp + 30 days, address(0));
    }

    function test_fundLoan() public {
        uint256 loanId = _createDefaultLoan();
        uint256 borrowerBal = borrower.balance;

        vm.prank(lender);
        lending.fundLoan{value: 1 ether}(loanId);

        AgentMicrolending.LoanRequest memory loan = lending.getLoan(loanId);
        assertEq(uint8(loan.status), uint8(AgentMicrolending.LoanStatus.Funded));
        assertEq(loan.actualLender, lender);
        assertTrue(loan.fundedAt > 0);
        assertEq(borrower.balance, borrowerBal + 1 ether);
    }

    function test_fundOpenLoan() public {
        uint256 loanId = _createOpenLoan();

        vm.prank(stranger);
        lending.fundLoan{value: 1 ether}(loanId);

        AgentMicrolending.LoanRequest memory loan = lending.getLoan(loanId);
        assertEq(loan.actualLender, stranger);
        assertEq(uint8(loan.status), uint8(AgentMicrolending.LoanStatus.Funded));
    }

    function test_fundLoanWrongLenderReverts() public {
        uint256 loanId = _createDefaultLoan(); // lender-specific

        vm.prank(stranger);
        vm.expectRevert(AgentMicrolending.NotAuthorizedLender.selector);
        lending.fundLoan{value: 1 ether}(loanId);
    }

    function test_fundLoanWrongAmountReverts() public {
        uint256 loanId = _createDefaultLoan();

        vm.prank(lender);
        vm.expectRevert(AgentMicrolending.IncorrectAmount.selector);
        lending.fundLoan{value: 0.5 ether}(loanId);
    }

    function test_fundLoanNotOpenReverts() public {
        uint256 loanId = _createDefaultLoan();

        vm.prank(lender);
        lending.fundLoan{value: 1 ether}(loanId);

        // Try to fund again
        vm.prank(lender);
        vm.expectRevert(AgentMicrolending.LoanNotOpen.selector);
        lending.fundLoan{value: 1 ether}(loanId);
    }

    function test_fundLoanTracksLenderLoans() public {
        uint256 loanId = _createDefaultLoan();

        vm.prank(lender);
        lending.fundLoan{value: 1 ether}(loanId);

        uint256[] memory ids = lending.getLenderLoans(lender);
        assertEq(ids.length, 1);
        assertEq(ids[0], loanId);
    }

    function test_fundLoanAfterDeadlineReverts() public {
        uint256 loanId = _createDefaultLoan();

        vm.warp(block.timestamp + 31 days);

        vm.prank(lender);
        vm.expectRevert(AgentMicrolending.DeadlineReached.selector);
        lending.fundLoan{value: 1 ether}(loanId);
    }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/contracts && forge test --match-test "test_fund" -v 2>&1 | tail -5`
Expected: Compilation failure — `fundLoan` not found.

- [ ] **Step 3: Implement fundLoan in the contract**

Add to `AgentMicrolending.sol` after `createLoanRequest`:

```solidity
    // ──────────────────────────────────────────────
    //  Lender actions
    // ──────────────────────────────────────────────

    /// @notice Fund an open loan request. Sends `amount` native token to the borrower.
    /// @param loanId The loan to fund.
    function fundLoan(uint256 loanId) external payable nonReentrant {
        LoanRequest storage loan = loans[loanId];

        if (loan.status != LoanStatus.Open) revert LoanNotOpen();
        if (block.timestamp >= loan.deadline) revert DeadlineReached();
        if (loan.lender != address(0) && msg.sender != loan.lender) revert NotAuthorizedLender();
        if (msg.value != loan.amount) revert IncorrectAmount();

        loan.status = LoanStatus.Funded;
        loan.actualLender = msg.sender;
        loan.fundedAt = block.timestamp;

        _lenderLoans[msg.sender].push(loanId);

        // Transfer funds to borrower
        (bool success, ) = loan.borrower.call{value: msg.value}("");
        if (!success) revert TransferFailed();

        emit LoanFunded(loanId, msg.sender);
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/contracts && forge test --match-contract AgentMicrolendingTest -v`
Expected: All tests pass (creation + funding).

- [ ] **Step 5: Commit**

```bash
git add src/AgentMicrolending.sol test/AgentMicrolending.t.sol
git commit -m "feat: add fundLoan to AgentMicrolending"
```

---

### Task 4: Implement repayLoan

**Files:**
- Modify: `src/AgentMicrolending.sol`
- Modify: `test/AgentMicrolending.t.sol`

- [ ] **Step 1: Write failing tests for repayLoan**

Add to the test file:

```solidity
    // ════════════════════════════════════════════
    //  Repay loan
    // ════════════════════════════════════════════

    function _createAndFundLoan() internal returns (uint256) {
        uint256 loanId = _createDefaultLoan();
        vm.prank(lender);
        lending.fundLoan{value: 1 ether}(loanId);
        return loanId;
    }

    function test_repayLoan() public {
        uint256 loanId = _createAndFundLoan();
        uint256 lenderBal = lender.balance;

        vm.prank(borrower);
        lending.repayLoan{value: 1.1 ether}(loanId);

        AgentMicrolending.LoanRequest memory loan = lending.getLoan(loanId);
        assertEq(uint8(loan.status), uint8(AgentMicrolending.LoanStatus.Repaid));
        assertEq(lender.balance, lenderBal + 1.1 ether);
    }

    function test_repayLoanNotBorrowerReverts() public {
        uint256 loanId = _createAndFundLoan();

        vm.prank(stranger);
        vm.expectRevert(AgentMicrolending.NotBorrower.selector);
        lending.repayLoan{value: 1.1 ether}(loanId);
    }

    function test_repayLoanWrongAmountReverts() public {
        uint256 loanId = _createAndFundLoan();

        vm.prank(borrower);
        vm.expectRevert(AgentMicrolending.IncorrectAmount.selector);
        lending.repayLoan{value: 1 ether}(loanId);
    }

    function test_repayLoanNotFundedReverts() public {
        uint256 loanId = _createDefaultLoan();

        vm.prank(borrower);
        vm.expectRevert(AgentMicrolending.LoanNotFunded.selector);
        lending.repayLoan{value: 1.1 ether}(loanId);
    }

    function test_repayLoanAfterDeadlineReverts() public {
        uint256 loanId = _createAndFundLoan();

        vm.warp(block.timestamp + 31 days);

        vm.prank(borrower);
        vm.expectRevert(AgentMicrolending.DeadlineReached.selector);
        lending.repayLoan{value: 1.1 ether}(loanId);
    }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/contracts && forge test --match-test "test_repay" -v 2>&1 | tail -5`
Expected: Compilation failure — `repayLoan` not found.

- [ ] **Step 3: Implement repayLoan**

Add to `AgentMicrolending.sol`:

```solidity
    /// @notice Repay a funded loan. Borrower sends `repayAmount` to the lender.
    /// @param loanId The loan to repay.
    function repayLoan(uint256 loanId) external payable nonReentrant {
        LoanRequest storage loan = loans[loanId];

        if (loan.status != LoanStatus.Funded) revert LoanNotFunded();
        if (msg.sender != loan.borrower) revert NotBorrower();
        if (block.timestamp > loan.deadline) revert DeadlineReached();
        if (msg.value != loan.repayAmount) revert IncorrectAmount();

        loan.status = LoanStatus.Repaid;

        // Send repayment to lender
        (bool success, ) = loan.actualLender.call{value: msg.value}("");
        if (!success) revert TransferFailed();

        emit LoanRepaid(loanId);
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/contracts && forge test --match-contract AgentMicrolendingTest -v`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/AgentMicrolending.sol test/AgentMicrolending.t.sol
git commit -m "feat: add repayLoan to AgentMicrolending"
```

---

### Task 5: Implement cancelLoanRequest and claimDefaulted

**Files:**
- Modify: `src/AgentMicrolending.sol`
- Modify: `test/AgentMicrolending.t.sol`

- [ ] **Step 1: Write failing tests**

Add to test file:

```solidity
    // ════════════════════════════════════════════
    //  Cancel loan request
    // ════════════════════════════════════════════

    function test_cancelLoanRequest() public {
        uint256 loanId = _createDefaultLoan();

        vm.prank(borrower);
        lending.cancelLoanRequest(loanId);

        AgentMicrolending.LoanRequest memory loan = lending.getLoan(loanId);
        assertEq(uint8(loan.status), uint8(AgentMicrolending.LoanStatus.Cancelled));
    }

    function test_cancelLoanNotBorrowerReverts() public {
        uint256 loanId = _createDefaultLoan();

        vm.prank(stranger);
        vm.expectRevert(AgentMicrolending.NotBorrower.selector);
        lending.cancelLoanRequest(loanId);
    }

    function test_cancelLoanNotOpenReverts() public {
        uint256 loanId = _createAndFundLoan();

        vm.prank(borrower);
        vm.expectRevert(AgentMicrolending.LoanNotOpen.selector);
        lending.cancelLoanRequest(loanId);
    }

    // ════════════════════════════════════════════
    //  Claim defaulted
    // ════════════════════════════════════════════

    function test_claimDefaulted() public {
        uint256 loanId = _createAndFundLoan();

        vm.warp(block.timestamp + 31 days);

        vm.prank(lender);
        lending.claimDefaulted(loanId);

        AgentMicrolending.LoanRequest memory loan = lending.getLoan(loanId);
        assertEq(uint8(loan.status), uint8(AgentMicrolending.LoanStatus.Defaulted));
    }

    function test_claimDefaultedBeforeDeadlineReverts() public {
        uint256 loanId = _createAndFundLoan();

        vm.prank(lender);
        vm.expectRevert(AgentMicrolending.DeadlineNotReached.selector);
        lending.claimDefaulted(loanId);
    }

    function test_claimDefaultedNotFundedReverts() public {
        uint256 loanId = _createDefaultLoan();

        vm.warp(block.timestamp + 31 days);

        vm.prank(lender);
        vm.expectRevert(AgentMicrolending.LoanNotFunded.selector);
        lending.claimDefaulted(loanId);
    }

    function test_claimDefaultedAnyoneCanCall() public {
        uint256 loanId = _createAndFundLoan();

        vm.warp(block.timestamp + 31 days);

        vm.prank(stranger);
        lending.claimDefaulted(loanId);

        AgentMicrolending.LoanRequest memory loan = lending.getLoan(loanId);
        assertEq(uint8(loan.status), uint8(AgentMicrolending.LoanStatus.Defaulted));
    }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/contracts && forge test --match-test "test_cancel|test_claimDefaulted" -v 2>&1 | tail -5`
Expected: Compilation failure.

- [ ] **Step 3: Implement cancelLoanRequest and claimDefaulted**

Add to `AgentMicrolending.sol` (borrower section):

```solidity
    /// @notice Cancel an open (unfunded) loan request.
    /// @param loanId The loan to cancel.
    function cancelLoanRequest(uint256 loanId) external {
        LoanRequest storage loan = loans[loanId];

        if (msg.sender != loan.borrower) revert NotBorrower();
        if (loan.status != LoanStatus.Open) revert LoanNotOpen();

        loan.status = LoanStatus.Cancelled;

        emit LoanCancelled(loanId);
    }
```

Add to lender section:

```solidity
    /// @notice Mark a funded loan as defaulted after the repayment deadline has passed.
    ///         Since loans are non-collateralized, this only updates the status (reputation signal).
    /// @param loanId The loan to mark as defaulted.
    function claimDefaulted(uint256 loanId) external {
        LoanRequest storage loan = loans[loanId];

        if (loan.status != LoanStatus.Funded) revert LoanNotFunded();
        if (block.timestamp <= loan.deadline) revert DeadlineNotReached();

        loan.status = LoanStatus.Defaulted;

        emit LoanDefaulted(loanId);
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/contracts && forge test --match-contract AgentMicrolendingTest -v`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/AgentMicrolending.sol test/AgentMicrolending.t.sol
git commit -m "feat: add cancel and default handling to AgentMicrolending"
```

---

### Task 6: Implement advanced view functions (pagination, filtering)

**Files:**
- Modify: `src/AgentMicrolending.sol`
- Modify: `test/AgentMicrolending.t.sol`

- [ ] **Step 1: Write failing tests for view functions**

Add to test file:

```solidity
    // ════════════════════════════════════════════
    //  View functions
    // ════════════════════════════════════════════

    function test_getOpenLoans() public {
        // Create 3 loans, fund one
        vm.startPrank(borrower);
        lending.createLoanRequest(1 ether, 1.1 ether, block.timestamp + 30 days, address(0));
        lending.createLoanRequest(2 ether, 2.2 ether, block.timestamp + 30 days, address(0));
        lending.createLoanRequest(3 ether, 3.3 ether, block.timestamp + 30 days, address(0));
        vm.stopPrank();

        // Fund loan 1
        vm.prank(lender);
        lending.fundLoan{value: 2 ether}(1);

        AgentMicrolending.LoanRequest[] memory openLoans = lending.getOpenLoans(0, 10);
        assertEq(openLoans.length, 2);
        assertEq(openLoans[0].id, 0);
        assertEq(openLoans[1].id, 2);
    }

    function test_getOpenLoansPagination() public {
        // Create 5 open loans
        vm.startPrank(borrower);
        for (uint256 i = 0; i < 5; i++) {
            lending.createLoanRequest(1 ether, 1.1 ether, block.timestamp + 30 days, address(0));
        }
        vm.stopPrank();

        AgentMicrolending.LoanRequest[] memory page1 = lending.getOpenLoans(0, 2);
        assertEq(page1.length, 2);
        assertEq(page1[0].id, 0);
        assertEq(page1[1].id, 1);

        AgentMicrolending.LoanRequest[] memory page2 = lending.getOpenLoans(2, 2);
        assertEq(page2.length, 2);
        assertEq(page2[0].id, 2);
        assertEq(page2[1].id, 3);
    }

    function test_getBorrowerOpenLoans() public {
        vm.startPrank(borrower);
        lending.createLoanRequest(1 ether, 1.1 ether, block.timestamp + 30 days, address(0));
        lending.createLoanRequest(2 ether, 2.2 ether, block.timestamp + 30 days, address(0));
        vm.stopPrank();

        // Fund one
        vm.prank(lender);
        lending.fundLoan{value: 1 ether}(0);

        AgentMicrolending.LoanRequest[] memory openLoans = lending.getBorrowerOpenLoans(borrower);
        assertEq(openLoans.length, 1);
        assertEq(openLoans[0].id, 1);
    }

    function test_getLenderActiveLoanIds() public {
        // Create and fund two loans
        vm.prank(borrower);
        lending.createLoanRequest(1 ether, 1.1 ether, block.timestamp + 30 days, address(0));
        vm.prank(borrower);
        lending.createLoanRequest(2 ether, 2.2 ether, block.timestamp + 30 days, address(0));

        vm.prank(lender);
        lending.fundLoan{value: 1 ether}(0);
        vm.prank(lender);
        lending.fundLoan{value: 2 ether}(1);

        // Repay one
        vm.prank(borrower);
        lending.repayLoan{value: 1.1 ether}(0);

        uint256[] memory activeIds = lending.getLenderActiveLoanIds(lender);
        assertEq(activeIds.length, 1);
        assertEq(activeIds[0], 1);
    }

    function test_totalLoansEmpty() public view {
        assertEq(lending.totalLoans(), 0);
    }
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/contracts && forge test --match-test "test_getOpen|test_getBorrowerOpen|test_getLenderActive|test_totalLoansEmpty" -v 2>&1 | tail -5`
Expected: Compilation failure.

- [ ] **Step 3: Implement advanced view functions**

Add to `AgentMicrolending.sol` (after the existing view functions section):

```solidity
    /// @notice Get paginated list of open loan requests.
    /// @param offset Start index (skips non-open loans, counts only open ones).
    /// @param limit  Max number of open loans to return.
    function getOpenLoans(uint256 offset, uint256 limit) external view returns (LoanRequest[] memory) {
        // First pass: count open loans
        uint256 total = loans.length;
        uint256 openCount = 0;
        for (uint256 i = 0; i < total; i++) {
            if (loans[i].status == LoanStatus.Open) openCount++;
        }

        // Calculate result size
        if (offset >= openCount) return new LoanRequest[](0);
        uint256 resultLen = limit;
        if (offset + limit > openCount) resultLen = openCount - offset;

        LoanRequest[] memory result = new LoanRequest[](resultLen);
        uint256 found = 0;
        uint256 added = 0;
        for (uint256 i = 0; i < total && added < resultLen; i++) {
            if (loans[i].status == LoanStatus.Open) {
                if (found >= offset) {
                    result[added] = loans[i];
                    added++;
                }
                found++;
            }
        }
        return result;
    }

    /// @notice Get all open loan requests for a specific borrower.
    function getBorrowerOpenLoans(address borrower) external view returns (LoanRequest[] memory) {
        uint256[] storage ids = _borrowerLoans[borrower];
        uint256 len = ids.length;

        // Count open
        uint256 openCount = 0;
        for (uint256 i = 0; i < len; i++) {
            if (loans[ids[i]].status == LoanStatus.Open) openCount++;
        }

        LoanRequest[] memory result = new LoanRequest[](openCount);
        uint256 idx = 0;
        for (uint256 i = 0; i < len; i++) {
            if (loans[ids[i]].status == LoanStatus.Open) {
                result[idx] = loans[ids[i]];
                idx++;
            }
        }
        return result;
    }

    /// @notice Get loan IDs where the lender has an active (funded, not repaid/defaulted) loan.
    function getLenderActiveLoanIds(address lender) external view returns (uint256[] memory) {
        uint256[] storage ids = _lenderLoans[lender];
        uint256 len = ids.length;

        // Count active
        uint256 activeCount = 0;
        for (uint256 i = 0; i < len; i++) {
            if (loans[ids[i]].status == LoanStatus.Funded) activeCount++;
        }

        uint256[] memory result = new uint256[](activeCount);
        uint256 idx = 0;
        for (uint256 i = 0; i < len; i++) {
            if (loans[ids[i]].status == LoanStatus.Funded) {
                result[idx] = ids[i];
                idx++;
            }
        }
        return result;
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/contracts && forge test --match-contract AgentMicrolendingTest -v`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/AgentMicrolending.sol test/AgentMicrolending.t.sol
git commit -m "feat: add view functions to AgentMicrolending"
```

---

### Task 7: Integration tests and deploy script

**Files:**
- Modify: `test/AgentMicrolending.t.sol`
- Modify: `script/Deploy.s.sol`

- [ ] **Step 1: Write integration test**

Add to test file:

```solidity
    // ════════════════════════════════════════════
    //  Integration — full lifecycle
    // ════════════════════════════════════════════

    function test_fullLoanLifecycle() public {
        // 1. Borrower creates loan request
        uint256 deadline = block.timestamp + 30 days;
        vm.prank(borrower);
        uint256 loanId = lending.createLoanRequest(5 ether, 5.5 ether, deadline, lender);

        // 2. Verify open state
        AgentMicrolending.LoanRequest memory loan = lending.getLoan(loanId);
        assertEq(uint8(loan.status), uint8(AgentMicrolending.LoanStatus.Open));

        // 3. Lender funds it
        uint256 borrowerBal = borrower.balance;
        vm.prank(lender);
        lending.fundLoan{value: 5 ether}(loanId);
        assertEq(borrower.balance, borrowerBal + 5 ether);

        // 4. Borrower repays within deadline
        uint256 lenderBal = lender.balance;
        vm.prank(borrower);
        lending.repayLoan{value: 5.5 ether}(loanId);
        assertEq(lender.balance, lenderBal + 5.5 ether);

        // 5. Loan is repaid
        loan = lending.getLoan(loanId);
        assertEq(uint8(loan.status), uint8(AgentMicrolending.LoanStatus.Repaid));
    }

    function test_defaultLifecycle() public {
        // 1. Borrower creates loan, lender funds
        uint256 loanId = _createAndFundLoan();

        // 2. Deadline passes without repayment
        vm.warp(block.timestamp + 31 days);

        // 3. Anyone marks as defaulted
        vm.prank(stranger);
        lending.claimDefaulted(loanId);

        // 4. Verify defaulted
        AgentMicrolending.LoanRequest memory loan = lending.getLoan(loanId);
        assertEq(uint8(loan.status), uint8(AgentMicrolending.LoanStatus.Defaulted));
    }

    function test_multiAgentScenario() public {
        address agent1 = makeAddr("agent1");
        address agent2 = makeAddr("agent2");
        address agent3 = makeAddr("agent3");
        vm.deal(agent1, 100 ether);
        vm.deal(agent2, 100 ether);
        vm.deal(agent3, 100 ether);

        // Agent1 requests loan from agent2
        vm.prank(agent1);
        uint256 loan1 = lending.createLoanRequest(1 ether, 1.05 ether, block.timestamp + 7 days, agent2);

        // Agent1 also requests open loan
        vm.prank(agent1);
        uint256 loan2 = lending.createLoanRequest(2 ether, 2.1 ether, block.timestamp + 14 days, address(0));

        // Agent2 funds first loan
        vm.prank(agent2);
        lending.fundLoan{value: 1 ether}(loan1);

        // Agent3 funds open loan
        vm.prank(agent3);
        lending.fundLoan{value: 2 ether}(loan2);

        // Agent1 repays both
        vm.prank(agent1);
        lending.repayLoan{value: 1.05 ether}(loan1);

        vm.prank(agent1);
        lending.repayLoan{value: 2.1 ether}(loan2);

        // Verify all repaid
        assertEq(uint8(lending.getLoan(loan1).status), uint8(AgentMicrolending.LoanStatus.Repaid));
        assertEq(uint8(lending.getLoan(loan2).status), uint8(AgentMicrolending.LoanStatus.Repaid));

        // Verify lookup correctness
        assertEq(lending.getBorrowerLoans(agent1).length, 2);
        assertEq(lending.getLenderLoans(agent2).length, 1);
        assertEq(lending.getLenderLoans(agent3).length, 1);
    }
```

- [ ] **Step 2: Run all tests**

Run: `cd packages/contracts && forge test -v`
Expected: All tests pass.

- [ ] **Step 3: Update deploy script**

```solidity
// script/Deploy.s.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {AgentMicrolending} from "../src/AgentMicrolending.sol";

contract Deploy is Script {
    function run() external {
        vm.startBroadcast();

        AgentMicrolending lending = new AgentMicrolending();

        console.log("AgentMicrolending:", address(lending));

        vm.stopBroadcast();
    }
}
```

- [ ] **Step 4: Verify build**

Run: `cd packages/contracts && forge build`
Expected: Compiles without errors.

- [ ] **Step 5: Commit**

```bash
git add test/AgentMicrolending.t.sol script/Deploy.s.sol
git commit -m "feat: add integration tests and deployment script for AgentMicrolending"
```

---

### Task 8: Final cleanup and verification

- [ ] **Step 1: Run full test suite with verbose output**

Run: `cd packages/contracts && forge test -vvv`
Expected: All tests pass.

- [ ] **Step 2: Run formatter**

Run: `cd packages/contracts && forge fmt`

- [ ] **Step 3: Commit formatting if needed**

```bash
git add -A
git commit -m "style: format AgentMicrolending contracts"
```
