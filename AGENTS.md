## Project Overview

Flotilla is a Nostr "relays as groups" community chat client. It implements NIP-29 (relay-based groups) to create Discord-like spaces (servers) and rooms (channels).

**Tech Stack:**

- SvelteKit 5.48+ with TypeScript 5.9+
- Capacitor for cross-platform (Web/PWA, Android, iOS)
- TailwindCSS for styling
- Welshman library suite for Nostr protocol
- IndexedDB for local storage
- Vite for building

**Key Concepts:**

- **Spaces** - Relays used as community groups (like Discord servers)
- **Rooms** - NIP-29 groups within spaces (like Discord channels), identified by `h`
- **Chats** - Direct message conversations (NIP-04/NIP-44 encrypted)

## Architecture & Dependency Graph

The project follows a **strict acyclic dependency hierarchy**:

```
routes/                    (top layer - can depend on anything)
  ↓
app/components/            (can depend on app/* and lib/*)
  ↓
app/*                      (can only depend on lib/*)
  ↓
lib/                       (can only depend on external libraries)
  ↓
external libraries         (bottom layer)
```

**Import Ordering Convention (CRITICAL):**
Always sort imports by dependency level:

1. Third-party libraries first
2. Then `lib/` imports
3. Then `app/` imports

Example:

```typescript
import {derived} from "svelte/store"
import {throttle} from "throttle-debounce"
import {Dialog} from "$lib/components"
import {repository} from "$app/core/state"
```

## Cleanup Pass

These are the things that most often get fixed by hand after the fact. Go through
them before handing work back. The full style reference is under Development
Conventions below.

- **Comments** — only for genuinely surprising things: a workaround, a constraint imposed by a backend or platform, an invariant that isn't visible from the code in front of you. Never comment props, never restate what the next line does, never justify an ordinary decision. If a small refactor would make the comment stale, don't write it.
- **Used once, inlined** — a derived value, helper, type, or named constant with a single use is indirection. Write `setTimeout(pollOnce, 3500)`, not a `POLL_INTERVAL` referenced twice in one file. Name something only when the name is what makes the code readable.
- **Positive conditionals** — prefer `if (ready) { ... }` over `if (!ready) return`. Nesting is fine; when it gets deep that's the signal the function is doing too much, so split it. Many early returns belong in validation or pipeline functions, not everywhere else.
- **Truthiness** — test values directly (`if (invoice.paid_at)`) instead of comparing against `null`/`undefined`, and put the truthy branch first in a ternary.
- **Standard names** — `loading` for in-flight state, `on*` for handlers bound to an event, a plain verb (`submit`, `save`) for the action itself. Use `{prop}` shorthand when the names match.
- **Errors** — toast a human-readable message and `console.error` anything unexpected (e.g. a non-`HostingError`). Never swallow an error you didn't anticipate.

## State Management

**Core Principles:**

- Use Svelte 4 **stores** for all state (NOT runes outside UI components)
- Most global state flows through Welshman's `repository` (unidirectional)
- Query state using `deriveEventsMapped` or `deriveProfile` etc
- Update state by publishing events via `publishThunk`

**Thunks:**

- Reduce UI latency by handling signatures and sending in background
- Return status that should be displayed to user
- Allow cancellation and error handling
- Immediately publish to local repository for optimistic updates

## Nostr Integration

**Welshman Library Suite:**

- `@welshman/app` - High-level state (pubkey, signer, repository, tracker)
- `@welshman/net` - Network layer (Pool, Socket, load, pull, request)
- `@welshman/store` - Svelte integration (deriveEventsMapped, etc.)
- `@welshman/util` - Event utilities (kinds, tags, validation)
- `@welshman/signer` - Signing abstraction (NIP-01, NIP-07, NIP-46)
- `@welshman/router` - Relay routing (inbox/outbox model)
- `@welshman/editor` - Rich text editor with Nostr
- `@welshman/content` - Content parsing
- `@welshman/feeds` - Feed management

**Key NIPs Implemented:**

- NIP-01: Basic protocol
- NIP-44/59/17: Encrypted DMs
- NIP-07: Browser extension signing
- NIP-19: Bech32 encoding
- NIP-29: Relay-based Groups
- NIP-42: Relay authentication
- NIP-43: Relay membership
- NIP-46: Nostr Connect (remote signing)
- NIP-57: Lightning Zaps

## Development Conventions

**Component Parameterization:**

- Only pass entity identifiers (`url` for spaces, `h` for rooms)
- Derive all other data inside the component from identifiers
- Example: Don't pass `members` prop, derive it from `h` inside component

**CRITICAL Code Style Guidelines:**

