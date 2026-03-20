// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {AgentMicrolending} from "../src/AgentMicrolending.sol";

contract Deploy is Script {
    // USDC on Celo
    address constant CELO_USDC = 0xcebA9300f2b948710d2653dD7B07f33A8B32118C;

    function run() external {
        vm.startBroadcast();

        AgentMicrolending lending = new AgentMicrolending(CELO_USDC);

        console.log("AgentMicrolending:", address(lending));
        console.log("Token (USDC):", CELO_USDC);

        vm.stopBroadcast();
    }
}
