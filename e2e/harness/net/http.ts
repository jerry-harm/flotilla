import {createHash} from "node:crypto"
import type {BrowserContext} from "@playwright/test"
import {now} from "@welshman/lib"
import type {Handle} from "@welshman/util"
import type {ZapperValues} from "@welshman/domain"
import {tenantByUrl} from "../zooid/config"
import {requestZooid} from "../zooid/transport"

// Mirrors the service urls in src/app/env.ts and .env, which this process can't import: env.ts
// reads import.meta.env and pulls in Capacitor. Nothing here is ever fetched — these are route
// patterns, and every handler answers from memory.
const DUFFLEPUD_ORIGIN = "https://dufflepud.coracle.social"
const PUSH_SERVER_ORIGIN = "https://nps.flotilla.social"
const HOSTING_ORIGIN = "https://api.hosting.coracle.social"

// Hard-coded in src/app.html, so every navigation asks for it whatever the scenario is doing.
const PLAUSIBLE_ORIGIN = "https://plausible.coracle.social"

// Relay-hosted livekit lives under a well-known path rather than an origin of its own.
const LIVEKIT_PATH = "/.well-known/nip29/livekit"

// A 1x1 transparent png, small enough to inline and real enough for an <img> to decode.
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNgAAIAAAUAAen63NgAAAAASUVORK5CYII=",
  "base64",
)

// The dev server from vite.config.ts. Traffic to it is the app loading itself rather than egress,
// so it is the one host both layers here let past, websockets included — Vite's hmr socket has to
// keep working.
export const isDevServerUrl = (url: URL) =>
  url.port === "1847" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)

export type BlockedRequest = {
  method: string
  url: string
}

const blockedByContext = new WeakMap<BrowserContext, BlockedRequest[]>()

export const getBlockedRequests = (context: BrowserContext) => {
  const blocked = blockedByContext.get(context)

  if (blocked) {
    return blocked
  }

  throw new Error("installHttpRoutes was never called for this browser context")
}

/**
 * Blocks every http request the app makes, except to the dev server and to a relay's own origin,
 * which is forwarded to the container so that the nip-11 document and the nip-86 management api the
 * app reads are the real relay's. Install this first: the per-service mocks below are registered
 * later and therefore take priority, so a request that still reaches this handler is one nothing
 * has mocked.
 */
export const installHttpRoutes = (context: BrowserContext) => {
  const blocked: BlockedRequest[] = []
  const hostByOrigin = new Map(
    Array.from(tenantByUrl, ([url, host]): [string, string] => [
      new URL(url.replace(/^ws/, "http")).origin,
      host,
    ]),
  )

  blockedByContext.set(context, blocked)

  // The dev server is left unrouted rather than matched and continued: a sveltekit page in dev is
  // hundreds of module requests, and none of them is egress.
  return context.route(
    url => !isDevServerUrl(url),
    async route => {
      const request = route.request()
      const {origin, pathname, search} = new URL(request.url())

      const host = hostByOrigin.get(origin)

      if (host) {
        return route.fulfill(
          await requestZooid(
            host,
            request.method(),
            pathname + search,
            request.headers(),
            request.postDataBuffer() ?? undefined,
          ),
        )
      }

      blocked.push({method: request.method(), url: request.url()})

      return route.abort()
    },
  )
}

/**
 * Opt-in, for a spec that wants every request the app made to have been answered by something the
 * scenario stood up. Some of what a page asks for is meant to be refused — the blossom probe
 * against a relay with blossom off, for one — so call this from a spec that has mocked what it
 * exercises rather than from teardown.
 */
export const assertNoBlockedRequests = (context: BrowserContext) => {
  const blocked = getBlockedRequests(context)

  if (blocked.length > 0) {
    throw new Error(
      [
        `The app made ${blocked.length} http request(s) nothing served:`,
        ...blocked.map(({method, url}) => `  ${method} ${url}`),
      ].join("\n"),
    )
  }
}

/**
 * The analytics script src/app.html loads on every page. Answering with an empty body leaves
 * `window.plausible` as the queueing shim src/app/analytics.ts installs, so pageviews accumulate
 * in memory and nothing is ever sent — and `assertNoBlockedRequests` stays a statement about the
 * scenario rather than about the page shell.
 */
export const mockAnalytics = (context: BrowserContext) =>
  context.route(`${PLAUSIBLE_ORIGIN}/**`, route =>
    route.fulfill({contentType: "application/javascript", body: ""}),
  )

export type DufflepudFixtures = {
  // The remote half of the read-state sync in src/app/notifications.ts, keyed by path.
  checked?: Record<string, number>
  // A link preview is only rendered when it carries a title or an image.
  preview?: {title?: string; description?: string; image?: string}
  handles?: {handle: string; info?: Handle}[]
  // `lnurl` is hex here, not bech32 — that's the encoding dufflepud speaks.
  zappers?: {lnurl: string; info?: Omit<ZapperValues, "lnurl">}[]
}

