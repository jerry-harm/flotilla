<script lang="ts">
  import type {TrustedEvent} from "@welshman/util"
  import RoomNameWithImage from "@app/components/RoomNameWithImage.svelte"
  import ThreadBoardItem from "@app/components/ThreadBoardItem.svelte"

  type Props = {
    url: string
    h: string
    threads: TrustedEvent[]
  }

  const {url, h, threads}: Props = $props()
</script>

<section class="card card-flat overflow-hidden pb-4 p-0">
  <header
    class="flex gap-2 items-center justify-between px-4 py-3 border-b border-line border-solid">
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
  <table class="w-full border-collapse">
    <thead
      class="hidden text-xs font-bold uppercase tracking-wide text-content-muted sm:table-header-group border-b border-line border-solid bg-surface-less">
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
</section>
