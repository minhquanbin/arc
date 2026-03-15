"use client";

/**
 * useShelbyUpload
 * ---------------
 * React hook for uploading invoice metadata to Shelby decentralized storage.
 *
 * Flow:
 *  1. User connects EVM wallet (wagmi/RainbowKit)
 *  2. useStorageAccount derives a Shelby storage account from the EVM wallet via SIWE
 *  3. uploadMetadata() uploads JSON metadata to Shelby, with gas sponsored by geomi.dev
 *  4. Returns shelbyUrl + metadataHash (bytes32) for use in createInvoice()
 *
 * Required env vars in .env.local:
 *   NEXT_PUBLIC_SHELBY_API_KEY=AG-***         (from geomi.dev API Resource)
 *   NEXT_PUBLIC_SHELBY_GAS_STATION_KEY=GS-*** (from geomi.dev Gas Station)
 */

import { useMemo } from "react";
import { useWalletClient } from "wagmi";
import { keccak256, stringToHex } from "viem";
import { useStorageAccount } from "@shelby-protocol/ethereum-kit/react";
import { useUploadBlobs } from "@shelby-protocol/react";
import { ShelbyClient } from "@shelby-protocol/sdk/browser";

// ─── Config ──────────────────────────────────────────────────────────────────

const SHELBY_API_KEY = process.env.NEXT_PUBLIC_SHELBY_API_KEY ?? "";
const SHELBY_GAS_STATION_KEY = process.env.NEXT_PUBLIC_SHELBY_GAS_STATION_KEY ?? "";

// 1 year expiration from upload time (in microseconds)
const EXPIRATION_MICROS = () => Date.now() * 1000 + 1_000 * 60 * 60 * 24 * 365 * 1_000;

// ─── Types ────────────────────────────────────────────────────────────────────

export type InvoiceMetadata = {
  description: string;
  payer: string;     // 0x address
  vendor: string;    // 0x address
  amount: string;    // USDC amount as string (e.g. "100.00")
  dueDate: string;   // ISO date string (e.g. "2025-12-31")
  createdAt: number; // unix timestamp in seconds
};

export type UploadResult = {
  shelbyUrl: string;           // URL to fetch metadata: https://api.testnet.shelby.xyz/...
  metadataHash: `0x${string}`; // keccak256 of JSON — stored as metadataHash in InvoiceRegistry
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useShelbyUpload() {
  const { data: wallet } = useWalletClient();

  const shelbyClient = useMemo(
    () =>
      new ShelbyClient({
        network: "testnet" as any,
        apiKey: SHELBY_API_KEY,
        rpc: {
          baseUrl: "https://api.testnet.shelby.xyz/shelby",
        },
      }),
    []
  );

  // Derive Shelby storage account from the connected EVM wallet (no Aptos wallet needed)
  const { storageAccountAddress, signTransaction, submitTransaction } = useStorageAccount({
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore — duplicate sdk package causes type mismatch, runtime is correct
    client: shelbyClient as any,
    wallet: wallet ?? null,
  });

  const { mutateAsync: uploadBlobs, isPending: isUploading } = useUploadBlobs({
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore — duplicate sdk package causes type mismatch, runtime is correct
    client: shelbyClient as any,
  });

  // Sponsored flow: user signs, geomi.dev gas station submits.
  // Separating sign (user) from submit (gas station) so gas fees are covered.
  async function sponsoredSignAndSubmit(params: Parameters<typeof signTransaction>[0]) {
    const { authenticator, rawTransaction } = await signTransaction(params);
    // @ts-ignore — SubmitTransactionInput shape differs between package versions
    return submitTransaction({ authenticator, rawTransaction } as any);
  }

  /**
   * Uploads invoice metadata JSON to Shelby.
   * Gas is sponsored by geomi.dev — users do not need ShelbyUSD.
   *
   * @returns shelbyUrl and metadataHash for use in createInvoice()
   */
  async function uploadMetadata(metadata: InvoiceMetadata): Promise<UploadResult> {
    if (!storageAccountAddress) {
      throw new Error("Shelby storage account not ready. Please connect your wallet first.");
    }

    const blobName = `invoice-${Date.now()}.json`;
    const metadataJson = JSON.stringify(metadata, null, 2);
    const blobData = new TextEncoder().encode(metadataJson);

    await uploadBlobs({
      signer: {
        account: storageAccountAddress,
        signAndSubmitTransaction: sponsoredSignAndSubmit,
      },
      blobs: [{ blobName, blobData }],
      expirationMicros: EXPIRATION_MICROS(),
    });

    const shelbyUrl = `https://api.testnet.shelby.xyz/shelby/v1/blobs/${storageAccountAddress.toStringLong()}/${blobName}`;

    // Hash the JSON content → bytes32 stored on-chain in InvoiceRegistry.
    // Anyone can verify: fetch shelbyUrl → keccak256 → must match the on-chain metadataHash.
    const metadataHash = keccak256(stringToHex(metadataJson)) as `0x${string}`;

    return { shelbyUrl, metadataHash };
  }

  return {
    uploadMetadata,
    isUploading,
    isReady: Boolean(wallet && storageAccountAddress),
    storageAccountAddress,
  };
}