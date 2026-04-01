// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;
import "forge-std/Script.sol";
import "../contracts/ServiceAgreement.sol";
contract DeploySA is Script {
    function run() external {
        vm.startBroadcast();
        ServiceAgreement sa = new ServiceAgreement();
        console.log("ServiceAgreement:", address(sa));
        vm.stopBroadcast();
    }
}