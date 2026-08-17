<script lang="ts">
  import {derived} from "svelte/store"
  import {page} from "$app/stores"
  import {formatTimestamp, sleep} from "@welshman/lib"
  import type {MakeNonOptional} from "@welshman/lib"
  import {Article} from "@welshman/domain"
  import PageContent from "@lib/components/PageContent.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import SpaceBar from "@app/components/SpaceBar.svelte"
  import ContentMarkdown from "@app/components/ContentMarkdown.svelte"
  import NoteCard from "@app/components/NoteCard.svelte"
  import ArticleActions from "@app/components/ArticleActions.svelte"
  import EventComments from "@app/components/EventComments.svelte"
  import {reader} from "@app/core"
  import {deriveEvent} from "@app/repository"
  import {decodeRelay} from "@app/relays"

  const {relay, address} = $page.params as MakeNonOptional<typeof $page.params>
  const url = decodeRelay(relay)
  const event = deriveEvent(address, [url])
  const article = derived(event, $event => ($event ? reader(Article)($event) : undefined))

  const back = () => history.back()
</script>

<SpaceBar {back}>
  {#snippet title()}
    <h1 class="truncate text-xl">{$article?.title() ?? ""}</h1>
  {/snippet}
</SpaceBar>

<PageContent class="flex flex-col gap-2 p-2 sm:gap-4 sm:p-4">
  {#if $event && $article}
    <NoteCard event={$event} {url} class="card z-feature w-full">
      <div class="flex flex-col gap-3 ml-12">
        {#if $article.image()}
          <img src={$article.image()} alt="" class="h-56 w-full rounded-2xl object-cover" />
        {/if}
        <div class="flex flex-col gap-1">
          <h2 class="text-2xl">{$article.title() ?? "Untitled"}</h2>
          <p class="text-sm opacity-75">
            Published {formatTimestamp($article.publishedAt())}
          </p>
        </div>
        {#if $article.summary()}
          <p class="text-lg opacity-75">{$article.summary()}</p>
        {/if}
        <ContentMarkdown event={$event} {url} />
        <ArticleActions showRoom event={$event} {url} />
      </div>
    </NoteCard>
    <EventComments event={$event} {url} />
  {:else}
    <div class="flex justify-center py-20">
      {#await sleep(5000)}
        <Spinner loading>Loading article...</Spinner>
      {:then}
        <p>Failed to load article.</p>
      {/await}
    </div>
  {/if}
</PageContent>
