<script lang="ts">
  import {formatTimestamp} from "@welshman/lib"
  import type {TrustedEvent} from "@welshman/util"
  import {getAddress} from "@welshman/util"
  import {Article} from "@welshman/domain"
  import Link from "@lib/components/Link.svelte"
  import Content from "@app/components/Content.svelte"
  import ProfileLink from "@app/components/ProfileLink.svelte"
  import ArticleActions from "@app/components/ArticleActions.svelte"
  import {reader} from "@app/core"
  import {makeArticlePath} from "@app/routes"

  type Props = {
    url: string
    event: TrustedEvent
  }

  const {url, event}: Props = $props()

  const article = reader(Article)(event)

  const title = article.title()
  const summary = article.summary()
  const image = article.image()
</script>

<Link
  class="cv flex flex-col gap-2 card card-interactive w-full"
  href={makeArticlePath(url, getAddress(event))}>
  {#if image}
    <img src={image} alt="" class="h-40 w-full rounded-2xl object-cover" />
  {/if}
  <div class="flex w-full items-center justify-between gap-2">
    <p class="text-xl">{title || "Untitled"}</p>
    <p class="whitespace-nowrap text-sm opacity-75">
      {formatTimestamp(article.publishedAt())}
    </p>
  </div>
  <Content
    event={{content: summary || event.content, tags: event.tags}}
    {url}
    expandMode="inline"
    minLength={100}
    maxLength={300} />
  <div class="flex w-full flex-col items-end justify-between gap-2 sm:flex-row">
    <span class="whitespace-nowrap py-1 text-sm opacity-75">
      Written by
      <ProfileLink pubkey={event.pubkey} {url} />
    </span>
    <ArticleActions showRoom showActivity {url} {event} />
  </div>
</Link>
