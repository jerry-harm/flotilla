<script lang="ts">
  import type {TrustedEvent} from "@welshman/util"
  import {getTagValue} from "@welshman/util"
  import {ucFirst} from "@lib/util"
  import Badge from "@lib/components/Badge.svelte"

  type Props = {
    event: TrustedEvent
  }

  const {event}: Props = $props()

  const status = getTagValue("status", event.tags)
</script>

{#if status}
  <Badge variant={status !== "active" ? "primary" : "neutral"} class="rounded-full">
    {ucFirst(status)}
  </Badge>
{/if}
