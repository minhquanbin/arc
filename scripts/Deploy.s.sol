// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "forge-std/Script.sol";
import "../contracts/ArbitratorNFT.sol";
import "../contracts/InvoiceEscrow.sol";
import "../contracts/Marketplace.sol";

/**
 * @notice Deploy all three contracts in order and wire them up.
 *
 * Usage:
 *   forge script scripts/Deploy.s.sol:Deploy \
 *     --rpc-url $ARC_TESTNET_RPC_URL \
 *     --private-key $PRIVATE_KEY \
 *     --broadcast -vvvv
 *
 * After deploying, copy the printed addresses into .env.local
 */
contract Deploy is Script {
    function run() external {
        address deployer      = vm.envAddress("DEPLOYER_ADDRESS");
        address treasury      = vm.envOr("TREASURY_ADDRESS",      deployer);
        address feeCollector  = vm.envOr("FEE_COLLECTOR_ADDRESS", deployer);

        vm.startBroadcast();

        // 1 — ArbitratorNFT
        ArbitratorNFT arbNFT = new ArbitratorNFT(treasury);
        console.log("ArbitratorNFT :", address(arbNFT));

        // 2 — InvoiceEscrow (needs ArbitratorNFT address)
        InvoiceEscrow escrow = new InvoiceEscrow(address(arbNFT), feeCollector);
        console.log("InvoiceEscrow :", address(escrow));

        // 3 — Wire escrow into ArbitratorNFT so it can record stats
        arbNFT.setInvoiceEscrow(address(escrow));
        console.log("ArbitratorNFT.invoiceEscrow set to InvoiceEscrow");

        // 4 — Marketplace
        Marketplace marketplace = new Marketplace(feeCollector);
        console.log("Marketplace   :", address(marketplace));

        vm.stopBroadcast();

        // Print .env.local snippet
        console.log("\n--- Copy to .env.local ---");
        console.log("NEXT_PUBLIC_ARBITRATOR_NFT_ADDRESS=", address(arbNFT));
        console.log("NEXT_PUBLIC_INVOICE_ESCROW_ADDRESS=", address(escrow));
        console.log("NEXT_PUBLIC_MARKETPLACE_ADDRESS=",    address(marketplace));
    }
}
