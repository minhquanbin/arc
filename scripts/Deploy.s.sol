// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "forge-std/Script.sol";
import "../contracts/ArbitratorNFT.sol";
import "../contracts/InvoiceEscrow.sol";
import "../contracts/Marketplace.sol";
import "../contracts/ServiceAgreement.sol";

contract Deploy is Script {
    function run() external {
        address deployer     = vm.envAddress("DEPLOYER_ADDRESS");
        address treasury     = vm.envOr("TREASURY_ADDRESS",     deployer);
        address feeCollector = vm.envOr("FEE_COLLECTOR_ADDRESS", deployer);

        vm.startBroadcast();

        ArbitratorNFT arbNFT = new ArbitratorNFT(treasury);
        console.log("ArbitratorNFT   :", address(arbNFT));

        InvoiceEscrow escrow = new InvoiceEscrow(address(arbNFT), feeCollector);
        console.log("InvoiceEscrow   :", address(escrow));

        arbNFT.setInvoiceEscrow(address(escrow));
        console.log("Escrow wired to ArbitratorNFT");

        Marketplace market = new Marketplace(feeCollector);
        console.log("Marketplace     :", address(market));

        ServiceAgreement sa = new ServiceAgreement();
        console.log("ServiceAgreement:", address(sa));

        vm.stopBroadcast();

        console.log("\n--- Copy to .env.local ---");
        console.log("NEXT_PUBLIC_ARBITRATOR_NFT_ADDRESS=",  address(arbNFT));
        console.log("NEXT_PUBLIC_INVOICE_ESCROW_ADDRESS=",  address(escrow));
        console.log("NEXT_PUBLIC_MARKETPLACE_ADDRESS=",     address(market));
        console.log("NEXT_PUBLIC_SERVICE_AGREEMENT_ADDRESS=", address(sa));
    }
}