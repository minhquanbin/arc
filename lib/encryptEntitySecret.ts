/**
 * Dynamic Entity Secret Encryption Utility
 * 
 * This module encrypts entity secret on-demand for each API call
 * to comply with Circle's "no reuse" policy.
 */

import crypto from "crypto";

let cachedPublicKey: string | null = null;

/**
 * Get Circle's public key (cached to reduce API calls)
 */
async function getCirclePublicKey(apiKey: string): Promise<string> {
  // Return cached key if available
  if (cachedPublicKey !== null) {
    return cachedPublicKey;
  }

  const response = await fetch(
    "https://api.circle.com/v1/w3s/config/entity/publicKey",
    {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to fetch public key: ${response.status} - ${error}`);
  }

  const { data } = await response.json();
  const publicKeyPem: string = data?.publicKey?.publicKey;
  
  if (!publicKeyPem || typeof publicKeyPem !== 'string') {
    throw new Error("Public key not found in response");
  }
  
  // Cache and return
  cachedPublicKey = publicKeyPem;
  return publicKeyPem;
}

/**
 * Encrypt entity secret using Circle's public key
 * 
 * @param entitySecret Raw entity secret (64 hex chars)
 * @param apiKey Circle API key
 * @returns Fresh encrypted ciphertext
 */
export async function encryptEntitySecret(
  entitySecret: string,
  apiKey: string
): Promise<string> {
  try {
    // Get Circle's public key
    const publicKeyPem = await getCirclePublicKey(apiKey);

    // Convert PEM to crypto key
    const publicKey = crypto.createPublicKey({
      key: publicKeyPem,
      format: 'pem',
    });

    // Encrypt using RSA-OAEP with SHA-256
    const encryptedBuffer = crypto.publicEncrypt(
      {
        key: publicKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      Buffer.from(entitySecret, 'hex')
    );

    return encryptedBuffer.toString('base64');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("Encryption error:", errorMessage);
    throw new Error(`Failed to encrypt entity secret: ${errorMessage}`);
  }
}

/**
 * Clear cached public key (useful for testing or key rotation)
 */
export function clearPublicKeyCache(): void {
  cachedPublicKey = null;
}