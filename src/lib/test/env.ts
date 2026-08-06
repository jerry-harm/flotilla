import type {Maybe} from "@welshman/lib"

// The window key Playwright writes to (see e2e/harness/app/boot.ts). Keep it in sync with the
// literal duplicated there.
export const TEST_ENV_KEY = "__TEST_ENV__"

// Consulted when the app resolves a VITE_ value, so each browser context can be pointed at the
// relays its own test created. Yields nothing for real users.
export const maybeGetTestEnv = (key: string): Maybe<string> =>
  (globalThis as {[TEST_ENV_KEY]?: Record<string, string>})[TEST_ENV_KEY]?.[key]
