/**
 * Pinata (IPFS) helpers used when launching a token.
 *
 * The JWT is a scoped key, safe-ish for a testnet hackathon build. Prefer
 * overriding it with `VITE_PINATA_JWT` in production.
 */

export const PINATA_JWT =
  import.meta.env.VITE_PINATA_JWT ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiI5MjAzZTJiMy0xZTAwLTQ4NjAtOTE1MS0zMDg4MzAwNzJmZmYiLCJlbWFpbCI6InBhcGE0bWFtYTR4NTAwQGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjp0cnVlLCJwaW5fcG9saWN5Ijp7InJlZ2lvbnMiOlt7ImRlc2lyZWRSZXBsaWNhdGlvbkNvdW50IjoxLCJpZCI6IkZSQTEifSx7ImRlc2lyZWRSZXBsaWNhdGlvbkNvdW50IjoxLCJpZCI6Ik5ZQzEifV0sInZlcnNpb24iOjF9LCJtZmFfZW5hYmxlZCI6ZmFsc2UsInN0YXR1cyI6IkFDVElWRSJ9LCJhdXRoZW50aWNhdGlvblR5cGUiOiJzY29wZWRLZXkiLCJzY29wZWRLZXlLZXkiOiIwNzYzYjRmNDdmNWY5MDE3NmQ1OCIsInNjb3BlZEtleVNlY3JldCI6IjAyZDgwNmNhNGQ0M2Y5ZGE4OGU1MDk0ZWE0MjdmYzZkNDY1OTk5OWMwZjJiZDA5MTc2ODVjNjMyYTdhZTZlNTQiLCJleHAiOjE4MTc0ODA1Njl9.niJTgunoL6bU8Dx48vG7ima_fu6C58NsyOXkPw2Y6Z8';

export const PINATA_GATEWAY = 'https://gateway.pinata.cloud/ipfs';

const PIN_FILE_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS';
const PIN_JSON_URL = 'https://api.pinata.cloud/pinning/pinJSONToIPFS';

export interface TokenMetadata {
  name: string;
  symbol: string;
  description: string;
  image: string;
  external_url?: string;
  attributes?: { trait_type: string; value: string | number }[];
  links?: {
    website?: string;
    twitter?: string;
    telegram?: string;
    discord?: string;
  };
}

export function ipfsToHttp(uri?: string | null): string {
  if (!uri) return '';
  if (uri.startsWith('ipfs://')) {
    return `${PINATA_GATEWAY}/${uri.slice('ipfs://'.length)}`;
  }
  return uri;
}

async function pinataFetch(url: string, body: BodyInit, headers: HeadersInit = {}) {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PINATA_JWT}`,
      ...headers,
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Pinata upload failed (${res.status}): ${text || res.statusText}`);
  }

  return (await res.json()) as { IpfsHash: string; PinSize: number; Timestamp: string };
}

/** Uploads an image / file and returns its `ipfs://<cid>` URI. */
export async function uploadFileToIPFS(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  form.append(
    'pinataMetadata',
    JSON.stringify({ name: `gemfot-${Date.now()}-${file.name}` })
  );
  form.append('pinataOptions', JSON.stringify({ cidVersion: 1 }));

  const { IpfsHash } = await pinataFetch(PIN_FILE_URL, form);
  return `ipfs://${IpfsHash}`;
}

/** Uploads the token metadata JSON and returns its `ipfs://<cid>` URI. */
export async function uploadMetadataToIPFS(metadata: TokenMetadata): Promise<string> {
  const body = JSON.stringify({
    pinataContent: metadata,
    pinataMetadata: { name: `gemfot-${metadata.symbol}-metadata.json` },
    pinataOptions: { cidVersion: 1 },
  });

  const { IpfsHash } = await pinataFetch(PIN_JSON_URL, body, {
    'Content-Type': 'application/json',
  });
  return `ipfs://${IpfsHash}`;
}

/** Convenience: upload image (optional) then metadata, returning the tokenUri. */
export async function uploadTokenMetadata(
  metadata: Omit<TokenMetadata, 'image'>,
  imageFile?: File | null
): Promise<{ tokenUri: string; imageUri: string }> {
  const imageUri = imageFile ? await uploadFileToIPFS(imageFile) : '';
  const tokenUri = await uploadMetadataToIPFS({ ...metadata, image: imageUri });
  return { tokenUri, imageUri };
}
