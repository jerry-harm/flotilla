import {derived} from "svelte/store"
import {sample} from "@welshman/lib"
import {
  MessagingRelayLists,
  RelayLists,
  Relays,
  SearchRelayLists,
  projectFrom,
  projection,
  publish,
} from "@welshman/app"
import type {IApp, Projection} from "@welshman/app"
import {usePlugin} from "@app/core"
import {DEFAULT_RELAYS, DEFAULT_MESSAGING_RELAYS} from "@app/env"

export type HealthCheckContext = {
  readRelays: string[]
  writeRelays: string[]
  messagingRelays: string[]
  searchRelays: string[]
}

export type HealthCheck = {
  title: string
  description: string
  action: string
  isPending: (context: HealthCheckContext) => boolean
  apply: (context: HealthCheckContext) => unknown
}

export class HealthChecks {
  context: Projection<HealthCheckContext>
  pending: Projection<HealthCheck[]>

  constructor(private readonly app: IApp) {
    const pubkey = app.user?.pubkey ?? ""

    this.context = projection(
      derived(
        [
          app.use(RelayLists).index.$,
          app.use(SearchRelayLists).index.$,
          app.use(MessagingRelayLists).index.$,
        ],
        ([$relayLists, $searchRelayLists, $messagingRelayLists]) => {
          const relayList = $relayLists.get(pubkey)

          return {
            readRelays: relayList?.readUrls() ?? [],
            writeRelays: relayList?.writeUrls() ?? [],
            searchRelays: $searchRelayLists.get(pubkey)?.urls() ?? [],
            messagingRelays: $messagingRelayLists.get(pubkey)?.urls() ?? [],
          }
        },
      ),
    )

    this.pending = projectFrom(this.context, $context =>
      this.checks.filter(check => check.isPending($context)),
    )
  }

  private supportsSearch = (url: string) => this.app.use(Relays).get(url)?.hasNip(50)

  private checks: HealthCheck[] = [
    {
      title: "Missing Inbox Relays",
      description: "Other people aren't currently able to reliably tag you in public notes.",
      action: "Update",
      isPending: context => context.readRelays.length <= 1,
      apply: () => this.app.use(RelayLists).setReadUrls(DEFAULT_RELAYS).then(publish),
    },
    {
      title: "Missing Outbox Relays",
      description: "Other people aren't currently able to reliably find your public notes.",
      action: "Update",
      isPending: context => context.writeRelays.length <= 1,
      apply: () => this.app.use(RelayLists).setWriteUrls(DEFAULT_RELAYS).then(publish),
    },
    {
      title: "Missing DM Relays",
      description: "You aren't currently able to reliably send or receive direct messages.",
      action: "Update",
      isPending: context => context.messagingRelays.length <= 1,
      apply: () =>
        this.app.use(MessagingRelayLists).setUrls(DEFAULT_MESSAGING_RELAYS).then(publish),
    },
    {
      title: "Too Many Inbox Relays",
      description:
        "You have more inbox relays than is really necessary, which can affect resource usage.",
      action: "Prune Selections",
      isPending: context => context.readRelays.length > 8,
      apply: context =>
        this.app.use(RelayLists).setReadUrls(sample(5, context.readRelays)).then(publish),
    },
    {
      title: "Too Many Outbox Relays",
      description:
        "You have more outbox relays than is really necessary, which can affect resource usage.",
      action: "Prune Selections",
      isPending: context => context.writeRelays.length > 8,
      apply: context =>
        this.app.use(RelayLists).setWriteUrls(sample(5, context.writeRelays)).then(publish),
    },
    {
      title: "Too Many DM Relays",
      description:
        "You have more DM relays than is really necessary, which can affect resource usage.",
      action: "Prune Selections",
      isPending: context => context.messagingRelays.length > 8,
      apply: context =>
        this.app.use(MessagingRelayLists).setUrls(sample(5, context.messagingRelays)).then(publish),
    },
    {
      title: "Invalid Search Relays",
      description: "Some of your search relays don't support search.",
      action: "Remove Invalid",
      isPending: context => context.searchRelays.some(url => !this.supportsSearch(url)),
      apply: context =>
        this.app
          .use(SearchRelayLists)
          .setUrls(context.searchRelays.filter(this.supportsSearch))
          .then(publish),
    },
  ]

  isPending = (healthCheck: HealthCheck) => healthCheck.isPending(this.context.get())

  apply = (healthCheck: HealthCheck) => healthCheck.apply(this.context.get())
}

export const healthChecks = usePlugin(HealthChecks)
