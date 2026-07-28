<script lang="ts">
  import type {TrustedEvent, EventContent} from "@welshman/util"
  import {ZapGoal} from "@welshman/domain"
  import Link from "@lib/components/Link.svelte"
  import {reader} from "@app/core"
  import ReactionSummary from "@app/components/ReactionSummary.svelte"
  import {publishReaction, retractReaction} from "@app/reactions"
  import ThunkStatusOrDeleted from "@app/components/ThunkStatusOrDeleted.svelte"
  import EventActivity from "@app/components/EventActivity.svelte"
  import EventActions from "@app/components/EventActions.svelte"
  import RoomName from "@app/components/RoomName.svelte"
  import {makeGoalPath, makeSpacePath} from "@app/routes"

  interface Props {
    url: string
    event: TrustedEvent
    showRoom?: boolean
    showActivity?: boolean
  }

  const {url, event, showRoom, showActivity}: Props = $props()

  const path = makeGoalPath(url, event.id)
  const goal = reader(ZapGoal)(event)

  const h = goal.room()

  const deleteReaction = (reaction: TrustedEvent) => retractReaction(reaction, {url})

  const createReaction = (values: EventContent) => publishReaction(event, values, {url})
</script>

<div class="flex grow flex-wrap justify-end gap-2">
  {#if h && showRoom}
    <Link href={makeSpacePath(url, h)} class="button button-neutral button-xs rounded-full">
      Posted in #<RoomName {h} {url} />
    </Link>
  {/if}
  <ReactionSummary {url} {event} {deleteReaction} {createReaction} reactionClass="tip-left" />
  <ThunkStatusOrDeleted {event} />
  {#if showActivity}
    <EventActivity {url} {path} {event} />
  {/if}
  <EventActions {url} {event} hideZap noun="Goal" />
</div>
