import type { Hash, ShopId } from '@rebond/types'

/**
 * Genesis hash for the first record in a chain.
 * hash(-1) = SHA-256("<shop_id>:genesis")
 * CDC 7.1
 */
export async function genesisHash(shopId: ShopId): Promise<Hash> {
  return computeHash(`${shopId}:genesis`)
}

/**
 * Compute SHA-256 hash from a string input.
 * Returns hex-encoded hash string.
 */
export async function computeHash(input: string): Promise<Hash> {
  const encoder = new TextEncoder()
  const data = encoder.encode(input)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('') as Hash
}

/**
 * Compute chained hash for ISCA compliance.
 * hash(N) = SHA-256(hash(N-1) || canonical_json(payload) || receipt_number || timestamp_utc)
 * CDC 7.1
 */
export async function computeChainedHash(
  previousHash: Hash,
  payload: Record<string, unknown>,
  receiptNumber: number,
  timestampUtc: number,
): Promise<Hash> {
  const canonicalJson = JSON.stringify(payload, Object.keys(payload).sort())
  const input = `${previousHash}${canonicalJson}${receiptNumber}${timestampUtc}`
  return computeHash(input)
}
