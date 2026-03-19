// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {AgentMicrolending} from "../src/AgentMicrolending.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        AgentMicrolending lending = new AgentMicrolending();
        console.log("AgentMicrolending deployed at:", address(lending));

        vm.stopBroadcast();
    }
}
