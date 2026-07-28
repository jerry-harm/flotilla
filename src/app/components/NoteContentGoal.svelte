<script lang="ts">
  import type {ComponentProps} from "svelte"
  import {ZapGoal} from "@welshman/domain"
  import {reader} from "@app/core"
  import Content from "@app/components/Content.svelte"
  import GoalSummary from "@app/components/GoalSummary.svelte"

  const props: ComponentProps<typeof Content> = $props()

  const goal = reader(ZapGoal)(props.event)

  const title = goal.title()
  const summaryEvent = $derived({content: goal.summary(), tags: props.event.tags})
</script>

<div class="flex flex-col gap-2">
  <p class="text-2xl">{title}</p>
  <Content {...props} event={summaryEvent} expandMode="inline" minLength={50} maxLength={300} />
  <GoalSummary url={props.url} event={props.event} />
</div>
