import {getPubkey} from "@welshman/util"
import {Nip01Signer} from "@welshman/signer"

export type TestUser = {
  name: string
  secret: string
  pubkey: string
  signer: Nip01Signer
}

const makeUser = (name: string, secret: string): TestUser => ({
  name,
  secret,
  pubkey: getPubkey(secret),
  signer: new Nip01Signer(secret),
})

// The secrets are near-zero entropy on purpose: they never leave the test process, they are
// stable across runs so a pubkey can be asserted on directly, and the leading nibbles make an
// event's author recognizable at a glance in a failed-assertion diff.
export const users = {
  alice: makeUser("alice", "a11ce00000000000000000000000000000000000000000000000000000000001"),
  bob: makeUser("bob", "b0b0000000000000000000000000000000000000000000000000000000000002"),
  carol: makeUser("carol", "ca20100000000000000000000000000000000000000000000000000000000003"),
  admin: makeUser("admin", "ad31100000000000000000000000000000000000000000000000000000000004"),
}
