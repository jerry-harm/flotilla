import {test as base, expect} from "@playwright/test"
import type {BrowserContext, BrowserContextOptions, Page} from "@playwright/test"
import type {Maybe, MaybeAsync} from "@welshman/lib"
import {normalizeRelayUrl} from "@welshman/util"
import {Zooid, describeDockerProblem} from "./zooid/relay"
import {
  installHttpRoutes,
  mockAnalytics,
  mockDufflepud,
  mockHosting,
  mockImages,
  mockPushServer,
} from "./net/http"
import {assertNoLeaks, installWebSocketRoutes} from "./net/websocket"
import {boot} from "./app/boot"
import {seed} from "./seed/scenario"
import type {Scenario, SeedTools} from "./seed/scenario"
import type {TestUser} from "./keys"

export {expect}
export {users} from "./keys"
export type {TestUser} from "./keys"
export type {Scenario} from "./seed/scenario"
export type {SeededSpace} from "./seed/space"
export type {TenantName} from "./zooid/config"
export type {TranscriptEntry} from "./net/websocket"
export {formatTranscript, getTranscript} from "./net/websocket"
export {assertNoBlockedRequests, mockBlossom, mockLivekit} from "./net/http"

// Mirrors encodeRelay in src/app/relays.ts, which can't be imported here — it reaches the app's
// module graph, and with it sveltekit.
const encodeRelay = (url: string) =>
  encodeURIComponent(
    normalizeRelayUrl(url)
      .replace(/^wss:\/\//, "")
      .replace(/\/$/, ""),
  )

export const spacePath = (url: string) => `/spaces/${encodeRelay(url)}`

export const roomPath = (url: string, h: string) => `${spacePath(url)}/${h}`

export type Harness = {
  zooid: Zooid
  seed(build: (tools: SeedTools) => MaybeAsync<void>): Promise<Scenario>
  // A logged-in page for a user: its own browser context, its own storage, its own sockets into
  // the relays every other user is talking to. `options` overrides the project's context options,
  // for a spec that needs a viewport or colour scheme of its own.
  as(user: TestUser, path?: string, options?: BrowserContextOptions): Promise<Page>
}

export type HarnessFixtures = {
  harness: Harness
  seed: Harness["seed"]
  as: Harness["as"]
}

export type HarnessWorkerFixtures = {
  zooid: Zooid
}

export const test = base.extend<HarnessFixtures, HarnessWorkerFixtures>({
  // Playwright's own context — and the `page` fixture built on it — is unrouted: no websocket
  // interception, no http block-all, no injected env, and nothing collecting leaks from it. A page
  // born there boots the app against the relays baked into .env, which is the one thing this suite
  // exists to prevent, so it is refused outright and `as()` is the only way to get a page.
  context: async () => {
    throw new Error(
      "The built-in `context` and `page` fixtures reach the real network. Open a page with the " +
        "harness's `as(user, path)` fixture, which installs interception before it navigates.",
    )
  },
  // Playwright builds this one with `playwright.request.newContext()`, so it is an http client in
  // this process that belongs to no browser context: `installHttpRoutes` cannot see it and nothing
  // records what it sent.
  request: async () => {
    throw new Error(
      "The built-in `request` fixture makes http requests from node, where nothing intercepts " +
        "them. Anything the app fetches belongs in a mock installed by `as(user, path)`.",
    )
  },
  // One container per worker, torn down when the worker ends. It is reset between tests rather
  // than recreated, so the docker start-up cost is paid once.
  zooid: [
    // playwright reads a fixture's dependencies off this pattern, so it has to stay a pattern
    // even when there are none.
    // eslint-disable-next-line no-empty-pattern
    async ({}, use) => {
      const zooid = new Zooid()

      await use(zooid)
      await zooid.stop()
    },
    {scope: "worker"},
  ],
  harness: async ({zooid, browser}, use, testInfo) => {
    const dockerProblem = await describeDockerProblem()

    testInfo.skip(Boolean(dockerProblem), dockerProblem)

    await zooid.start()
    await zooid.reset()

    const contexts: BrowserContext[] = []

    let scenario: Maybe<Scenario>

    const requireScenario = () => {
      if (scenario) return scenario

      throw new Error("Seed a scenario before opening a page for a user")
    }

    const as = async (user: TestUser, path = "/", options: BrowserContextOptions = {}) => {
      const {urls, cache} = requireScenario()
      // The project's own `use` first, so a viewport, colour scheme or device descriptor set in
      // playwright.config.ts reaches the context rather than being silently dropped.
      //
      // A request a service worker makes is not seen by context.route, so a worker is the one
      // way out of the block-all below. Sveltekit registers src/service-worker.js on every
      // navigation in dev; it has no fetch handler today, and blocking registration is what keeps
      // that from being the thing containment rests on.
      const context = await browser.newContext({
        ...testInfo.project.use,
        serviceWorkers: "block",
        ...options,
      })

      contexts.push(context)

      // Interception before navigation, and the block-all before the mocks — playwright matches
      // the most recently registered route first, and every mock falls through what it doesn't
      // recognize, so the mocks have to be registered last to be reachable at all.
      await installHttpRoutes(context)
      await installWebSocketRoutes(context, zooid)
      await mockAnalytics(context)
      await mockDufflepud(context)
      await mockHosting(context)
      await mockPushServer(context)
      await mockImages(context)

      return boot(context, {user, path, relays: urls, spaces: urls, events: cache(user)})
    }

    await use({
      zooid,
      as,
      seed: async build => {
        scenario = await seed(zooid, build)

        return scenario
      },
    })

    for (const context of contexts) {
      await context.close()
    }

    for (const context of contexts) {
      assertNoLeaks(context)
    }
  },
  seed: async ({harness}, use) => use(harness.seed),
  as: async ({harness}, use) => use(harness.as),
})
