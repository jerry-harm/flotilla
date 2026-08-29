import {derived, readable, writable} from "svelte/store"
import type {Readable} from "svelte/store"
import {batch, between, call, int, now, on, sortBy, uniqBy, MONTH, YEAR} from "@welshman/lib"
import {
  COMMENT,
  DELETE,
  EVENT_TIME,
  addressTags,
  getAddress,
  getCommentFiltersForRoot,
  getReplyFilters,
  hexTags,
  isReplaceableKind,
  matchFilters,
  tagSpec,
  tagValue,
  tagValues,
} from "@welshman/util"
import type {Filter, TrustedEvent} from "@welshman/util"
import {mergeRepositoryUpdates} from "@welshman/net"
import type {RepositoryUpdate} from "@welshman/net"
import {createScroller} from "@lib/html"
import {daysBetween} from "@lib/util"
import {EVENT_CONTEXT_KINDS, REACTION_KINDS} from "@app/content"
import {app, network} from "@app/core"
import {getEventsForUrl} from "@app/repository"

const noEvents: TrustedEvent[] = []

// Reactions, zaps and reports point at their subject with `e`/`a`. A NIP-22 comment instead
// points at its thread *root* with `E`/`A`, so filing it by those tags puts a whole thread in
// the root's bucket — which is the scope a reply count wants.
const getTargets = ({kind, tags}: TrustedEvent) =>
  kind === COMMENT
    ? [...tagValues(hexTags("E"), tags), ...tagValues(addressTags("A"), tags)]
    : [...tagValues(hexTags("e"), tags), ...tagValues(addressTags("a"), tags)]

// A related event may point at a replaceable one by either id or address, so both are keys
const getKeys = (event: TrustedEvent) =>
  isReplaceableKind(event.kind) ? [event.id, getAddress(event)] : [event.id]

