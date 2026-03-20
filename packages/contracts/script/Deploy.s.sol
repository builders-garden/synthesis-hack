// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {AgentMicrolending} from "../src/AgentMicrolending.sol";

contract Deploy is Script {
    // USDC on Celo
    address constant CELO_USDC = 0xcebA9300f2b948710d2653dD7B07f33A8B32118C;
    // Self Agent Registry on Celo
    address constant SELF_REGISTRY = 0x62E37d0f6c5f67784b8828B3dF68BCDbB2e55095;

    function run() external {
        vm.startBroadcast();

        AgentMicrolending lending = new AgentMicrolending(CELO_USDC, SELF_REGISTRY);

        console.log("AgentMicrolending:", address(lending));
        console.log("Token (USDC):", CELO_USDC);
        console.log("Self Registry:", SELF_REGISTRY);

        vm.stopBroadcast();
    }
}
