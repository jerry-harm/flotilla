import type {Maybe} from "@welshman/lib"
import type {TrustedEvent} from "@welshman/util"
import type {Session} from "@welshman/app"

// The window keys Playwright writes to (see e2e/harness/app/session.ts). Keep them in sync with
// the literals duplicated there.
export const TEST_SESSION_KEY = "__TEST_SESSION__"

export const TEST_EVENTS_KEY = "__TEST_EVENTS__"

// Called when the session is restored at startup. Yields a session only when Playwright has
// injected one, so it is a no-op for real users.
export const maybeGetTestSession = (): Maybe<Session> =>
  (globalThis as {[TEST_SESSION_KEY]?: Session})[TEST_SESSION_KEY]

// The events a returning user's client would have found in storage, loaded into the repository
// alongside the injected session so a test boots into a state the app can reach on its own.
export const getTestEvents = (): TrustedEvent[] =>
  (globalThis as {[TEST_EVENTS_KEY]?: TrustedEvent[]})[TEST_EVENTS_KEY] ?? []
