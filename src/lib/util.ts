import {identity, range, DAY, hexToBytes, bytesToHex} from "@welshman/lib"
import {fromNostrURI} from "@welshman/util"
import * as nip19 from "nostr-tools/nip19"
import {gcm} from "@noble/ciphers/aes.js"

export const decodePubkey = (entity: string): string | undefined => {
  if (/^[a-f0-9]{64}$/i.test(entity)) {
    return entity.toLowerCase()
  }

  try {
    const decoded = nip19.decode(fromNostrURI(entity))

    if (decoded.type === "npub") {
      return decoded.data
    }

    if (decoded.type === "nprofile") {
      return decoded.data.pubkey
    }

    return undefined
  } catch {
    return undefined
  }
}

export const nsecEncode = (secret: string) => nip19.nsecEncode(hexToBytes(secret))

export const nsecDecode = (nsec: string) => {
  const {type, data} = nip19.decode(nsec)

  if (type !== "nsec") throw new Error(`Invalid nsec: ${nsec}`)

  return bytesToHex(data)
}

export const day = (seconds: number) => Math.floor(seconds / DAY)

export const daysBetween = (start: number, end: number) => [...range(start, end, DAY)].map(day)

export const ucFirst = (s: string) => s.slice(0, 1).toUpperCase() + s.slice(1)

export const errorMessage = (err: unknown) => String(err).replace(/^.*Error: /, "")

export class AbortError extends Error {
  constructor() {
    super("Aborted")
    this.name = "AbortError"
  }
}

export class TimeoutError extends Error {
  constructor(message = "Timed out") {
    super(message)
    this.name = "TimeoutError"
  }
}

/** Returns a promise that rejects with AbortError when signal aborts. Use with Promise.race. */
export const whenAborted = (signal?: AbortSignal) => {
  if (!signal) return new Promise<never>(() => {})

  return new Promise<never>((_, reject) => {
    const onAborted = () => reject(new AbortError())
    if (signal.aborted) onAborted()
    else signal.addEventListener("abort", onAborted, {once: true})
  })
}

/**
 * Returns a promise that rejects with TimeoutError after ms. Use with Promise.race.
 * Pass an optional signal to clear the timer when that signal aborts (self-cleaning).
 */
export const whenTimeout = (ms: number, opts: {message?: string; signal?: AbortSignal} = {}) => {
  return new Promise<never>((_, reject) => {
    const timeout = setTimeout(() => reject(new TimeoutError(opts.message)), ms)
    opts.signal?.addEventListener("abort", () => clearTimeout(timeout), {once: true})
  })
}

export const buildUrl = (base: string | URL, ...pathname: string[]) => {
  const url = new URL(base)

  url.pathname = "/" + pathname.join("/")

  return url.toString()
}

export const addPeriod = (s: string) => (s + ".").replace(/\.+$/, ".")

export const normalizeTopic = (topic: string) => topic.trim().replace(/^#+/, "").toLowerCase()

export const fromCsv = (s: string) => (s || "").split(",").filter(identity)

export const stripPrefix = (m: string) => m.replace(/^\w+: /, "")

const sha256K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
])

const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n))