- **No `null`** - only use `undefined`
- Svelte 5 runes (`$state`, `$derived`, `$effect`) only in UI components
- TailwindCSS styling with css components customized by theme. See lib/components for examples.
- Comments, naming, conditionals and single-use indirection are covered by the Cleanup Pass above.
- Do not use `any`. If there are type errors related to `unknown`, they are likely because the upstream definition of the data is incorrect.
- When dynamically building classes, use `cx` from `classnames` rather than embedded ternaries or svelte 4's old `class:` syntax.
- When creating forms, use `FieldInline` or `Field` instead of custom elements/tailwindcss
- Do not define svelte event handlers inline, instead name them and put them in the script section of templates
- Write a `{#if}`/`{:else if}` chain rather than hoisting display strings into a lookup `Record` in the script section.
- Avoid using `as`, except where necessary. Instead, annotate function parameters, and ensure upstream values are typed correctly.
- To read a tag, use `getTagValue(tagName, event.tags)` (or `getTagValues` for all matches) rather than reaching into the tag array yourself — that means no `getTag(tagName, event.tags)?.[1] || ""` and no `event.tags.find(nthEq(0, tagName))?.[1]`. `getTagValue` is exactly the latter, so the replacement is behavior-preserving, `undefined` included. Reserve `nthEq` for cases with no `getTag*` equivalent, such as `partition(nthEq(0, "imeta"), tags)`.
- Do not render a profile's `about` directly (e.g. `profile.about`); use the `ProfileAbout` component instead.
- Use `type Props` instead of interface when defining props for svelte components.
- When a component's value/prop shape mirrors a subset of an existing type, derive it with `Pick`/`Partial` and `export` that type from the component's `<script module>` (e.g. a `Values` type) for callers to import, instead of re-enumerating its sub-properties.
- Avoid pass-through functions except when the wrapper is part of an abstraction. `x => y()` is not ok, but `x => this.impl.y()` is ok, for example.
- For durations and timestamps, use `@welshman/lib`'s time helpers and constants (`MINUTE`, `HOUR`, `DAY`, `WEEK`, `MONTH`, `YEAR`) rather than raw milliseconds: `int(5, MINUTE)` for a duration in seconds, `ago(5, MINUTE)` for a past timestamp, `now()` for the current one, and `ms()`/`ms(int(...))` only where a browser API needs milliseconds. So `checkedAt < ago(5, MINUTE)` instead of `checkedAt < Date.now() - 300_000`. Write these count-first (`int(3, MONTH)`, `ago(2, WEEK)`) — the declared parameter order is `(unit, count)`, but the product is the same either way and every call site in this repo reads count-first. Nostr timestamps are seconds, so prefer `now()` over `Date.now()` for anything stored on an event.
- When declaring variables in a svelte component, the order should generally be: props, constants derived from props/state, functions declared with `const`, mutable variables declared with `let`, effects, onMount. This order may vary due to dependencies, but should generally be adhered to.

**Human-First Simplicity:**

- Prefer direct, readable code over layered abstractions.
- Do not add indirection (extra helpers, wrappers, stores, or derived state) unless it removes real repeated complexity.
- Abstractions must be either: elegant and self-explanatory (bottom-up design), or used in at least 3 locations (ugly glue code).
- Reuse existing Welshman and Flotilla primitives before introducing new utilities or dependencies. See /welshman-* skills for details.
- Favor linear control flow and explicit naming over clever patterns.
- Remove defensive checks that do not apply in this runtime model.
- When two approaches work, pick the one that feels more human and easier to maintain.

## Common Tasks

### Adding a New Component

1. Determine if it's generic (`lib/components/`) or app-specific (`app/components/`)
2. Follow naming convention: `PascalCase.svelte`
3. Import in dependency order (3rd party → lib → app)
4. Use stores for state, runes only for UI reactivity

### Creating a New Route

1. Add to `src/routes/` following SvelteKit conventions
2. Use `+page.svelte` for page component
3. Use `+layout.svelte` for shared layouts
4. Top-level sync logic goes in root `+layout.svelte`

### Loading Data from Network

1. Use utilities from `app/core/requests.ts`
2. Or create derived stores in `app/core/state.ts`
3. Use `load`, `pull`, or `request` from `@welshman/net`

### Publishing Events

1. Create `make*` function to build event template
2. Create `publish*` function using `publishThunk`
3. Display thunk status to user (for cancel/error handling)
4. These go in in `app/core/commands.ts`

### Managing Modals/Toasts

- Import from `app/util/modal.ts` or `app/util/toast.ts`
- Pass component objects with parameters
- Use `$state.snapshot` if calling component might unmount

## Development Workflow

Agents should not run the dev server or build the app. Instead, use the following commands:

```bash
pnpm run format           # Format changed files
pnpm run lint             # Check formatting and linting
pnpm run check            # Type check
```

**Welshman Development:**

- Clone welshman to parent directory
- Use `./link_deps` script to link local welshman packages
- Avoid committing `pnpm.overrides` changes

**Git Workflow:**

- `master` branch auto-deploys to production
- Work on feature branches based on `dev` branch
- Pre-commit hooks run lint/typecheck automatically

## Environment Variables

See `.env.template` for all options.

## Mobile Development

**Capacitor Integration:**

- Android: Full support, APK builds via `pnpm run release:android`
- iOS: Full support (zaps disabled due to App Store policy)
- PWA: Progressive Web App with service worker

**Native Features:**

- Push notifications (FCM/APNs)
- Deep linking (nostr: and https: URLs)
- Native signing plugin
- Keyboard management
- Safe area handling
- Badge management
