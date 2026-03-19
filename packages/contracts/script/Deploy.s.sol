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
