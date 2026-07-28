<script lang="ts">
  import type {TrustedEvent, EventContent} from "@welshman/util"
  import {tagSpec, tagValue} from "@welshman/util"
  import ReactionSummary from "@app/components/ReactionSummary.svelte"
  import {publishReaction, retractReaction} from "@app/reactions"
  import ThunkStatusOrDeleted from "@app/components/ThunkStatusOrDeleted.svelte"
  import EventActivity from "@app/components/EventActivity.svelte"
  import EventActions from "@app/components/EventActions.svelte"
  import {makeSpacePath} from "@app/routes"

  type Props = {
    url: string
    event: TrustedEvent
    segment: string
    showActivity?: boolean
  }

  const {url, event, segment, showActivity = false}: Props = $props()

  const h = tagValue(tagSpec("h"), event.tags)

  const path = makeSpacePath(url, segment, event.id)

  const deleteReaction = (reaction: TrustedEvent) => retractReaction(reaction, {url, h})

  const createReaction = (values: EventContent) => publishReaction(event, values, {url, h})
</script>

<div class="flex flex-wrap items-center justify-between gap-2">
  <div class="flex grow flex-wrap justify-end gap-2">
    <ReactionSummary {url} {event} {deleteReaction} {createReaction} reactionClass="tip-left" />
    <ThunkStatusOrDeleted {event} />
    {#if showActivity}
      <EventActivity {url} {path} {event} />
    {/if}
    <EventActions {url} {event} noun="Comment" />
  </div>
</div>
