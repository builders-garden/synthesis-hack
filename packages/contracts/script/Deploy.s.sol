// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import {YieldVault} from "../src/YieldVault.sol";
import {YieldVaultFactory} from "../src/YieldVaultFactory.sol";

contract Deploy is Script {
    function run() external {
        vm.startBroadcast();

        YieldVault implementation = new YieldVault();
        YieldVaultFactory factory = new YieldVaultFactory(address(implementation));

        console.log("YieldVault implementation:", address(implementation));
        console.log("YieldVaultFactory:", address(factory));

        vm.stopBroadcast();
    }
}
