<script lang="ts">
  import {uniq} from "@welshman/lib"
  import type {TrustedEvent, EventContent} from "@welshman/util"
  import {getAddress} from "@welshman/util"
  import {Classified} from "@welshman/domain"
  import Pen2 from "@assets/icons/pen-2.svg?dataurl"
  import {normalizeTopic} from "@lib/util"
  import Link from "@lib/components/Link.svelte"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import RoomName from "@app/components/RoomName.svelte"
  import {publishReaction, retractReaction} from "@app/reactions"
  import ReactionSummary from "@app/components/ReactionSummary.svelte"
  import ClassifiedStatus from "@app/components/ClassifiedStatus.svelte"
  import ThunkStatusOrDeleted from "@app/components/ThunkStatusOrDeleted.svelte"
  import EventActivity from "@app/components/EventActivity.svelte"
  import EventActions from "@app/components/EventActions.svelte"
  import ClassifiedEdit from "@app/components/ClassifiedEdit.svelte"
  import {reader, user} from "@app/core"
  import {makeClassifiedPath, makeSpacePath} from "@app/routes"
  import {pushModal} from "@app/modal"

  type Props = {
    url: string
    event: TrustedEvent
    showRoom?: boolean
    showActivity?: boolean
  }

  const {url, event, showRoom, showActivity}: Props = $props()

  const classified = reader(Classified)(event)

  const h = classified.room()
  const topics = classified.topics() ?? []
  const path = makeClassifiedPath(url, getAddress(event))

  const editClassified = () => pushModal(ClassifiedEdit, {url, event})

  const deleteReaction = (reaction: TrustedEvent) => retractReaction(reaction, {url, h})

  const createReaction = (values: EventContent) => publishReaction(event, values, {url, h})
</script>

<div class="flex grow flex-wrap justify-end gap-2">
  {#if h && showRoom}
    <Link href={makeSpacePath(url, h)} class="button button-neutral button-xs rounded-full">
      Posted in #<RoomName {h} {url} />
    </Link>
  {/if}
  <div class="flex min-w-0 flex-wrap gap-2">
    {#each uniq(topics) as topic (topic)}
      <button type="button" class="button button-xs rounded-full font-normal">
        #{normalizeTopic(topic)}
      </button>
    {/each}
  </div>
  <ReactionSummary {url} {event} {deleteReaction} {createReaction} reactionClass="tip-left" />
  <ThunkStatusOrDeleted {event}>
    <ClassifiedStatus {event} />
  </ThunkStatusOrDeleted>
  {#if showActivity}
    <EventActivity {url} {path} {event} />
  {/if}
  <EventActions {url} {event} noun="Listing">
    {#snippet customActions()}
      {#if event.pubkey === $user.pubkey}
        <li>
          <Button onclick={editClassified}>
            <Icon size={4} icon={Pen2} />
            Edit Listing
          </Button>
        </li>
      {/if}
    {/snippet}
  </EventActions>
</div>
