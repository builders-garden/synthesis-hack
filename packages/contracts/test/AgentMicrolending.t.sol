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
        uint256 loanId = _createDefaultLoan();

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

}
