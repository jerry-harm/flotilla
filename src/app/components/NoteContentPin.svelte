<script lang="ts">
  import type {ComponentProps} from "svelte"
  import * as nip19 from "nostr-tools/nip19"
  import {Address} from "@welshman/util"
  import Badge from "@lib/components/Badge.svelte"
  import Content from "@app/components/Content.svelte"
  import PinContentEvent from "@app/components/PinContentEvent.svelte"
  import {readPin} from "@app/pinboards"

  const props: ComponentProps<typeof Content> = $props()

  const pin = readPin(props.event)

  // Encode nostr references as nostr: entities (i tags are already urls) so
  // Content parses them into rich embeds rather than rendering raw ids/coords.
  const content = $derived.by(() => {
    const [type, data = ""] = pin.value

    if (type === "e") return "nostr:" + nip19.neventEncode({id: data})

    if (type === "a") {
      const {kind, pubkey, identifier} = Address.from(data)

      return "nostr:" + nip19.naddrEncode({kind, pubkey, identifier})
    }

    return data
  })
</script>

<div class="flex h-full flex-col gap-2">
  {#if pin.title}
    <strong class="truncate min-w-0">{pin.title}</strong>
  {/if}
  {#if pin.description}
    <Content event={{content: pin.description, tags: []}} />
  {/if}
  {#if pin.value[0] === "i"}
    <Content event={{content, tags: []}} />
  {:else}
    <PinContentEvent value={pin.value[1]} relays={pin.value[2] ? [pin.value[2]] : []} />
  {/if}
  {#if pin.topics.length > 0}
    <div class="mt-auto flex flex-wrap gap-1">
      {#each pin.topics as topic (topic)}
        <Badge>#{topic}</Badge>
      {/each}
    </div>
  {/if}
</div>
