<script lang="ts">
  import type {ComponentProps} from "svelte"
  import {derived} from "svelte/store"
  import {removeUndefined, sum} from "@welshman/lib"
  import {ZAP_RECEIPT, fromMsats} from "@welshman/util"
  import {ZapGoal} from "@welshman/domain"
  import type {Zap} from "@welshman/domain"
  import {Zappers} from "@welshman/app"
  import Bolt from "@assets/icons/bolt.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import ContentMinimal from "@app/components/ContentMinimal.svelte"
  import {app, reader} from "@app/core"
  import {deriveEvents} from "@app/repository"

  const props: ComponentProps<typeof ContentMinimal> = $props()

  const goal = reader(ZapGoal)(props.event)

  const title = goal.title()
  const summaryEvent = $derived({content: goal.summary(), tags: props.event.tags})

  const receipts = deriveEvents([{kinds: [ZAP_RECEIPT], "#e": [props.event.id]}])

  const zaps = derived<typeof receipts, Zap[]>(
    receipts,
    ($receipts, set) =>
      $app
        .use(Zappers)
        .validZapReceipts($receipts, props.event, removeUndefined([props.url]))
        .$.subscribe(set),
    [],
  )

  const goalAmount = goal.amount() ?? 0
  const closedAt = goal.closedAt()
  const counted = $derived($zaps.filter(zap => !closedAt || zap.response.created_at <= closedAt))
  const zapAmount = $derived(fromMsats(sum(counted.map(zap => zap.invoiceAmount))))
</script>

<div class="flex justify-between">
  <span class="text-sm">{title}</span>
  <div class="flex items-center gap-1">
    <Icon icon={Bolt} size={4} />
    {zapAmount}/{goalAmount} sats funded
  </div>
</div>
<ContentMinimal {...props} event={summaryEvent} />
