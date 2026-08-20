# Suspected app bugs

Places where the app source contradicts a story in `USER_STORIES.md`. The spec for each asserts
the story, so it fails until the bug is fixed.

## Rooms & membership

- **US-019 / US-020 — joined and created rooms never land under "Your Rooms".** `Rooms.joinRoom`
  publishes only kind-9021 and `RoomForm.submit` publishes create/edit/join — none of them write
  the user's kind-10009 room list, which is what `deriveUserRooms` reads. Only the Favorite toggle
  and the delete path touch the list.
- **US-019 — leaving a room's member list is silent on success.** `RoomDetailMenu.handleLoading`
  only toasts when `waitForError()` returns a message.
- **US-021 — private-room card says "Join Room" where the story (and the restricted-room card)
  say "Ask to Join"** (`RoomChat.svelte` isPrivate vs isRestricted branches).
- **US-028 — no Share action exists on any message.** `shareEvent` is wired only into EventMenu
  ("Share to Chat"), BoardMenu and PinMenu; the cross-space Share picker is reachable only from
  native share intents or `/share`.

## Spaces & access

- **US-011 — the "Request Access" state is unreachable on a `public_join = false` relay.**
  welshman's `RelayJoinWriter.setClaim("")` always writes a `claim` tag, so zooid answers
  "failed to validate invite code" instead of "no claim tag"; `attemptRelayAccess` swallows that
  error when no claim was supplied, so `SpaceJoin` shows "Join Space" and toasts "Welcome to the
  space!" for a space that refused the join.
- **US-009 — "Browse Spaces" section renders as "More Spaces"** whenever the user has joined
  spaces, so the story's two named sections never appear together.

## DMs & composer

- **US-035 — up-arrow in an empty DM composer edits the oldest editable message, not the newest.**
  `Chat.svelte` does `messages.toReversed().find(canEditEvent)` but `chat.messages` is already
  newest-first; RoomChat uses the same expression over an ascending list, so the DM copy inverted
  the ordering.
- **US-059 — a cancelled edit clobbers the room draft.** RoomChat re-keys RoomCompose on
  `initialValues` while passing the same `draftKey` during editing, so the draft store is
  overwritten with the edited message's text. Chat.svelte avoids this by passing
  `draftKey={eventToEdit ? undefined : draftKey}`.
- **US-056 — mentions render with no avatar** (composer nodeview is a bare text span;
  `ContentMention` renders `@name` with no image).
- **US-056 — `~room` references render as plain text once sent.** `parseRoom` pre-empts
  `parseLink` and `Content.svelte` has no `isRoom` branch, so the intended `#RoomName` link path
  in `ContentLinkUrl` is unreachable.
- **US-057 — an unsupported file type is rejected silently.** `Uploader.addFile` returns false
  before any upload on a mime mismatch, so `onUploadError` (the only toast in the path) never runs.

## Delivery & deletion

- **US-072 — the "Deleted" pill never replaces reactions/menus.** In Article/Comment/Thread/Poll/
  Goal/CalendarEvent Actions, `ThunkStatusOrDeleted` is a sibling of `ReactionSummary`/
  `EventActions` instead of wrapping them; `ClassifiedActions` is the only one wired as intended.
- **US-072 — a deleted event vanishes from lists and threads instead of staying with the pill.**
  `Repository` emits the target in `removed` and `makeFeed`/`deriveEventsById` prune on it; only
  `deriveEvent` (`includeDeleted: true`) retains it, so the pill is only reachable on detail pages.
- **US-071 — the publish-status popover's timeout reason reads "timed out." not "request timed
  out".** `publishOne` always sets `detail: "timed out"`, making `ThunkStatusDetail`'s fallback
  branch unreachable.

## People & profiles

- **US-079 — profile notes show an absolute date+clock** (`NoteCard` uses `formatTimestamp`)
  where the story asks for a relative timestamp (`formatTimestampRelative` exists and is used for
  "Last active").
- **US-079 — a note published live never appears in another user's open profile view without a
  reload.** `syncSpace`'s CONTENT_KINDS contains no NOTE kind and `makeFeed`'s forward scroller
  stops on its first tick.
- **US-008 — deleting your profile can delete the blanked kind-0 it just published.** The kind-5
  requests carry an `a` tag (`0:<pubkey>`) newer than the blanked profile; zooid has no NIP-62
  handling, and in a fresh session no kind-5 may be sent at all.

## Settings

- **US-091 — the zero/negative zap-amount error toast is unreachable.** The inputs carry
  `min="1"`, so native constraint validation blocks submit before `onZapAmountsSubmit` runs.
- **US-084 — blocked relays still appear in relay suggestions.** `RelayAdd` filters on
  matchRelay/already-selected/isIPAddress only; `BlockedRelayLists` is consumed solely by
  `policies.ts` to refuse sockets.

## Content rendering

- **US-067 — a bare `lnbc1…` invoice renders as plain prose.** `parseInvoice` only matches behind
  a `lightning:` scheme and `parseLink` skips it too, so the copyable chip appears only for the
  prefixed form.
- **US-046 — the calendar "Today" divider keys off `created_at` instead of the event's start tag**
  (`isFuture = todayDateDisplay === newDateDisplay || event.created_at > now()`), so it lands on
  the wrong item for past-published events. (Not covered by the suite; the scroll effect uses the
  correct `getStart`.)

## Hosting & admin

- **US-102 — payment history is not sorted client-side.** The hosting settings page renders
  `listTenantInvoices` order verbatim, so "most recent first" depends on the backend.
- **US-041 — the article list card lacks the "Posted in #room" badge** the story names for both
  surfaces; `ArticleItem` never passes `showRoom` and renders the room inline in the byline
  instead.
- **US-092 — `deriveUserIsSpaceAdmin` gates on `supportedMethods().length > 0`.** zooid's migration writes `member_methods = ["listclaims", "createclaim"]` — if applied, every member reports as an admin.

## Known coverage gaps (not bugs)

- **US-070 bullet 3** (article/comment retry succeeds and clears the indicator) cannot be
  exercised: no UI path makes an article publish fail then succeed in one session without
  discarding `$thunks.history`.
- **US-065's "briefly shows a loading state"** depends on timing. Sync may already hold the
  quoted event when the assertion runs.
