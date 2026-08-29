<script lang="ts">
  import type {Snippet} from "svelte"
  import type {Instance} from "tippy.js"
  import type {NativeEmoji} from "emoji-picker-element/shared"
  import type {TrustedEvent} from "@welshman/util"
  import {tagSpec, tagValue} from "@welshman/util"
  import Bolt from "@assets/icons/bolt.svg?dataurl"
  import SmileCircle from "@assets/icons/smile-circle.svg?dataurl"
  import MenuDots from "@assets/icons/menu-dots.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Tippy from "@lib/components/Tippy.svelte"
  import Button from "@lib/components/Button.svelte"
  import EmojiButton from "@lib/components/EmojiButton.svelte"
  import ZapButton from "@app/components/ZapButton.svelte"
  import EventMenu from "@app/components/EventMenu.svelte"
  import {reactions, relays} from "@app/core"
  import {ENABLE_ZAPS} from "@app/env"

  type Props = {
    url: string
    noun: string
    event: TrustedEvent
    hideZap?: boolean
    customActions?: Snippet
  }

  const {url, noun, event, hideZap, customActions}: Props = $props()

  const shouldProtect = $relays.hasNip(url, 70)

  const hidePopover = () => popover?.hide()

  const onEmoji = async (emoji: NativeEmoji) => {
    const protect = await shouldProtect
    const room = tagValue(tagSpec("h"), event.tags)

    const command = await $reactions.react(event, emoji.unicode, writer => {
      writer.setProtected(protect)

      if (room) {
        writer.setRoom(url, room)
      }
    })

    return command.publishToRelays([url])
  }

  let popover: Instance | undefined = $state()
  let showPopover: () => void = $state(() => {})
</script>

<div class="items-center join">
  {#if ENABLE_ZAPS && !hideZap}
    <ZapButton {url} {event} class="button button-neutral button-xs join-item">
      <Icon icon={Bolt} size={4} />
    </ZapButton>
  {/if}
  <EmojiButton {onEmoji} class="button button-neutral button-xs join-item">
    <Icon icon={SmileCircle} size={4} />
  </EmojiButton>
  <Button onclick={showPopover} class="flex join-item button button-neutral button-xs">
    <Tippy
      bind:popover
      bind:show={showPopover}
      component={EventMenu}
      props={{url, noun, event, customActions, onClick: hidePopover}}
      params={{trigger: "manual", interactive: true}}>
      <Icon icon={MenuDots} size={4} />
    </Tippy>
  </Button>
</div>