export const makeFeedContext = ({relays}: {relays: string[] | Promise<string[]>}) => {
  const {repository} = app.get()
  const controller = new AbortController()
  const targets = new Set<string>()
  const eventsByTarget = new Map<string, TrustedEvent[]>()
  const targetsByEventId = new Map<string, string[]>()
  const subscribersByTarget = new Map<string, Set<(events: TrustedEvent[]) => void>>()

  const addEvent = (event: TrustedEvent, touched: Set<string>) => {
    // An event seen before its target was tracked stays unfiled, so that adding the target
    // later can pick it up out of the repository
    if (!targetsByEventId.has(event.id)) {
      const eventTargets = getTargets(event).filter(target => targets.has(target))

      if (eventTargets.length > 0) {
        targetsByEventId.set(event.id, eventTargets)

        for (const target of eventTargets) {
          eventsByTarget.set(target, [...(eventsByTarget.get(target) || []), event])
          touched.add(target)
        }
      }
    }
  }

  const removeEvent = (id: string, touched: Set<string>) => {
    const eventTargets = targetsByEventId.get(id)

    if (eventTargets) {
      targetsByEventId.delete(id)

      for (const target of eventTargets) {
        const events = eventsByTarget.get(target)!.filter(event => event.id !== id)

        if (events.length > 0) {
          eventsByTarget.set(target, events)
        } else {
          eventsByTarget.delete(target)
        }

        touched.add(target)
      }
    }
  }

  const notify = (touched: Set<string>) => {
    for (const target of touched) {
      for (const subscriber of subscribersByTarget.get(target) || []) {
        subscriber(eventsByTarget.get(target) || noEvents)
      }
    }
  }

  const loadContext = batch(100, async (events: TrustedEvent[]) => {
    const touched = new Set<string>()

    // What's already local — an earlier page, our own optimistic reactions — never comes
    // through the update listener, so file it before asking the network for the rest
    for (const event of repository.query([
      ...getReplyFilters(events, {kinds: EVENT_CONTEXT_KINDS}),
      ...getCommentFiltersForRoot(events),
    ])) {
      addEvent(event, touched)
    }

    notify(touched)

    const urls = await relays

    const context = await network.get().load({
      relays: urls,
      signal: controller.signal,
      filters: [
        ...getReplyFilters(events, {kinds: REACTION_KINDS}),
        ...getCommentFiltersForRoot(events),
      ],
    })

    if (context.length > 0) {
      network.get().load({
        relays: urls,
        signal: controller.signal,
        filters: getReplyFilters(context, {kinds: [DELETE]}),
      })
    }
  })

  const unsubscribe = on(
    repository,
    "update",
    batch(150, (updates: RepositoryUpdate[]) => {
      const {added, removed} = mergeRepositoryUpdates(updates)
      const touched = new Set<string>()

      for (const event of added) {
        if (EVENT_CONTEXT_KINDS.includes(event.kind)) {
          addEvent(event, touched)
        }
      }

      for (const id of removed) {
        removeEvent(id, touched)
      }

      notify(touched)
    }),
  )

  // Track an event so its context gets requested with the rest of the batch
  const add = (event: TrustedEvent) => {
    if (!targets.has(event.id)) {
      for (const key of getKeys(event)) {
        targets.add(key)
      }

      loadContext(event)
    }
  }

  const relatedForKey = (key: string) =>
    readable(eventsByTarget.get(key) || noEvents, set => {
      let subscribers = subscribersByTarget.get(key)

      if (!subscribers) {
        subscribers = new Set()
        subscribersByTarget.set(key, subscribers)
      }

      subscribers.add(set)
      set(eventsByTarget.get(key) || noEvents)

      return () => {
        subscribers.delete(set)

        if (subscribers.size === 0) {
          subscribersByTarget.delete(key)
        }
      }
    })

  return {
    add,
    related: (event: TrustedEvent): Readable<TrustedEvent[]> => {
      add(event)

      const [key, ...rest] = getKeys(event)

      // A replaceable event collects both its buckets, and something tagging it by id and
      // address at once lands in both
      return rest.length > 0
        ? derived([relatedForKey(key), ...rest.map(relatedForKey)], buckets =>
            uniqBy(event => event.id, buckets.flat()),
          )
        : relatedForKey(key)
    },
    cleanup: () => {
      controller.abort()
      unsubscribe()
    },
  }
}

export type FeedContext = ReturnType<typeof makeFeedContext>

