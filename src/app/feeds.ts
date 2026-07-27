import {repository, tracker} from "@welshman/app"
import {writable} from "svelte/store"
import {
  batch,
  between,
  call,
  insertAt,
  int,
  now,
  on,
  sortBy,
  uniqBy,
  MONTH,
  YEAR,
} from "@welshman/lib"
import {EVENT_TIME, getAddress, getTagValue, matchFilters} from "@welshman/util"
import type {Filter, TrustedEvent} from "@welshman/util"
import {mergeRepositoryUpdates, request} from "@welshman/net"
import type {RepositoryUpdate} from "@welshman/net"
import {createScroller} from "@lib/html"
import {daysBetween} from "@lib/util"
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
      events.update($events => {
        for (const event of visible) {
          let inserted = false
          for (let i = 0; i < $events.length; i++) {
            if ($events[i].created_at > event.created_at) {
              $events = insertAt(i, event, $events)
              inserted = true
              break
            }
          }
          if (!inserted) {
            $events = [...$events, event]
          }
        }

        return $events
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

  const unsubscribers = [
    on(
      repository,
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
            relays.some(url => tracker.getRelays(event.id).has(url)),
        )

        if (matching.length > 0) {
          insertEvents(matching)
        }
      }),
    ),
    on(tracker, "add", (id: string, url: string) => {
      if (relays.includes(url)) {
        const event = repository.getEvent(id)

        if (event && matchFilters(filters, event)) {
          insertEvents([event])
        }
      }
    }),
  ]

  const loadTimeframe = async (since: number, until: number) => {
    const events = await request({
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

  const getStart = (event: TrustedEvent) => parseInt(getTagValue("start", event.tags) || "")

  const getEnd = (event: TrustedEvent) => parseInt(getTagValue("end", event.tags) || "")

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

    events.update($events => {
      for (const event of valid) {
        seen.add(event.id)

        const start = getStart(event)
        const address = getAddress(event)

        let handled = false
        for (let i = 0; i < $events.length; i++) {
          if ($events[i].id === event.id) {
            handled = true
            break
          }
          if (getStart($events[i]) > start) {
            $events = insertAt(i, event, $events)
            handled = true
            break
          }
        }

        if (!handled) {
          $events = [...$events.filter(e => getAddress(e) !== address), event]
        }
      }

      return $events
    })
  }

  const unsubscribers = [
    on(
      repository,
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
    on(tracker, "add", (id: string, url: string) => {
      if (relays.includes(url)) {
        const event = repository.getEvent(id)

        if (event && matchFilters(filters, event)) {
          insertEvents([event])
        }
      }
    }),
  ]

  const loadTimeframe = (since: number, until: number) => {
    const hashes = daysBetween(since, until).map(String)

    request({
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
