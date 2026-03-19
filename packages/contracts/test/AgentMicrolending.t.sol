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
}
