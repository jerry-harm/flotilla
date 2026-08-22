<script lang="ts">
  import {derived} from "svelte/store"
  import {now, DAY, removeUndefined, uniq, sum} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {fromMsats, ZAP_RECEIPT} from "@welshman/util"
  import {ZapGoal} from "@welshman/domain"
  import type {Zap} from "@welshman/domain"
  import {Zappers} from "@welshman/app"
  import Bolt from "@assets/icons/bolt.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import {deriveEvents} from "@app/repository"
  import ZapButton from "@app/components/ZapButton.svelte"
  import {app, reader} from "@app/core"

  type Props = {
    url?: string
    event: TrustedEvent
    class?: string
  }

  const {url, event, ...props}: Props = $props()

  const receipts = deriveEvents([{kinds: [ZAP_RECEIPT], "#e": [event.id]}])

  const zaps = derived<typeof receipts, Zap[]>(
    receipts,
    ($receipts, set) =>
      $app
        .use(Zappers)
        .validZapReceipts($receipts, event, removeUndefined([url]))
        .$.subscribe(set),
    [],
  )

  const goal = reader(ZapGoal)(event)

  const goalAmount = goal.amount() ?? 0
  const closedAt = goal.closedAt()

  // NIP-75: receipts published after closed_at don't count toward the goal.
  const counted = $derived($zaps.filter(zap => !closedAt || zap.response.created_at <= closedAt))
  const zapAmount = $derived(fromMsats(sum(counted.map(zap => zap.invoiceAmount))))
  const contributorsCount = $derived(uniq(counted.map(zap => zap.request.pubkey)).length)
  const daysOld = Math.ceil((now() - event.created_at) / DAY)
</script>

<div class="flex flex-col gap-8 {props.class}">
  <div class="flex gap-8">
    <div>
      <p class="text-xl text-primary">{zapAmount} sats</p>
      <p class="text-sm opacity-75">funded of {goalAmount} sats</p>
    </div>
    <div>
      <p class="text-xl">{contributorsCount}</p>
      <p class="text-sm opacity-75">{contributorsCount === 1 ? "contributor" : "contributors"}</p>
    </div>
    <div>
      <p class="text-xl">{daysOld}</p>
      <p class="text-sm opacity-75">{daysOld === 1 ? "day" : "days"} old</p>
    </div>
  </div>
  <progress class="progress" value={zapAmount} max={goalAmount}></progress>
  <ZapButton {url} {event} class="button button-primary lg:m-auto lg:px-20">
    <Icon icon={Bolt} />
    Contribute to this goal
  </ZapButton>
</div>
