<script lang="ts">
  import type {NativeEmoji} from "emoji-picker-element/shared"
  import type {TrustedEvent} from "@welshman/util"
  import SmileCircle from "@assets/icons/smile-circle.svg?dataurl"
  import Pen from "@assets/icons/pen.svg?dataurl"
  import Reply from "@assets/icons/reply-2.svg?dataurl"
  import Copy from "@assets/icons/copy.svg?dataurl"
  import Code2 from "@assets/icons/code-2.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Modal from "@lib/components/Modal.svelte"
  import ModalBody from "@lib/components/ModalBody.svelte"
  import Button from "@lib/components/Button.svelte"
  import EmojiPicker from "@lib/components/EmojiPicker.svelte"
  import EventInfo from "@app/components/EventInfo.svelte"
  import {reactions, wraps, wrapPow} from "@app/core"
  import {pushModal} from "@app/modal"
  import {clip} from "@app/toast"

  type Props = {
    pubkeys: string[]
    event: TrustedEvent
    reply: () => void
    edit?: () => void
  }

  const {event, pubkeys, reply, edit}: Props = $props()

  const onEmoji = async (emoji: NativeEmoji) => {
    history.back()

    const reaction = await $reactions.react(event, emoji.unicode)

    return $wraps.publish({event: reaction.event, recipients: pubkeys, pow: wrapPow})
  }

  const showEmojiPicker = () => pushModal(EmojiPicker, {onClick: onEmoji}, {replaceState: true})

  const sendReply = () => {
    history.back()
    reply()
  }

  const sendEdit = () => {
    history.back()
    edit?.()
  }

  const copyText = () => {
    history.back()
    clip(event.content)
  }

  const showInfo = () => pushModal(EventInfo, {event}, {replaceState: true})
</script>

<Modal>
  <ModalBody>
    <div class="flex flex-col gap-2">
      <Button class="button button-neutral" onclick={showInfo}>
        <Icon size={4} icon={Code2} />
        Message Info
      </Button>
      <Button class="button button-neutral w-full" onclick={copyText}>
        <Icon size={4} icon={Copy} />
        Copy Text
      </Button>
      <Button class="button button-neutral w-full" onclick={sendReply}>
        <Icon size={4} icon={Reply} />
        Send Reply
      </Button>
      {#if edit}
        <Button class="button button-neutral w-full" onclick={sendEdit}>
          <Icon size={4} icon={Pen} />
          Edit Message
        </Button>
      {/if}
      <Button class="button button-primary w-full" onclick={showEmojiPicker}>
        <Icon size={4} icon={SmileCircle} />
        Send Reaction
      </Button>
    </div>
  </ModalBody>
</Modal>
