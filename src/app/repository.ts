import {derived} from "svelte/store"
import {filter, spec} from "@welshman/lib"
import type {Filter, TrustedEvent} from "@welshman/util"
import * as store from "@welshman/store"
import {Network, Relays} from "@welshman/app"
import {app, fromApp} from "@app/core"

// Events

export const deriveEvent = (idOrAddress: string, relays: string[] = []) =>
  fromApp($app =>
    store.makeDeriveEvent({
      repository: $app.repository,
      includeDeleted: true,
      onDerive: (filters: Filter[], hints: string[]) =>
        $app.use(Network).load({filters, relays: hints}),
    })(idOrAddress, relays),
  )

export const deriveEventsById = (filters: Filter[] = [{}]) =>
  fromApp($app => store.deriveEventsById({repository: $app.repository, filters}))

export const deriveEvents = (filters: Filter[] = [{}]) =>
  store.deriveEventsDesc(deriveEventsById(filters))

export const deriveIsDeleted = (event: TrustedEvent) =>
  fromApp($app => store.deriveIsDeleted($app.repository, event))

// Events on a relay

export const getEventsForUrl = (url: string, filters: Filter[] = [{}]) =>
  store
    .getEventsByIdForUrl({
      url,
      filters,
      tracker: app.get().tracker,
      repository: app.get().repository,
    })
    .values()

export const deriveEventsByIdForUrl = (url: string, filters: Filter[] = [{}]) =>
  fromApp($app =>
    store.deriveEventsByIdForUrl({
      url,
      filters,
      tracker: $app.tracker,
      repository: $app.repository,
    }),
  )

export const deriveEventsForUrl = (url: string, filters: Filter[] = [{}]) =>
  store.deriveArray(deriveEventsByIdForUrl(url, filters))

export const deriveEventsByIdByUrl = (filters: Filter[] = [{}]) =>
  fromApp($app =>
    store.deriveEventsByIdByUrl({filters, tracker: $app.tracker, repository: $app.repository}),
  )

export const deriveRelaySignedEvents = (url: string, filters: Filter[] = [{}]) =>
  derived(
    [fromApp($app => $app.use(Relays).one(url)), deriveEventsForUrl(url, filters)],
    ([$relay, $events]) => filter(spec({pubkey: $relay?.self}), $events as TrustedEvent[]),
  )
