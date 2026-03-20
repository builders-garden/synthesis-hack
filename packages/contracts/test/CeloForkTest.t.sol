// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {AgentMicrolending, ISelfAgentRegistry} from "../src/AgentMicrolending.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @dev Extended Self Agent Registry interface for querying.
interface ISelfAgentRegistryFull {
    function getAgentWallet(uint256 agentId) external view returns (address);
    function hasHumanProof(uint256 agentId) external view returns (bool);
    function walletSetNonces(uint256 agentId) external view returns (uint256);
}

/// @title CeloForkTest
/// @notice Forks Celo mainnet, impersonates two addresses, and tests whether
///         they can create loans via the AgentMicrolending protocol.
///         Checks Self protocol delegation (human-backed identity) for each.
contract CeloForkTest is Test {
    // Celo Mainnet Addresses
    address constant CELO_USDC = 0xcebA9300f2b948710d2653dD7B07f33A8B32118C;
    // Self Agent Registry on Celo (used in deployed AgentMicrolending constructor)
    address constant SELF_REGISTRY = 0xaC3DF9ABf80d0F5c020C06B04Cced27763355944;

    // Addresses to investigate
    address constant ADDR_1 = 0x31493cA48BC88f0Ee2Ecd96f4D87251046825d65;
    address constant ADDR_2 = 0x1358155a15930f89eBc787a34Eb4ccfd9720bC62;

    // Protocol state
    AgentMicrolending lending;
    ISelfAgentRegistryFull registry;
    IERC20 usdc;

    // Discovered agent IDs
    uint256 addr1AgentId;
    uint256 addr2AgentId;
    bool addr1Found;
    bool addr2Found;

    // Scan range for agent IDs
    uint256 constant SCAN_MAX = 1000;

    function setUp() public {
        string memory celoRpc = vm.envOr("CELO_RPC_URL", string("https://forno.celo.org"));
        vm.createSelectFork(celoRpc);

        registry = ISelfAgentRegistryFull(SELF_REGISTRY);
        usdc = IERC20(CELO_USDC);

        // Deploy lending contract on the fork with the correct registry
        lending = new AgentMicrolending(CELO_USDC, SELF_REGISTRY);

        // Scan for agent IDs linked to our target addresses
        _scanForAgentIds();
    }

    /// @dev Scans agent IDs 0..SCAN_MAX to find which ones are linked to ADDR_1 or ADDR_2.
    function _scanForAgentIds() internal {
        for (uint256 i = 0; i <= SCAN_MAX; i++) {
            try registry.getAgentWallet(i) returns (address wallet) {
                if (wallet == ADDR_1 && !addr1Found) {
                    addr1AgentId = i;
                    addr1Found = true;
                }
                if (wallet == ADDR_2 && !addr2Found) {
                    addr2AgentId = i;
                    addr2Found = true;
                }
                if (addr1Found && addr2Found) break;
            } catch {
                // Agent ID doesn't exist or reverts, continue
            }
        }
    }

    // ============================================================
    //  Address 1: 0x31493cA48BC88f0Ee2Ecd96f4D87251046825d65
    // ============================================================

    function test_addr1_registryLookup() public {
        emit log_named_address("Address 1", ADDR_1);
        emit log_named_string("Agent ID Found", addr1Found ? "YES" : "NO");
        if (addr1Found) {
            emit log_named_uint("Agent ID", addr1AgentId);

            address linkedWallet = registry.getAgentWallet(addr1AgentId);
            emit log_named_address("Linked Wallet", linkedWallet);
            assertEq(linkedWallet, ADDR_1, "Wallet mismatch");

            bool humanProof = registry.hasHumanProof(addr1AgentId);
            emit log_named_string("Has Human Proof", humanProof ? "YES" : "NO");
        }
    }

    function test_addr1_usdcBalance() public {
        uint256 balance = usdc.balanceOf(ADDR_1);
        emit log_named_address("Address 1", ADDR_1);
        emit log_named_uint("USDC Balance (raw)", balance);
        emit log_named_uint("USDC Balance (human-readable)", balance / 1e6);
    }

    function test_addr1_createLoan() public {
        emit log_named_address("Address 1", ADDR_1);

        if (!addr1Found) {
            emit log_string("RESULT: No agent ID found in range 0-1000 for Address 1");
            emit log_string("CANNOT create loan - address NOT registered in Self Agent Registry");
            emit log_string("DELEGATION: NOT delegated by a human");

            // Confirm the revert by trying with agentId=0
            deal(CELO_USDC, ADDR_1, 1000e6);
            vm.prank(ADDR_1);
            usdc.approve(address(lending), type(uint256).max);

            vm.prank(ADDR_1);
            vm.expectRevert();
            lending.createLoanRequest(100e6, 110e6, block.timestamp + 30 days, address(0), 0);
            emit log_string("CONFIRMED: createLoanRequest reverts (NotVerifiedAgent)");
            return;
        }

        bool humanProof = registry.hasHumanProof(addr1AgentId);
        emit log_named_uint("Agent ID", addr1AgentId);
        emit log_named_string("Human Proof", humanProof ? "YES" : "NO");

        deal(CELO_USDC, ADDR_1, 1000e6);
        vm.prank(ADDR_1);
        usdc.approve(address(lending), type(uint256).max);

        uint256 amount = 100e6;
        uint256 repayAmount = 110e6;
        uint256 deadline = block.timestamp + 30 days;

        if (humanProof) {
            vm.prank(ADDR_1);
            uint256 loanId = lending.createLoanRequest(amount, repayAmount, deadline, address(0), addr1AgentId);
            emit log_string("SUCCESS: Loan created!");
            emit log_named_uint("Loan ID", loanId);

            AgentMicrolending.LoanRequest memory loan = lending.getLoan(loanId);
            emit log_named_address("Borrower", loan.borrower);
            emit log_named_uint("Amount (USDC)", loan.amount / 1e6);
            emit log_named_uint("Repay Amount (USDC)", loan.repayAmount / 1e6);
            emit log_string("DELEGATION: IS backed by a human via Self protocol");
        } else {
            vm.prank(ADDR_1);
            vm.expectRevert();
            lending.createLoanRequest(amount, repayAmount, deadline, address(0), addr1AgentId);
            emit log_string("RESULT: Loan creation REVERTED - no human proof");
            emit log_string("DELEGATION: Agent ID exists but NOT human-delegated");
        }
    }

    // ============================================================
    //  Address 2: 0x1358155a15930f89eBc787a34Eb4ccfd9720bC62
    // ============================================================

    function test_addr2_registryLookup() public {
        emit log_named_address("Address 2", ADDR_2);
        emit log_named_string("Agent ID Found", addr2Found ? "YES" : "NO");
        if (addr2Found) {
            emit log_named_uint("Agent ID", addr2AgentId);

            address linkedWallet = registry.getAgentWallet(addr2AgentId);
            emit log_named_address("Linked Wallet", linkedWallet);
            assertEq(linkedWallet, ADDR_2, "Wallet mismatch");

            bool humanProof = registry.hasHumanProof(addr2AgentId);
            emit log_named_string("Has Human Proof", humanProof ? "YES" : "NO");
        }
    }

    function test_addr2_usdcBalance() public {
        uint256 balance = usdc.balanceOf(ADDR_2);
        emit log_named_address("Address 2", ADDR_2);
        emit log_named_uint("USDC Balance (raw)", balance);
        emit log_named_uint("USDC Balance (human-readable)", balance / 1e6);
    }

    function test_addr2_createLoan() public {
        emit log_named_address("Address 2", ADDR_2);

        if (!addr2Found) {
            emit log_string("RESULT: No agent ID found in range 0-1000 for Address 2");
            emit log_string("CANNOT create loan - address NOT registered in Self Agent Registry");
            emit log_string("DELEGATION: NOT delegated by a human");

            deal(CELO_USDC, ADDR_2, 1000e6);
            vm.prank(ADDR_2);
            usdc.approve(address(lending), type(uint256).max);

            vm.prank(ADDR_2);
            vm.expectRevert();
            lending.createLoanRequest(100e6, 110e6, block.timestamp + 30 days, address(0), 0);
            emit log_string("CONFIRMED: createLoanRequest reverts (NotVerifiedAgent)");
            return;
        }

        bool humanProof = registry.hasHumanProof(addr2AgentId);
        emit log_named_uint("Agent ID", addr2AgentId);
        emit log_named_string("Human Proof", humanProof ? "YES" : "NO");

        deal(CELO_USDC, ADDR_2, 1000e6);
        vm.prank(ADDR_2);
        usdc.approve(address(lending), type(uint256).max);

        uint256 amount = 100e6;
        uint256 repayAmount = 110e6;
        uint256 deadline = block.timestamp + 30 days;

        if (humanProof) {
            vm.prank(ADDR_2);
            uint256 loanId = lending.createLoanRequest(amount, repayAmount, deadline, address(0), addr2AgentId);
            emit log_string("SUCCESS: Loan created!");
            emit log_named_uint("Loan ID", loanId);

            AgentMicrolending.LoanRequest memory loan = lending.getLoan(loanId);
            emit log_named_address("Borrower", loan.borrower);
            emit log_named_uint("Amount (USDC)", loan.amount / 1e6);
            emit log_named_uint("Repay Amount (USDC)", loan.repayAmount / 1e6);
            emit log_string("DELEGATION: IS backed by a human via Self protocol");
        } else {
            vm.prank(ADDR_2);
            vm.expectRevert();
            lending.createLoanRequest(amount, repayAmount, deadline, address(0), addr2AgentId);
            emit log_string("RESULT: Loan creation REVERTED - no human proof");
            emit log_string("DELEGATION: Agent ID exists but NOT human-delegated");
        }
    }

    // ============================================================
    //  Combined comparison report
    // ============================================================

    function test_comparison_report() public {
        emit log_string("========== COMPARISON REPORT ==========");
        emit log_string("");

        // Address 1
        emit log_string("--- Address 1: 0x31493cA48BC88f0Ee2Ecd96f4D87251046825d65 ---");
        emit log_named_string("Registered in Self Registry", addr1Found ? "YES" : "NO");
        if (addr1Found) {
            emit log_named_uint("Agent ID", addr1AgentId);
            emit log_named_string("Has Human Proof", registry.hasHumanProof(addr1AgentId) ? "YES" : "NO");
        }
        emit log_named_uint("USDC Balance", usdc.balanceOf(ADDR_1) / 1e6);
        bool canCreate1 = addr1Found;
        if (addr1Found) {
            canCreate1 = registry.hasHumanProof(addr1AgentId);
        }
        emit log_named_string("Can Create Loan", canCreate1 ? "YES" : "NO");
        emit log_string("");

        // Address 2
        emit log_string("--- Address 2: 0x1358155a15930f89eBc787a34Eb4ccfd9720bC62 ---");
        emit log_named_string("Registered in Self Registry", addr2Found ? "YES" : "NO");
        if (addr2Found) {
            emit log_named_uint("Agent ID", addr2AgentId);
            emit log_named_string("Has Human Proof", registry.hasHumanProof(addr2AgentId) ? "YES" : "NO");
        }
        emit log_named_uint("USDC Balance", usdc.balanceOf(ADDR_2) / 1e6);
        bool canCreate2 = addr2Found;
        if (addr2Found) {
            canCreate2 = registry.hasHumanProof(addr2AgentId);
        }
        emit log_named_string("Can Create Loan", canCreate2 ? "YES" : "NO");
    }
}