export const makeFeed = ({
  relays,
  filters,
  element,
  onEvent,
  onBackwardExhausted,
  onForwardExhausted,
  at = now(),
}: {
  relays: string[]
  filters: Filter[]
  element: HTMLElement
  onEvent?: (event: TrustedEvent) => void
  onBackwardExhausted?: () => void
  onForwardExhausted?: () => void
  at?: number
}) => {
  const controller = new AbortController()
  const events = writable<TrustedEvent[]>([])
  const seen = new Set<string>()

  let interval = int(6, MONTH)
  let buffer: TrustedEvent[] = []
  let backwardWindow = [at - interval, at]
  let forwardWindow = [at, at + interval]

  const insertIntoBuffer = (event: TrustedEvent) => {
    for (let i = 0; i < buffer.length; i++) {
      if (buffer[i].created_at < event.created_at) {
        buffer.splice(i, 0, event)
        return
      }
    }
    buffer.push(event)
  }

  // Batch-insert events into the visible store with a single update
  const insertEvents = (newEvents: Iterable<TrustedEvent>) => {
    const visible: TrustedEvent[] = []

    for (const event of newEvents) {
      if (seen.has(event.id)) {
        continue
      }

      seen.add(event.id)

      if (between([backwardWindow[0], forwardWindow[1]], event.created_at)) {
        visible.push(event)
      } else {
        insertIntoBuffer(event)
      }
    }

    if (visible.length > 0) {
      visible.sort((a, b) => a.created_at - b.created_at)

      for (const event of visible) {
        onEvent?.(event)
      }

      events.update($events => {
        const merged: TrustedEvent[] = []
        let i = 0
        let j = 0

        while (i < $events.length && j < visible.length) {
          if ($events[i].created_at <= visible[j].created_at) {
            merged.push($events[i++])
          } else {
            merged.push(visible[j++])
          }
        }

        while (i < $events.length) merged.push($events[i++])
        while (j < visible.length) merged.push(visible[j++])

        return merged
      })
    }
  }

  // Buffered events are routed through insertEvents again, so forget we've seen
  // them to let the window check run a second time
  const drainBuffer = () => {
    const drained = buffer.splice(0, 30)

    for (const event of drained) {
      seen.delete(event.id)
    }

    insertEvents(drained)
  }

  const onTrackedId = batch(150, (ids: string[]) => {
    const matching: TrustedEvent[] = []

    for (const id of new Set(ids)) {
      const event = app.get().repository.getEvent(id)

      if (event && matchFilters(filters, event)) {
        matching.push(event)
      }
    }

    if (matching.length > 0) {
      insertEvents(matching)
    }
  })

  const unsubscribers = [
    on(
      app.get().repository,
      "update",
      batch(150, (updates: RepositoryUpdate[]) => {
        const {added, removed} = mergeRepositoryUpdates(updates)

        if (removed.size > 0) {
          buffer = buffer.filter(e => !removed.has(e.id))
          events.update($events => $events.filter(e => !removed.has(e.id)))

          for (const id of removed) {
            seen.delete(id)
          }
        }

        const matching = added.filter(
          event =>
            matchFilters(filters, event) &&
            relays.some(url => app.get().tracker.getRelays(event.id).has(url)),
        )

        if (matching.length > 0) {
          insertEvents(matching)
        }
      }),
    ),
    on(app.get().tracker, "add", (id: string, url: string) => {
      if (relays.includes(url)) {
        onTrackedId(id)
      }
    }),
  ]

  const loadTimeframe = async (since: number, until: number) => {
    const events = await network.get().request({
      relays,
      autoClose: true,
      signal: controller.signal,
      filters: filters.map(filter => ({...filter, since, until})),
    })

    // If we found nothing, accelerate
    if (events.length === 0) {
      interval = Math.round(interval * 1.1)
    } else {
      interval = int(MONTH)
    }
  }

  const backwardScroller = createScroller({
    element,
    delay: 300,
    threshold: 5000,
    onScroll: async () => {
      const [since, until] = backwardWindow

      backwardWindow = [since - interval, since]

      drainBuffer()

      if (until > now() - int(2, YEAR)) {
        await loadTimeframe(since, until)
      } else if (!buffer.some(e => e.created_at < at)) {
        backwardScroller.stop()
        onBackwardExhausted?.()
      }
    },
  })

  const forwardScroller = createScroller({
    element,
    reverse: true,
    delay: 300,
    threshold: 5000,
    onScroll: async () => {
      const [since, until] = forwardWindow

      forwardWindow = [until, until + interval]

      drainBuffer()

      if (until < now()) {
        await loadTimeframe(since, until)
      } else if (!buffer.some(e => e.created_at > at)) {
        forwardScroller.stop()
        onForwardExhausted?.()
      }
    },
  })

  for (const url of relays) {
    insertEvents(getEventsForUrl(url, filters))
  }

  return {
    events,
    cleanup: () => {
      controller.abort()
      forwardScroller.stop()
      backwardScroller.stop()
      unsubscribers.forEach(call)
    },
  }
}

