/**
 * The virtual relays the container serves, and the only place their names are written down.
 *
 * zooid is multi-tenant: it binds a config to a Host header and serves any number of them from one
 * process, so a second space costs a toml in docker/config and nothing else. The names are a union
 * rather than a string so that a scenario naming a relay that has no config fails to compile
 * instead of hanging on a 404 from the dispatcher.
 *
 * Each host is a name that resolves nowhere. The container is reached on loopback and told what to
 * call itself, so that what it calls itself is a url a relay selection will keep — see transport.ts
 * for why that matters, and `.test` is reserved by rfc 2606, so a url that escapes this process
 * fails to connect rather than reaching a host.
 */
export const tenants = {
  space: "space.test",
  other: "other.test",
  // Policy that space.toml cannot express at the same time: one that refuses a join without an
  // invite, and one that serves events with their signatures stripped.
  closed: "closed.test",
  unsigned: "unsigned.test",
} as const

export type TenantName = keyof typeof tenants

export const tenantUrl = (name: TenantName) => `wss://${tenants[name]}/`

export const tenantNames = Object.keys(tenants) as TenantName[]

// Which tenant a url belongs to, for the transport's Host header. A url the app opens that is not
// one of these is a leak, and is reported as one rather than dialled.
export const tenantByUrl = new Map(tenantNames.map(name => [tenantUrl(name), tenants[name]]))
