<script lang="ts">
  import {THREAD, CLASSIFIED, LONG_FORM, ZAP_GOAL, EVENT_TIME, POLL} from "@welshman/util"
  import NoteItem from "@app/components/NoteItem.svelte"
  import ThreadItem from "@app/components/ThreadItem.svelte"
  import ClassifiedItem from "@app/components/ClassifiedItem.svelte"
  import ArticleItem from "@app/components/ArticleItem.svelte"
  import GoalItem from "@app/components/GoalItem.svelte"
  import CalendarEventItem from "@app/components/CalendarEventItem.svelte"
  import PollItem from "@app/components/PollItem.svelte"
  import RecentConversation from "@app/components/RecentConversation.svelte"
  import type {FeedContext} from "@app/feeds"
  import type {RecentActivityItem} from "@app/recent"

  type Props = {
    url: string
    item: RecentActivityItem
    context: FeedContext
  }

  const {url, item, context}: Props = $props()
</script>

{#if item.type === "message"}
  <RecentConversation {url} event={item.event} count={item.count} />
{:else if item.event.kind === THREAD}
  <ThreadItem {url} {context} event={item.event} />
{:else if item.event.kind === CLASSIFIED}
  <ClassifiedItem {url} {context} event={item.event} />
{:else if item.event.kind === LONG_FORM}
  <ArticleItem {url} {context} event={item.event} />
{:else if item.event.kind === ZAP_GOAL}
  <GoalItem {url} {context} event={item.event} />
{:else if item.event.kind === EVENT_TIME}
  <CalendarEventItem {url} {context} event={item.event} />
{:else if item.event.kind === POLL}
  <PollItem {url} {context} event={item.event} />
{:else}
  <NoteItem {url} {context} event={item.event} />
{/if}