export const mockDufflepud = (context: BrowserContext, fixtures: DufflepudFixtures = {}) =>
  context.route(`${DUFFLEPUD_ORIGIN}/**`, route => {
    const {pathname} = new URL(route.request().url())

    if (pathname === "/link/preview") {
      return route.fulfill({json: fixtures.preview ?? {}})
    }

    if (pathname === "/handle/info") {
      return route.fulfill({json: {data: fixtures.handles ?? []}})
    }

    if (pathname === "/zapper/info") {
      return route.fulfill({json: {data: fixtures.zappers ?? []}})
    }

    if (pathname === "/kv/checked") {
      return route.fulfill({
        json: route.request().method() === "GET" ? (fixtures.checked ?? {}) : {},
      })
    }

    return route.fallback()
  })

export type BlossomOptions = {
  // The blossom server the scenario expects an upload to land on, e.g. a space's own url.
  server: string
}

/**
 * A blossom server that keeps what it was given: an upload is hashed exactly as the real thing
 * would be, so the descriptor it answers with points at a blob this mock can then serve back.
 */
export const mockBlossom = (context: BrowserContext, {server}: BlossomOptions) => {
  const {origin} = new URL(server)
  const blobs = new Map<string, {body: Buffer; type: string}>()

  return context.route(`${origin}/**`, route => {
    const request = route.request()
    const method = request.method()
    const {pathname} = new URL(request.url())

    if (pathname === "/upload") {
      if (method === "HEAD") {
        return route.fulfill({status: 200, body: ""})
      }

      if (method === "PUT") {
        const body = request.postDataBuffer() ?? Buffer.alloc(0)
        const type = request.headers()["content-type"] ?? "application/octet-stream"
        const sha256 = createHash("sha256").update(body).digest("hex")

        blobs.set(sha256, {body, type})

        return route.fulfill({
          json: {sha256, type, url: `${origin}/${sha256}`, size: body.length, uploaded: now()},
        })
      }
    }

    const blob = blobs.get(pathname.slice(1).split(".")[0])

    if (blob) {
      return route.fulfill({
        contentType: blob.type,
        body: method === "HEAD" ? "" : blob.body,
      })
    }

    return route.fallback()
  })
}

/**
 * The push server from src/app/push/adapters/capacitor.ts. Only the native adapters talk to it,
 * so a browser run reaches this only if the platform detection regresses.
 */
export const mockPushServer = (context: BrowserContext) =>
  context.route(`${PUSH_SERVER_ORIGIN}/**`, route => {
    const [resource] = new URL(route.request().url()).pathname.split("/").filter(Boolean)

    if (resource === "subscription") {
      if (route.request().method() === "DELETE") {
        return route.fulfill({json: {}})
      }

      // Registration is only usable if it comes back with both, and the relay is told to post
      // notifications to the callback rather than the client ever fetching it.
      const key = "test-push-subscription"

      return route.fulfill({json: {key, callback: `${PUSH_SERVER_ORIGIN}/callback/${key}`}})
    }

    return route.fallback()
  })

// Records straight off the hosting api, whose shapes live in src/app/hosting.ts. They're typed as
// plain objects here so that mocking a payment flow doesn't pull the app's module graph — and
// with it import.meta.env — into the node process.
export type HostingFixtures = {
  plans?: object[]
  // Provisioning runs on every login and ignores what it gets back, so the empty default carries
  // any spec that isn't actually exercising the hosting ui.
  tenant?: object
  relays?: object[]
  invoices?: object[]
  draftInvoice?: object
}

export const mockHosting = (context: BrowserContext, fixtures: HostingFixtures = {}) =>
  context.route(`${HOSTING_ORIGIN}/**`, route => {
    const [resource, id, sub, detail] = new URL(route.request().url()).pathname
      .split("/")
      .filter(Boolean)

    if (resource === "plans") {
      return route.fulfill({json: {data: fixtures.plans ?? []}})
    }

    if (resource === "tenants") {
      if (sub) {
        if (sub === "relays") {
          return route.fulfill({json: {data: fixtures.relays ?? []}})
        }

        if (sub === "invoices") {
          const data = detail === "draft" ? fixtures.draftInvoice : (fixtures.invoices ?? [])

          return route.fulfill({json: {data}})
        }
      } else {
        return route.fulfill({json: {data: {pubkey: id, ...fixtures.tenant}}})
      }
    }

    return route.fallback()
  })

export type LivekitOptions = {
  // Where the client is told to connect. Point it at something the test owns — the token this
  // hands out is accepted by nothing else.
  serverUrl: string
  token?: string
}

export const mockLivekit = (context: BrowserContext, {serverUrl, token}: LivekitOptions) =>
  context.route(
    url => url.pathname.startsWith(LIVEKIT_PATH),
    route => {
      const roomId = new URL(route.request().url()).pathname.slice(LIVEKIT_PATH.length + 1)

      if (roomId) {
        return route.fulfill({
          json: {server_url: serverUrl, participant_token: token ?? "test-participant-token"},
        })
      }

      // The support probe in src/lib/livekit.ts reads support off the status alone.
      return route.fulfill({status: 204, body: ""})
    },
  )

/**
 * Serves a png for anything the browser is loading as an image — avatars, banners, blossom blobs,
 * video posters — so a scenario's fixtures can reference urls without any of them being fetched.
 */
export const mockImages = (context: BrowserContext) =>
  context.route(
    url => !isDevServerUrl(url),
    route => {
      if (route.request().resourceType() === "image") {
        return route.fulfill({contentType: "image/png", body: PNG})
      }

      return route.fallback()
    },
  )
