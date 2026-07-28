import {writable} from "svelte/store"
import {batch, between, call, int, now, on, sortBy, uniqBy, MONTH, YEAR} from "@welshman/lib"
import {EVENT_TIME, getAddress, matchFilters, tagSpec, tagValue} from "@welshman/util"
import type {Filter, TrustedEvent} from "@welshman/util"
import {mergeRepositoryUpdates} from "@welshman/net"
import type {RepositoryUpdate} from "@welshman/net"
import {createScroller} from "@lib/html"
import {daysBetween} from "@lib/util"
import {app, network} from "@app/core"
import {getEventsForUrl} from "@app/repository"

export const makeFeed = ({
  relays,
  filters,
  element,
  onBackwardExhausted,
  onForwardExhausted,
  at = now(),
}: {
  relays: string[]
  filters: Filter[]
  element: HTMLElement
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
  onExhausted,
}: {
  relays: string[]
  filters: Filter[]
  element: HTMLElement
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
