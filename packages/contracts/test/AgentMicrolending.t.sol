// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {AgentMicrolending} from "../src/AgentMicrolending.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Minimal mock USDC (6 decimals) for testing.
contract MockUSDC is ERC20 {
    constructor() ERC20("USD Coin", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract AgentMicrolendingTest is Test {
    AgentMicrolending lending;
    MockUSDC usdc;

    address borrower = makeAddr("borrower");
    address lender = makeAddr("lender");
    address stranger = makeAddr("stranger");

    // 1 USDC = 1e6
    uint256 constant ONE_USDC = 1e6;

    function setUp() public {
        usdc = new MockUSDC();
        lending = new AgentMicrolending(address(usdc));

        // Mint USDC to test accounts
        usdc.mint(borrower, 1000 * ONE_USDC);
        usdc.mint(lender, 1000 * ONE_USDC);
        usdc.mint(stranger, 1000 * ONE_USDC);

        // Approve lending contract to spend tokens
        vm.prank(borrower);
        usdc.approve(address(lending), type(uint256).max);
        vm.prank(lender);
        usdc.approve(address(lending), type(uint256).max);
        vm.prank(stranger);
        usdc.approve(address(lending), type(uint256).max);
    }

    // ════════════════════════════════════════════
    //  Constructor
    // ════════════════════════════════════════════

    function test_constructorSetsToken() public view {
        assertEq(address(lending.token()), address(usdc));
    }

    function test_constructorZeroAddressReverts() public {
        vm.expectRevert(AgentMicrolending.ZeroAddress.selector);
        new AgentMicrolending(address(0));
    }

    // ════════════════════════════════════════════
    //  Loan creation
    // ════════════════════════════════════════════

    function test_createLoanRequest() public {
        uint256 deadline = block.timestamp + 30 days;

        vm.prank(borrower);
        uint256 loanId = lending.createLoanRequest(100 * ONE_USDC, 110 * ONE_USDC, deadline, lender);

        assertEq(loanId, 0);
        assertEq(lending.totalLoans(), 1);

        AgentMicrolending.LoanRequest memory loan = lending.getLoan(0);
        assertEq(loan.id, 0);
        assertEq(loan.borrower, borrower);
        assertEq(loan.lender, lender);
        assertEq(loan.actualLender, address(0));
        assertEq(loan.amount, 100 * ONE_USDC);
        assertEq(loan.repayAmount, 110 * ONE_USDC);
        assertEq(loan.deadline, deadline);
        assertEq(uint8(loan.status), uint8(AgentMicrolending.LoanStatus.Open));
    }

    function test_createLoanRequestOpenToAnyone() public {
        uint256 deadline = block.timestamp + 30 days;

        vm.prank(borrower);
        uint256 loanId = lending.createLoanRequest(100 * ONE_USDC, 110 * ONE_USDC, deadline, address(0));

        AgentMicrolending.LoanRequest memory loan = lending.getLoan(loanId);
        assertEq(loan.lender, address(0));
    }

    function test_createLoanZeroAmountReverts() public {
        vm.prank(borrower);
        vm.expectRevert(AgentMicrolending.ZeroAmount.selector);
        lending.createLoanRequest(0, 100 * ONE_USDC, block.timestamp + 1 days, lender);
    }

    function test_createLoanRepayLessThanAmountReverts() public {
        vm.prank(borrower);
        vm.expectRevert(AgentMicrolending.RepayTooLow.selector);
        lending.createLoanRequest(100 * ONE_USDC, 50 * ONE_USDC, block.timestamp + 1 days, lender);
    }

    function test_createLoanDeadlineInPastReverts() public {
        vm.prank(borrower);
        vm.expectRevert(AgentMicrolending.DeadlineInPast.selector);
        lending.createLoanRequest(100 * ONE_USDC, 110 * ONE_USDC, block.timestamp - 1, lender);
    }

    function test_createMultipleLoans() public {
        vm.startPrank(borrower);
        uint256 id0 = lending.createLoanRequest(100 * ONE_USDC, 110 * ONE_USDC, block.timestamp + 30 days, lender);
        uint256 id1 = lending.createLoanRequest(200 * ONE_USDC, 220 * ONE_USDC, block.timestamp + 60 days, address(0));
        vm.stopPrank();

        assertEq(id0, 0);
        assertEq(id1, 1);
        assertEq(lending.totalLoans(), 2);
    }

    function test_borrowerLoansTracked() public {
        vm.startPrank(borrower);
        lending.createLoanRequest(100 * ONE_USDC, 110 * ONE_USDC, block.timestamp + 30 days, lender);
        lending.createLoanRequest(200 * ONE_USDC, 220 * ONE_USDC, block.timestamp + 60 days, address(0));
        vm.stopPrank();

        uint256[] memory ids = lending.getBorrowerLoans(borrower);
        assertEq(ids.length, 2);
        assertEq(ids[0], 0);
        assertEq(ids[1], 1);
    }

    // ════════════════════════════════════════════
    //  Fund loan
    // ════════════════════════════════════════════

    function _createDefaultLoan() internal returns (uint256) {
        vm.prank(borrower);
        return lending.createLoanRequest(100 * ONE_USDC, 110 * ONE_USDC, block.timestamp + 30 days, lender);
    }

    function _createOpenLoan() internal returns (uint256) {
        vm.prank(borrower);
        return lending.createLoanRequest(100 * ONE_USDC, 110 * ONE_USDC, block.timestamp + 30 days, address(0));
    }

    function test_fundLoan() public {
        uint256 loanId = _createDefaultLoan();
        uint256 borrowerBal = usdc.balanceOf(borrower);

        vm.prank(lender);
        lending.fundLoan(loanId);

        AgentMicrolending.LoanRequest memory loan = lending.getLoan(loanId);
        assertEq(uint8(loan.status), uint8(AgentMicrolending.LoanStatus.Funded));
        assertEq(loan.actualLender, lender);
        assertTrue(loan.fundedAt > 0);
        assertEq(usdc.balanceOf(borrower), borrowerBal + 100 * ONE_USDC);
    }

    function test_fundOpenLoan() public {
        uint256 loanId = _createOpenLoan();

        vm.prank(stranger);
        lending.fundLoan(loanId);

        AgentMicrolending.LoanRequest memory loan = lending.getLoan(loanId);
        assertEq(loan.actualLender, stranger);
        assertEq(uint8(loan.status), uint8(AgentMicrolending.LoanStatus.Funded));
    }

    function test_fundLoanWrongLenderReverts() public {
        uint256 loanId = _createDefaultLoan();

        vm.prank(stranger);
        vm.expectRevert(AgentMicrolending.NotAuthorizedLender.selector);
        lending.fundLoan(loanId);
    }

    function test_fundLoanNotOpenReverts() public {
        uint256 loanId = _createDefaultLoan();

        vm.prank(lender);
        lending.fundLoan(loanId);

        vm.prank(lender);
        vm.expectRevert(AgentMicrolending.LoanNotOpen.selector);
        lending.fundLoan(loanId);
    }

    function test_fundLoanTracksLenderLoans() public {
        uint256 loanId = _createDefaultLoan();

        vm.prank(lender);
        lending.fundLoan(loanId);

        uint256[] memory ids = lending.getLenderLoans(lender);
        assertEq(ids.length, 1);
        assertEq(ids[0], loanId);
    }

    function test_fundLoanAfterDeadlineReverts() public {
        uint256 loanId = _createDefaultLoan();

        vm.warp(block.timestamp + 31 days);

        vm.prank(lender);
        vm.expectRevert(AgentMicrolending.DeadlineReached.selector);
        lending.fundLoan(loanId);
    }

    // ════════════════════════════════════════════
    //  Repay loan
    // ════════════════════════════════════════════

    function _createAndFundLoan() internal returns (uint256) {
        uint256 loanId = _createDefaultLoan();
        vm.prank(lender);
        lending.fundLoan(loanId);
        return loanId;
    }

    function test_repayLoan() public {
        uint256 loanId = _createAndFundLoan();
        uint256 lenderBal = usdc.balanceOf(lender);

        vm.prank(borrower);
        lending.repayLoan(loanId);

        AgentMicrolending.LoanRequest memory loan = lending.getLoan(loanId);
        assertEq(uint8(loan.status), uint8(AgentMicrolending.LoanStatus.Repaid));
        assertEq(usdc.balanceOf(lender), lenderBal + 110 * ONE_USDC);
    }

    function test_repayLoanNotBorrowerReverts() public {
        uint256 loanId = _createAndFundLoan();

        vm.prank(stranger);
        vm.expectRevert(AgentMicrolending.NotBorrower.selector);
        lending.repayLoan(loanId);
    }

    function test_repayLoanNotFundedReverts() public {
        uint256 loanId = _createDefaultLoan();

        vm.prank(borrower);
        vm.expectRevert(AgentMicrolending.LoanNotFunded.selector);
        lending.repayLoan(loanId);
    }

    function test_repayLoanAfterDeadlineReverts() public {
        uint256 loanId = _createAndFundLoan();

        vm.warp(block.timestamp + 31 days);

        vm.prank(borrower);
        vm.expectRevert(AgentMicrolending.DeadlineReached.selector);
        lending.repayLoan(loanId);
    }

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

    // ════════════════════════════════════════════
    //  Advanced view functions
    // ════════════════════════════════════════════

    function test_getOpenLoans() public {
        // Create 3 loans, fund one
        vm.startPrank(borrower);
        lending.createLoanRequest(100 * ONE_USDC, 110 * ONE_USDC, block.timestamp + 30 days, address(0));
        lending.createLoanRequest(200 * ONE_USDC, 220 * ONE_USDC, block.timestamp + 30 days, address(0));
        lending.createLoanRequest(300 * ONE_USDC, 330 * ONE_USDC, block.timestamp + 30 days, address(0));
        vm.stopPrank();

        // Fund loan 1
        vm.prank(lender);
        lending.fundLoan(1);

        AgentMicrolending.LoanRequest[] memory openLoans = lending.getOpenLoans(0, 10);
        assertEq(openLoans.length, 2);
        assertEq(openLoans[0].id, 0);
        assertEq(openLoans[1].id, 2);
    }

    function test_getOpenLoansPagination() public {
        // Create 5 open loans
        vm.startPrank(borrower);
        for (uint256 i = 0; i < 5; i++) {
            lending.createLoanRequest(100 * ONE_USDC, 110 * ONE_USDC, block.timestamp + 30 days, address(0));
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
        lending.createLoanRequest(100 * ONE_USDC, 110 * ONE_USDC, block.timestamp + 30 days, address(0));
        lending.createLoanRequest(200 * ONE_USDC, 220 * ONE_USDC, block.timestamp + 30 days, address(0));
        vm.stopPrank();

        // Fund one
        vm.prank(lender);
        lending.fundLoan(0);

        AgentMicrolending.LoanRequest[] memory openLoans = lending.getBorrowerOpenLoans(borrower);
        assertEq(openLoans.length, 1);
        assertEq(openLoans[0].id, 1);
    }

    function test_getLenderActiveLoanIds() public {
        // Create and fund two loans
        vm.prank(borrower);
        lending.createLoanRequest(100 * ONE_USDC, 110 * ONE_USDC, block.timestamp + 30 days, address(0));
        vm.prank(borrower);
        lending.createLoanRequest(200 * ONE_USDC, 220 * ONE_USDC, block.timestamp + 30 days, address(0));

        vm.prank(lender);
        lending.fundLoan(0);
        vm.prank(lender);
        lending.fundLoan(1);

        // Repay one
        vm.prank(borrower);
        lending.repayLoan(0);

        uint256[] memory activeIds = lending.getLenderActiveLoanIds(lender);
        assertEq(activeIds.length, 1);
        assertEq(activeIds[0], 1);
    }

    function test_totalLoansEmpty() public view {
        assertEq(lending.totalLoans(), 0);
    }

    // ════════════════════════════════════════════
    //  Integration — full lifecycle
    // ════════════════════════════════════════════

    function test_fullLoanLifecycle() public {
        // 1. Borrower creates loan request
        uint256 deadline = block.timestamp + 30 days;
        vm.prank(borrower);
        uint256 loanId = lending.createLoanRequest(500 * ONE_USDC, 550 * ONE_USDC, deadline, lender);

        // 2. Verify open state
        AgentMicrolending.LoanRequest memory loan = lending.getLoan(loanId);
        assertEq(uint8(loan.status), uint8(AgentMicrolending.LoanStatus.Open));

        // 3. Lender funds it
        uint256 borrowerBal = usdc.balanceOf(borrower);
        vm.prank(lender);
        lending.fundLoan(loanId);
        assertEq(usdc.balanceOf(borrower), borrowerBal + 500 * ONE_USDC);

        // 4. Borrower repays within deadline
        uint256 lenderBal = usdc.balanceOf(lender);
        vm.prank(borrower);
        lending.repayLoan(loanId);
        assertEq(usdc.balanceOf(lender), lenderBal + 550 * ONE_USDC);

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

        // Mint and approve for agents
        usdc.mint(agent1, 1000 * ONE_USDC);
        usdc.mint(agent2, 1000 * ONE_USDC);
        usdc.mint(agent3, 1000 * ONE_USDC);
        vm.prank(agent1);
        usdc.approve(address(lending), type(uint256).max);
        vm.prank(agent2);
        usdc.approve(address(lending), type(uint256).max);
        vm.prank(agent3);
        usdc.approve(address(lending), type(uint256).max);

        // Agent1 requests loan from agent2
        vm.prank(agent1);
        uint256 loan1 = lending.createLoanRequest(100 * ONE_USDC, 105 * ONE_USDC, block.timestamp + 7 days, agent2);

        // Agent1 also requests open loan
        vm.prank(agent1);
        uint256 loan2 = lending.createLoanRequest(200 * ONE_USDC, 210 * ONE_USDC, block.timestamp + 14 days, address(0));

        // Agent2 funds first loan
        vm.prank(agent2);
        lending.fundLoan(loan1);

        // Agent3 funds open loan
        vm.prank(agent3);
        lending.fundLoan(loan2);

        // Agent1 repays both
        vm.prank(agent1);
        lending.repayLoan(loan1);

        vm.prank(agent1);
        lending.repayLoan(loan2);

        // Verify all repaid
        assertEq(uint8(lending.getLoan(loan1).status), uint8(AgentMicrolending.LoanStatus.Repaid));
        assertEq(uint8(lending.getLoan(loan2).status), uint8(AgentMicrolending.LoanStatus.Repaid));

        // Verify lookup correctness
        assertEq(lending.getBorrowerLoans(agent1).length, 2);
        assertEq(lending.getLenderLoans(agent2).length, 1);
        assertEq(lending.getLenderLoans(agent3).length, 1);
    }
}
