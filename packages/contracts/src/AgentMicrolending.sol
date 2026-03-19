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



    /// @notice Cancel an open (unfunded) loan request.
    /// @param loanId The loan to cancel.
    function cancelLoanRequest(uint256 loanId) external {
        LoanRequest storage loan = loans[loanId];

        if (msg.sender != loan.borrower) revert NotBorrower();
        if (loan.status != LoanStatus.Open) revert LoanNotOpen();

        loan.status = LoanStatus.Cancelled;

        emit LoanCancelled(loanId);
    }

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

    // ──────────────────────────────────────────────
    //  Borrower repayment

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

    // ──────────────────────────────────────────────

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
    // ──────────────────────────────────────────────
    //  View functions
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

    /// @notice Get paginated list of open loan requests.
    /// @param offset Start index (skips non-open loans, counts only open ones).
    /// @param limit  Max number of open loans to return.
    function getOpenLoans(uint256 offset, uint256 limit) external view returns (LoanRequest[] memory) {
        uint256 total = loans.length;
        uint256 openCount = 0;
        for (uint256 i = 0; i < total; i++) {
            if (loans[i].status == LoanStatus.Open) openCount++;
        }

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
}
