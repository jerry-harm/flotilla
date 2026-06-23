<script lang="ts">
  import * as nip19 from "nostr-tools/nip19"
  import {Address} from "@welshman/util"
  import MenuDots from "@assets/icons/menu-dots.svg?dataurl"
  import Pen from "@assets/icons/pen.svg?dataurl"
  import TrashBin from "@assets/icons/trash-bin-2.svg?dataurl"
  import {fly} from "@lib/transition"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Badge from "@lib/components/Badge.svelte"
  import Popover from "@lib/components/Popover.svelte"
  import Confirm from "@lib/components/Confirm.svelte"
  import Content from "@app/components/Content.svelte"
  import PinContentEvent from "@app/components/PinContentEvent.svelte"
  import PinEdit from "@app/components/PinEdit.svelte"
  import {deletePin, type Pin} from "@app/pinboards"
  import {pushModal} from "@app/modal"
  import {pushToast} from "@app/toast"

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

  let menuOpen = $state(false)

  const edit = () => {
    menuOpen = false
    pushModal(PinEdit, {url, pin})
  }

  const confirmDelete = () => {
    menuOpen = false
    pushModal(Confirm, {
      title: "Delete Link",
      message: "Delete this link?",
      confirm: async () => {
        const error = await deletePin(url, pin.id)

        if (error) {
          pushToast({theme: "error", message: error})
        } else {
          pushToast({message: "Link deleted!"})
        }
      },
    })
  }
</script>

<div class="{props.class} relative flex h-full flex-col gap-2">
  {#if showMenu}
    <div class="absolute right-2 top-2 z-feature">
      <Button
        class="button button-neutral button-sm button-square"
        aria-label="More options"
        onclick={() => (menuOpen = !menuOpen)}>
        <Icon size={4} icon={MenuDots} />
      </Button>
      {#if menuOpen}
        <Popover hideOnClick onClose={() => (menuOpen = false)}>
          <ul
            transition:fly
            class="menu bg-surface absolute right-0 z-popover mt-2 w-48 gap-1 rounded-2xl p-2">
            <li>
              <Button onclick={edit}>
                <Icon icon={Pen} />
                Edit link
              </Button>
            </li>
            <li>
              <Button class="text-error" onclick={confirmDelete}>
                <Icon icon={TrashBin} />
                Delete link
              </Button>
            </li>
          </ul>
        </Popover>
      {/if}
    </div>
    {#if pin.title}
      <strong class="ellipsize pr-8">{pin.title}</strong>
    {/if}
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
