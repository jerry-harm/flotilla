<script lang="ts">
  import cx from "classnames"
  import {onMount} from "svelte"
  import type {Snippet} from "svelte"
  import {groupBy, map, sum, uniq, uniqBy, batch, displayList} from "@welshman/lib"
  import {
    REPORT,
    REACTION,
    ZAP_RESPONSE,
    getReplyFilters,
    getEmojiTags,
    getEmojiTag,
    fromMsats,
    getTag,
    DELETE,
  } from "@welshman/util"
  import type {TrustedEvent, EventContent, Zap} from "@welshman/util"
  import {deriveArray, deriveEventsById, deriveItemsByKey} from "@welshman/store"
  import {load} from "@welshman/net"
  import {Router} from "@welshman/router"
  import {pubkey, repository, getValidZap, displayProfileByPubkey} from "@welshman/app"
  import {isMobile, stopPropagation} from "@lib/html"
  import Danger from "@assets/icons/danger-triangle.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Reaction from "@app/components/Reaction.svelte"
  import ReportDetails from "@app/components/ReportDetails.svelte"
  import {REACTION_KINDS} from "@app/content"
  import {deriveUserIsSpaceAdmin} from "@app/members"
  import {pushModal} from "@app/modal"

  interface Props {
    event: TrustedEvent
    deleteReaction: (event: TrustedEvent) => void
    createReaction: (event: EventContent) => void
    url?: string
    reactionClass?: string
    noTooltip?: boolean
    innerEvent?: TrustedEvent
    children?: Snippet
  }

  const {
    event,
    deleteReaction,
    createReaction,
    url = "",
    reactionClass = "",
    noTooltip = false,
    innerEvent = undefined,
    children,
  }: Props = $props()

  const eventIds = innerEvent ? [event.id, innerEvent.id] : [event.id]

  const reports = deriveArray(
    deriveEventsById({repository, filters: [{kinds: [REPORT], "#e": [event.id]}]}),
  )

  const reactions = deriveArray(
    deriveEventsById({repository, filters: [{kinds: [REACTION], "#e": eventIds}]}),
  )

  const zaps = deriveArray(
    deriveItemsByKey<Zap>({
      repository,
      getKey: zap => zap.response.id,
      filters: [{kinds: [ZAP_RESPONSE], "#e": eventIds}],
      eventToItem: (response: TrustedEvent) => {
        const zap = getValidZap(response, event)

        if (zap) {
          return zap
        }

        if (innerEvent) {
          return getValidZap(response, innerEvent)
        }
      },
    }),
  )

  const onReactionClick = (events: TrustedEvent[]) => {
    const reaction = events.find(e => e.pubkey === $pubkey)

    if (reaction) {
      deleteReaction(reaction)
    } else {
      const [event] = events

      createReaction({
        content: event.content,
        tags: getEmojiTags(event.content.replace(/:/g, ""), event.tags),
      })
    }
  }

  const userIsAdmin = deriveUserIsSpaceAdmin(url)

  const onReportClick = () => pushModal(ReportDetails, {url, event})

  const reportReasons = $derived(uniq(map(e => getTag("e", e.tags)?.[2], $reports.values())))

  const getReactionKey = (e: TrustedEvent) => getEmojiTag(e.content, e.tags)?.join("") || e.content

  const groupedReactions = $derived(
    groupBy(
      getReactionKey,
      uniqBy(e => `${e.pubkey}${getReactionKey(e)}`, $reactions.values()),
    ),
  )

  const groupedZaps = $derived(groupBy(e => getReactionKey(e.request), $zaps.values()))

  onMount(() => {
    const controller = new AbortController()
    const relays = url ? [url] : Router.get().ForUser().getUrls()

    if (relays.length > 0) {
      load({
        relays,
        signal: controller.signal,
        filters: getReplyFilters([event], {kinds: REACTION_KINDS}),
        onEvent: batch(300, (events: TrustedEvent[]) => {
          load({
            relays,
            filters: getReplyFilters(events, {kinds: [DELETE]}),
          })
        }),
      })
    }

    return () => {
      controller.abort()
    }
  })
</script>

{#if $reactions.length > 0 || $zaps.length || $reports.length > 0 || children}
  <div class="flex min-w-0 flex-wrap gap-2">
    {#if url && $reports.length > 0 && $userIsAdmin}
      <Button
        data-tip={`This content has been reported as "${displayList(reportReasons)}".`}
        class={cx(
          "button button-error button-xs tip-right flex items-center gap-1 rounded-full font-normal",
          {
            tip: !noTooltip && !isMobile,
          },
        )}
        onclick={stopPropagation(onReportClick)}>
        <Icon icon={Danger} />
        <span>{$reports.length}</span>
      </Button>
    {/if}
    {#each groupedZaps.entries() as [key, zaps]}
      {@const amount = fromMsats(sum(zaps.map(zap => zap.invoiceAmount)))}
      {@const pubkeys = uniq(zaps.map(zap => zap.request.pubkey))}
      {@const isOwn = $pubkey && pubkeys.includes($pubkey)}
      {@const info = displayList(pubkeys.map(pubkey => displayProfileByPubkey(pubkey)))}
      {@const tooltip = `${info} zapped`}
      <Button
        data-tip={tooltip}
        class={cx(
          reactionClass,
          "button button-xs flex-inline flex items-center gap-1 rounded-full text-xs font-normal",
          {
            tip: !noTooltip && !isMobile,
            "button-primary": isOwn,
            "button-neutral": !isOwn,
          },
        )}>
        <Reaction event={zaps[0].request} />
        <span>{amount}</span>
      </Button>
    {/each}
    {#each groupedReactions.entries() as [key, events]}
      {@const pubkeys = events.map(e => e.pubkey)}
      {@const isOwn = $pubkey && pubkeys.includes($pubkey)}
      {@const info = displayList(pubkeys.map(pubkey => displayProfileByPubkey(pubkey)))}
      {@const tooltip = `${info} reacted`}
      {@const onClick = () => onReactionClick(events)}
      <Button
        data-tip={tooltip}
        class={cx(reactionClass, "button button-xs flex-inline gap-1 rounded-full font-normal", {
          tip: !noTooltip && !isMobile,
          "button-primary": isOwn,
          "button-neutral": !isOwn,
        })}
        onclick={stopPropagation(onClick)}>
        <Reaction event={events[0]} />
        {#if events.length > 1}
          <span>{events.length}</span>
        {/if}
      </Button>
    {/each}
    {@render children?.()}
  </div>
{/if}
