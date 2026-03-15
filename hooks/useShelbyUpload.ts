"use client";

import { useMemo } from "react";
import { useWalletClient } from "wagmi";
import { keccak256, stringToHex } from "viem";
import { useStorageAccount } from "@shelby-protocol/ethereum-kit/react";
import { Network } from "@aptos-labs/ts-sdk";
import { useUploadBlobs } from "@shelby-protocol/react";
import { ShelbyClient } from "@shelby-protocol/sdk/browser";

const SHELBY_API_KEY = process.env.NEXT_PUBLIC_SHELBY_API_KEY ?? "";
const SHELBY_GAS_STATION_KEY = process.env.NEXT_PUBLIC_SHELBY_GAS_STATION_KEY ?? "";

const EXPIRATION_MICROS = () => Date.now() * 1000 + 1_000 * 60 * 60 * 24 * 365 * 1_000;

export type InvoiceMetadata = {
  description: string;
  payer: string;
  vendor: string;
  amount: string;
  dueDate: string;
  createdAt: number;
};

export type UploadResult = {
  shelbyUrl: string;
  metadataHash: `0x${string}`;
};

export function useShelbyUpload() {
  const { data: wallet } = useWalletClient();

  const shelbyClient = useMemo(
    () =>
      new ShelbyClient({
        network: Network.TESTNET,
        apiKey: SHELBY_API_KEY,
        gasStationApiKey: SHELBY_GAS_STATION_KEY,
      }),
    []
  );

  const { storageAccountAddress, signAndSubmitTransaction } = useStorageAccount({
    client: shelbyClient,
    wallet: wallet ?? null,
  });

  const { mutateAsync: uploadBlobs, isPending: isUploading } = useUploadBlobs({
    client: shelbyClient,
  });

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
        signAndSubmitTransaction,
      },
      blobs: [{ blobName, blobData }],
      expirationMicros: EXPIRATION_MICROS(),
    });

    const shelbyUrl = `https://api.testnet.shelby.xyz/shelby/v1/blobs/${storageAccountAddress}/${blobName}`;
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