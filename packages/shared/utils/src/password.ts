/**
 * Password hashing using PBKDF2 via Web Crypto API.
 * Compatible with Cloudflare Workers (no Node.js crypto needed).
 */

const ITERATIONS = 100_000
const KEY_LENGTH = 32
const SALT_LENGTH = 16

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
  const key = await deriveKey(password, salt)
  const hash = await crypto.subtle.exportKey('raw', key)
  const hashArray = new Uint8Array(hash)

  // Format: base64(salt):base64(hash)
  return `${toBase64(salt)}:${toBase64(hashArray)}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltB64, hashB64] = stored.split(':')
  if (!saltB64 || !hashB64) return false

  const salt = fromBase64(saltB64)
  const storedHash = fromBase64(hashB64)
  const key = await deriveKey(password, salt)
  const derivedHash = new Uint8Array(await crypto.subtle.exportKey('raw', key))

  // Constant-time comparison
  if (derivedHash.length !== storedHash.length) return false
  let diff = 0
  for (let i = 0; i < derivedHash.length; i++) {
    diff |= derivedHash[i]! ^ storedHash[i]!
  }
  return diff === 0
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const encoder = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey'],
  )

  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations: ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH * 8 },
    true,
    ['encrypt'],
  )
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

function fromBase64(str: string): Uint8Array {
  const binary = atob(str)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

/**
 * Hash a 4-digit PIN for cashier quick-switch.
 */
export async function hashPin(pin: string): Promise<string> {
  return hashPassword(pin)
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  return verifyPassword(pin, stored)
}