export const makeCalendarFeed = ({
  relays,
  filters,
  element,
  onEvent,
  onExhausted,
}: {
  relays: string[]
  filters: Filter[]
  element: HTMLElement
  onEvent?: (event: TrustedEvent) => void
  onExhausted?: () => void
}) => {
  const interval = int(5, MONTH)
  const controller = new AbortController()
  const seen = new Set<string>()

  let exhaustedScrollers = 0
  let backwardWindow = [now() - interval, now()]
  let forwardWindow = [now(), now() + interval]

  const getStart = (event: TrustedEvent) => parseInt(tagValue(tagSpec("start"), event.tags) || "")

  const getEnd = (event: TrustedEvent) => parseInt(tagValue(tagSpec("end"), event.tags) || "")

  const events = writable(
    sortBy(
      getStart,
      uniqBy(
        e => e.id,
        relays.flatMap(url => Array.from(getEventsForUrl(url, filters))),
      ),
    ),
  )

  // Batch-insert calendar events into the store with a single update
  const insertEvents = (newEvents: TrustedEvent[]) => {
    const valid = newEvents.filter(e => !isNaN(getStart(e)) && !isNaN(getEnd(e)) && !seen.has(e.id))

    if (valid.length === 0) return

    for (const event of valid) {
      seen.add(event.id)
      onEvent?.(event)
    }

    valid.sort((a, b) => getStart(a) - getStart(b))

    events.update($events => {
      // Calendar events are addressable, so a new version supersedes the old one
      const superseded = new Set(valid.map(getAddress))
      const kept = $events.filter(e => !superseded.has(getAddress(e)))
      const merged: TrustedEvent[] = []
      let i = 0
      let j = 0

      while (i < kept.length && j < valid.length) {
        if (getStart(kept[i]) <= getStart(valid[j])) {
          merged.push(kept[i++])
        } else {
          merged.push(valid[j++])
        }
      }

      while (i < kept.length) merged.push(kept[i++])
      while (j < valid.length) merged.push(valid[j++])

      return merged
    })
  }

  const onTrackedId = batch(150, (ids: string[]) => {
    const matching: TrustedEvent[] = []

    for (const id of new Set(ids)) {
      const event = app.get().repository.getEvent(id)

      if (event && matchFilters(filters, event)) {
        matching.push(event)
      }
    }

    if (matching.length > 0) {
      insertEvents(matching)
    }
  })

  const unsubscribers = [
    on(
      app.get().repository,
      "update",
      batch(150, (updates: RepositoryUpdate[]) => {
        const {added, removed} = mergeRepositoryUpdates(updates)

        if (removed.size > 0) {
          events.update($events => $events.filter(e => !removed.has(e.id)))

          for (const id of removed) {
            seen.delete(id)
          }
        }

        const matching = added.filter(event => matchFilters(filters, event))

        if (matching.length > 0) {
          insertEvents(matching)
        }
      }),
    ),
    on(app.get().tracker, "add", (id: string, url: string) => {
      if (relays.includes(url)) {
        onTrackedId(id)
      }
    }),
  ]

  const loadTimeframe = (since: number, until: number) => {
    const hashes = daysBetween(since, until).map(String)

    network.get().request({
      relays,
      autoClose: true,
      signal: controller.signal,
      filters: [{kinds: [EVENT_TIME], "#D": hashes}],
    })
  }

  const maybeExhausted = () => {
    if (++exhaustedScrollers === 2) {
      onExhausted?.()
    }
  }

  const backwardScroller = createScroller({
    element,
    reverse: true,
    onScroll: () => {
      const [since, until] = backwardWindow

      backwardWindow = [since - interval, since]

      if (until > now() - int(2, YEAR)) {
        loadTimeframe(since, until)
      } else {
        backwardScroller.stop()
        maybeExhausted()
      }
    },
  })

  const forwardScroller = createScroller({
    element,
    onScroll: () => {
      const [since, until] = forwardWindow

      forwardWindow = [until, until + interval]

      if (until < now() + int(2, YEAR)) {
        loadTimeframe(since, until)
      } else {
        forwardScroller.stop()
        maybeExhausted()
      }
    },
  })

  return {
    events,
    cleanup: () => {
      controller.abort()
      forwardScroller.stop()
      backwardScroller.stop()
      unsubscribers.forEach(call)
    },
  }
}
