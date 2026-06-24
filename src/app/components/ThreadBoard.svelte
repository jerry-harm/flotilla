<script lang="ts">
  import type {TrustedEvent} from "@welshman/util"
  import RoomName from "@app/components/RoomName.svelte"
  import ThreadBoardItem from "@app/components/ThreadBoardItem.svelte"

  type Props = {
    url: string
    h: string
    threads: TrustedEvent[]
  }

  const {url, h, threads}: Props = $props()
</script>

<section class="card card-flat overflow-hidden pb-4 p-0">
  <header class="flex gap-2 justify-between bg-surface px-4 py-2.5">
    <h2 class="text-sm font-bold">
      {#if h}
        #<RoomName {url} {h} />
      {:else}
        General
      {/if}
    </h2>
    <span class="text-xs text-muted">
      {threads.length}
      {threads.length === 1 ? "topic" : "topics"}
    </span>
  </header>
  <table class="w-full border-collapse">
    <thead
      class="hidden text-xs font-bold uppercase tracking-wide text-muted sm:table-header-group">
      <tr>
        <th class="px-4 py-2 text-left">Topic</th>
        <th class="w-32 px-4 py-2 text-left">Author</th>
        <th class="w-20 px-4 py-2 text-center">Replies</th>
        <th class="w-32 px-4 py-2 text-right">Last post</th>
      </tr>
    </thead>
    <tbody>
      {#each threads as event (event.id)}
        <ThreadBoardItem {url} {event} />
      {/each}
    </tbody>
  </table>
</section>
