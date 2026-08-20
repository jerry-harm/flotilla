import {createHash} from "node:crypto"
import {getPubkey} from "@welshman/util"
import {Nip01Signer} from "@welshman/signer"

export type TestUser = {
  name: string
  secret: string
  pubkey: string
  signer: Nip01Signer
}

// Every identity this process can sign as. zooid authenticates each write and refuses an event
// whose author is not the authenticated pubkey, so seeding looks a fixture's author up here.
export const testUsersByPubkey = new Map<string, TestUser>()

const makeUser = (name: string, secret: string): TestUser => {
  const user = {name, secret, pubkey: getPubkey(secret), signer: new Nip01Signer(secret)}

  testUsersByPubkey.set(user.pubkey, user)

  return user
}

// The secrets are near-zero entropy on purpose: they never leave the test process, they are
// stable across runs so a pubkey can be asserted on directly, and the leading nibbles make an
// event's author recognizable at a glance in a failed-assertion diff.
export const users = {
  alice: makeUser("alice", "a11ce00000000000000000000000000000000000000000000000000000000001"),
  bob: makeUser("bob", "b0b0000000000000000000000000000000000000000000000000000000000002"),
  carol: makeUser("carol", "ca20100000000000000000000000000000000000000000000000000000000003"),
  admin: makeUser("admin", "ad31100000000000000000000000000000000000000000000000000000000004"),
}

// secp256k1's group order. A secret is a scalar in [1, n), and a hash lands outside that range
// only astronomically rarely, but reducing rather than rejecting keeps the derivation total.
const CURVE_ORDER = BigInt("0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141")

/**
 * A fifth, sixth, hundredth identity, named rather than listed. The secret is derived from the
 * name, so the pubkey is as stable across runs as the four above, and minting one registers it —
 * a scenario can seed a profile, a message or a follow for it like any other test user.
 */
export const makeTestUser = (name: string) => {
  const digest = BigInt("0x" + createHash("sha256").update(name).digest("hex"))
  const secret = ((digest % (CURVE_ORDER - 1n)) + 1n).toString(16).padStart(64, "0")

  return makeUser(name, secret)
}
