<script lang="ts">
  import {formatTimestamp, formatTimestampAsDate, formatTimestampAsTime} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {tagSpec, tagValue} from "@welshman/util"
  import {TimeEvent} from "@welshman/domain"
  import ClockCircle from "@assets/icons/clock-circle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import {reader} from "@app/core"

  type Props = {
    event: TrustedEvent
  }

  const {event}: Props = $props()

  const timeEvent = reader(TimeEvent)(event)

  // NIP-52 settled on `title`, but events from before that still carry `name`.
  const title = $derived(timeEvent.title() ?? tagValue(tagSpec("name"), event.tags))
  const start = timeEvent.start()
  const end = timeEvent.end()
</script>

<div class="flex flex-col justify-between gap-1">
  <p class="text-lg">{title}</p>
  {#if start && end}
    {@const isSingleDay = formatTimestampAsDate(start) === formatTimestampAsDate(end)}
    <div class="flex flex-wrap gap-2 text-xs">
      <div class="flex items-center gap-2">
        <Icon icon={ClockCircle} size={4} />
        {formatTimestampAsDate(start)}
      </div>
      {formatTimestampAsTime(start)} — {isSingleDay
        ? formatTimestampAsTime(end)
        : formatTimestamp(end)}
    </div>
  {/if}
</div>
