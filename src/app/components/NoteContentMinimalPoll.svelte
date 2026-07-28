<script lang="ts">
  import type {ComponentProps} from "svelte"
  import {POLL_RESPONSE} from "@welshman/util"
  import {Poll} from "@welshman/domain"
  import ContentMinimal from "@app/components/ContentMinimal.svelte"
  import {reader} from "@app/core"
  import {deriveEvents} from "@app/repository"

  const props: ComponentProps<typeof ContentMinimal> = $props()

  const responses = deriveEvents([{kinds: [POLL_RESPONSE], "#e": [props.event.id]}])

  const voters = $derived(reader(Poll)(props.event).results($responses).voters)
</script>

<div class="flex flex-col gap-0">
  <ContentMinimal {...props} />
  <span class="text-xs opacity-50">{voters} voter{voters === 1 ? "" : "s"}</span>
</div>