// crypto.subtle is only exposed in secure contexts (https or localhost), so fall back to a
// pure-JS implementation when the app is served over plain http.
export const sha256 = async (data: ArrayBuffer) => {
  if (crypto.subtle) {
    return bytesToHex(new Uint8Array(await crypto.subtle.digest("SHA-256", data)))
  }

  const bytes = new Uint8Array(data)
  const paddedLen = (((bytes.length + 8) >> 6) + 1) * 64
  const padded = new Uint8Array(paddedLen)
  padded.set(bytes)
  padded[bytes.length] = 0x80

  const dv = new DataView(padded.buffer)
  dv.setUint32(paddedLen - 8, Math.floor((bytes.length * 8) / 2 ** 32))
  dv.setUint32(paddedLen - 4, (bytes.length * 8) >>> 0)

  let h0 = 0x6a09e667,
    h1 = 0xbb67ae85,
    h2 = 0x3c6ef372,
    h3 = 0xa54ff53a
  let h4 = 0x510e527f,
    h5 = 0x9b05688c,
    h6 = 0x1f83d9ab,
    h7 = 0x5be0cd19
  const w = new Uint32Array(64)

  for (let i = 0; i < paddedLen; i += 64) {
    for (let j = 0; j < 16; j++) {
      w[j] = dv.getUint32(i + j * 4)
    }

    for (let j = 16; j < 64; j++) {
      const s0 = rotr(w[j - 15], 7) ^ rotr(w[j - 15], 18) ^ (w[j - 15] >>> 3)
      const s1 = rotr(w[j - 2], 17) ^ rotr(w[j - 2], 19) ^ (w[j - 2] >>> 10)
      w[j] = (w[j - 16] + s0 + w[j - 7] + s1) >>> 0
    }

    let a = h0,
      b = h1,
      c = h2,
      d = h3,
      e = h4,
      f = h5,
      g = h6,
      h = h7

    for (let j = 0; j < 64; j++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
      const t1 = (h + S1 + ((e & f) ^ (~e & g)) + sha256K[j] + w[j]) >>> 0
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
      const t2 = (S0 + ((a & b) ^ (a & c) ^ (b & c))) >>> 0

      h = g
      g = f
      f = e
      e = (d + t1) >>> 0
      d = c
      c = b
      b = a
      a = (t1 + t2) >>> 0
    }

    h0 = (h0 + a) >>> 0
    h1 = (h1 + b) >>> 0
    h2 = (h2 + c) >>> 0
    h3 = (h3 + d) >>> 0
    h4 = (h4 + e) >>> 0
    h5 = (h5 + f) >>> 0
    h6 = (h6 + g) >>> 0
    h7 = (h7 + h) >>> 0
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7].map(n => n.toString(16).padStart(8, "0")).join("")
}

export type EncryptedFile = {
  ciphertext: Uint8Array
  key: string
  nonce: string
  algorithm: "aes-gcm"
}

// Same deal as sha256 above: crypto.subtle is missing on plain http, so encrypt with a
// pure-JS AES-GCM instead. Both paths emit standard AES-GCM, so files cross-decrypt.
export const encryptFile = async (file: File): Promise<EncryptedFile> => {
  const key = crypto.getRandomValues(new Uint8Array(32))
  const nonce = crypto.getRandomValues(new Uint8Array(12))
  const fileBuffer = new Uint8Array(await file.arrayBuffer())

  const ciphertext = crypto.subtle
    ? new Uint8Array(
        await crypto.subtle.encrypt(
          {name: "AES-GCM", iv: nonce},
          await crypto.subtle.importKey("raw", key, {name: "AES-GCM"}, true, ["encrypt"]),
          fileBuffer,
        ),
      )
    : gcm(key, nonce).encrypt(fileBuffer)

  return {ciphertext, key: bytesToHex(key), nonce: bytesToHex(nonce), algorithm: "aes-gcm"}
}

export const decryptFile = async ({ciphertext, key, nonce, algorithm}: EncryptedFile) => {
  if (algorithm !== "aes-gcm") {
    throw new Error(`Unknown algorithm ${algorithm}`)
  }

  const keyBytes = Uint8Array.from(hexToBytes(key))
  const iv = Uint8Array.from(hexToBytes(nonce))

  if (crypto.subtle) {
    const cryptoKey = await crypto.subtle.importKey("raw", keyBytes, {name: "AES-GCM"}, false, [
      "decrypt",
    ])

    return new Uint8Array(
      await crypto.subtle.decrypt({name: "AES-GCM", iv}, cryptoKey, Uint8Array.from(ciphertext)),
    )
  }

  return gcm(keyBytes, iv).decrypt(ciphertext)
}
