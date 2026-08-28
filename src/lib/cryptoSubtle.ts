import {gcm} from "@noble/ciphers/aes.js"
import {sha256Bytes} from "@lib/util"

// WebCrypto's subtle is only exposed in secure contexts (https or localhost), so deployments
// served over plain http (e.g. over i2p) have no crypto.subtle at all. welshman's negentropy
// sync and blossom uploads call it unconditionally, so inject a pure-JS implementation covering
// the subset they use (SHA-256 digest and AES-GCM) when it's missing. The native subtle is left
// untouched when available.
export const polyfillCryptoSubtle = () => {
  if (crypto.subtle) return

  const toBytes = (data: ArrayBuffer | ArrayBufferView) =>
    data instanceof ArrayBuffer
      ? new Uint8Array(data)
      : new Uint8Array(data.buffer, data.byteOffset, data.byteLength)

  const gcmKey = (raw: Uint8Array) => ({type: "secret", raw})

  Object.defineProperty(crypto, "subtle", {
    configurable: true,
    value: {
      digest: async (_algorithm: string, data: ArrayBuffer | ArrayBufferView) =>
        sha256Bytes(toBytes(data)),

      generateKey: async (_algorithm: {name: string; length?: number}, _extractable: boolean) =>
        gcmKey(crypto.getRandomValues(new Uint8Array(32))),

      importKey: async (_format: string, keyData: ArrayBuffer | ArrayBufferView) =>
        gcmKey(toBytes(keyData)),

      exportKey: async (_format: string, key: {raw: Uint8Array}) => key.raw.slice().buffer,

      encrypt: async (
        algorithm: {name: string; iv: ArrayBuffer | ArrayBufferView},
        key: {raw: Uint8Array},
        data: ArrayBuffer | ArrayBufferView,
      ) => gcm(key.raw, toBytes(algorithm.iv)).encrypt(toBytes(data)).slice().buffer,

      decrypt: async (
        algorithm: {name: string; iv: ArrayBuffer | ArrayBufferView},
        key: {raw: Uint8Array},
        data: ArrayBuffer | ArrayBufferView,
      ) => gcm(key.raw, toBytes(algorithm.iv)).decrypt(toBytes(data)).slice().buffer,
    },
  })
}
