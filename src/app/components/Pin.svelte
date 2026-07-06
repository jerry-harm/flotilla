<script lang="ts">
  import * as nip19 from "nostr-tools/nip19"
  import {Address} from "@welshman/util"
  import MenuButton from "@lib/components/MenuButton.svelte"
  import Badge from "@lib/components/Badge.svelte"
  import Content from "@app/components/Content.svelte"
  import PinContentEvent from "@app/components/PinContentEvent.svelte"
  import PinMenu from "@app/components/PinMenu.svelte"
  import {type Pin} from "@app/pinboards"

  type Props = {
    url: string
    pin: Pin
    minimal?: boolean
    showMenu?: boolean
    class?: string
  }

  const {url, pin, minimal, showMenu, ...props}: Props = $props()

  // Encode nostr references as nostr: entities (i tags are already urls) so
  // Content parses them into rich embeds rather than rendering raw ids/coords.
  const content = $derived.by(() => {
    const [type, data = ""] = pin.value

    if (type === "e") return "nostr:" + nip19.neventEncode({id: data, relays: [url]})

    if (type === "a") {
      const {kind, pubkey, identifier} = Address.from(data)

      return "nostr:" + nip19.naddrEncode({kind, pubkey, identifier, relays: [url]})
    }

    return data
  })
</script>

<div class="{props.class} relative flex h-full flex-col gap-2">
  {#if showMenu}
    <div class="absolute right-2 top-2 z-feature">
      <MenuButton
        class="button button-neutral button-sm button-square"
        aria-label="More options"
        iconSize={4}
        component={PinMenu}
        componentProps={{url, pin}} />
    </div>
    {#if pin.title}
      <strong class="truncate min-w-0 pr-8">{pin.title}</strong>
    {/if}
  {/if}
  {#if pin.description}
    <Content event={{content: pin.description, tags: []}} {url} />
  {/if}
  {#if pin.value[0] === "i"}
    <Content event={{content, tags: []}} {url} />
  {:else}
    <PinContentEvent
      {url}
      value={pin.value[1]}
      relays={pin.value[2] ? [pin.value[2], url] : [url]} />
  {/if}
  {#if !minimal && pin.topics.length > 0}
    <div class="mt-auto flex flex-wrap gap-1">
      {#each pin.topics as topic (topic)}
        <Badge>#{topic}</Badge>
      {/each}
    </div>
  {/if}
</div>
