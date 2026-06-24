<script lang="ts">
  import {onMount, tick} from "svelte"
  import {get} from "svelte/store"
  import {debounce} from "throttle-debounce"
  import {load} from "@welshman/net"
  import {groupBy, uniqBy, now, MINUTE, HOUR, DAY, WEEK} from "@welshman/lib"
  import type {TrustedEvent, Filter} from "@welshman/util"
  import {MESSAGE, getTagValue, sortEventsDesc, displayRelayUrl} from "@welshman/util"
  import Magnifier from "@assets/icons/magnifier.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Spinner from "@lib/components/Spinner.svelte"
  import Button from "@lib/components/Button.svelte"
  import Badge from "@lib/components/Badge.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalHeader from "@lib/components/ModalHeader.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import ModalTitle from "@lib/components/ModalTitle.svelte"
  import ModalSubtitle from "@lib/components/ModalSubtitle.svelte"
  import RoomName from "@app/components/RoomName.svelte"
  import NoteCard from "@app/components/NoteCard.svelte"
  import NoteContentMinimal from "@app/components/NoteContentMinimal.svelte"
  import {CONTENT_KINDS} from "@app/content"
  import {deriveEventsForUrlDesc} from "@app/repository"
  import {popModal} from "@app/modal"
  import {goToEvent} from "@app/routes"

  type Props = {
    url: string
  }

  const {url}: Props = $props()

  let term = $state("")
  let results = $state<TrustedEvent[]>([])
  let loading = $state(false)
  let input: HTMLInputElement | undefined = $state()
  let controller: AbortController | undefined

  const doSearch = debounce(300, async (searchTerm: string, controller: AbortController) => {
    if (!searchTerm?.trim()) {
      loading = false
      results = []
      return
    }

    const filter: Filter = {
      kinds: [MESSAGE, ...CONTENT_KINDS],
      search: searchTerm.trim(),
    }

    results = get(deriveEventsForUrlDesc(url, [filter]))

    try {
      const events = await load({
        relays: [url],
        signal: controller.signal,
        filters: [filter],
      })

      results = sortEventsDesc(uniqBy((e: TrustedEvent) => e.id, [...events, ...results]))
    } catch (error) {
      // Ignore aborts from superseded searches; surface anything else
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        throw error
      }
    } finally {
      loading = false
    }
  })

  const onInput = () => {
    loading = true
    controller?.abort()
    controller = new AbortController()
    doSearch(term, controller)
  }

  const eventsByAge = $derived(groupBy(e => getAgeSection(e.created_at), results))

  const getAgeSection = (createdAt: number) => {
    const age = now() - createdAt

    if (age <= DAY) {
      return "day"
    }

    if (age <= WEEK) {
      return "week"
    }

    return "older"
  }

  const getAgeLabel = (createdAt: number) => {
    const age = now() - createdAt

    if (age < MINUTE) {
      return "Just now"
    }

    if (age < HOUR) {
      return `${Math.floor(age / MINUTE)}m ago`
    }

    if (age < DAY) {
      return `${Math.floor(age / HOUR)}h ago`
    }

    return `${Math.floor(age / DAY)}d ago`
  }

  const onResultClick = (event: TrustedEvent) => {
    popModal()
    goToEvent(event, {keepFocus: true})
  }

  onMount(() => {
    tick().then(() => input?.focus())

    return () => controller?.abort()
  })
</script>

<Modal class="flex flex-col gap-2">
  <ModalHeader>
    <ModalTitle>Search Content</ModalTitle>
    <ModalSubtitle>
      on <span class="text-primary">{displayRelayUrl(url)}</span>
    </ModalSubtitle>
  </ModalHeader>
  <ModalBody>
    <label class="input input-sm input-group flex w-full items-center gap-2">
      <Icon size={4} icon={Magnifier} />
      <input
        bind:this={input}
        bind:value={term}
        class="min-w-0 grow"
        type="text"
        placeholder="Search this space..."
        oninput={onInput} />
    </label>
    {#if loading}
      <Spinner {loading}>Searching...</Spinner>
    {:else if eventsByAge.size === 0 && term}
      <Spinner {loading}>No results found.</Spinner>
    {:else}
      {#each eventsByAge as [key, events] (key)}
        <p class="text-xs uppercase tracking-wide opacity-60">
          {#if key === "day"}
            Last 24 Hours
          {:else if key === "week"}
            Last 7 Days
          {:else}
            Older
          {/if}
        </p>
        {#each events as event (event.id)}
          {@const h = getTagValue("h", event.tags)}
          <Button
            class="card card-sm card-interactive flex flex-col gap-2"
            onclick={() => onResultClick(event)}>
            <NoteCard minimal {event}>
              <NoteContentMinimal {event} />
            </NoteCard>
            <div class="flex gap-2">
              <Badge variant="neutral">
                {getAgeLabel(event.created_at)}
              </Badge>
              {#if h}
                <Badge variant="neutral">
                  <RoomName {url} {h} />
                </Badge>
              {/if}
            </div>
          </Button>
        {/each}
      {/each}
    {/if}
  </ModalBody>
</Modal>
