<script lang="ts">
  import type {TrustedEvent} from "@welshman/util"
  import {matchMd} from "@lib/theme"
  import RoomNameWithImage from "@app/components/RoomNameWithImage.svelte"
  import ThreadBoardItem from "@app/components/ThreadBoardItem.svelte"

  type Props = {
    url: string
    h: string
    threads: TrustedEvent[]
  }

  const {url, h, threads}: Props = $props()
</script>

<section class="card card-flat p-0">
  <header
    class="flex items-center justify-between gap-2 border-b border-solid border-line px-4 py-3">
    <h2 class="text-lg">
      {#if h}
        <RoomNameWithImage {url} {h} />
      {:else}
        General
      {/if}
    </h2>
    <span class="text-content-muted text-sm">
      {threads.length}
      {threads.length === 1 ? "Topic" : "Topics"}
    </span>
  </header>
  {#if $matchMd}
    <div class="scroll-container overflow-x-auto pb-4">
      <table class="w-full min-w-[640px] border-collapse">
        <thead
          class="border-b border-solid border-line bg-surface-less text-xs font-bold uppercase tracking-wide text-content-muted">
          <tr>
            <th class="px-4 py-3 text-left">Topic</th>
            <th class="w-32 px-4 py-3 text-left">Author</th>
            <th class="w-20 px-4 py-3 text-center">Replies</th>
            <th class="w-32 px-4 py-3 text-right">Last post</th>
          </tr>
        </thead>
        <tbody>
          {#each threads as event (event.id)}
            <ThreadBoardItem {url} {event} />
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <div class="pb-4">
      {#each threads as event (event.id)}
        <ThreadBoardItem mobile {url} {event} />
      {/each}
    </div>
  {/if}
</section>
