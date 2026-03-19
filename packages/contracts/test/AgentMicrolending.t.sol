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
