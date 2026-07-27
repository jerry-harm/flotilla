<script lang="ts">
  import {type Instance} from "tippy.js"
  import type {NativeEmoji} from "emoji-picker-element/shared"
  import {between, throttle} from "@welshman/lib"
  import Button from "@lib/components/Button.svelte"
  import Tippy from "@lib/components/Tippy.svelte"
  import EmojiPicker from "@lib/components/EmojiPicker.svelte"

  const {tippyParams = {}, ...props} = $props()

  const open = () => popover?.show()

  const onClick = (emoji: NativeEmoji) => {
    props.onEmoji(emoji)
    popover?.hide()
  }

  const onMouseMove = throttle(300, ({clientX, clientY}: MouseEvent) => {
    if (popover) {
      const {x, y, width, height} = popover.popper.getBoundingClientRect()

      if (!between([x, x + width], clientX) || !between([y - 100, y + height + 100], clientY)) {
        popover.hide()
      }
    }
  })

  let popover: Instance | undefined = $state()
</script>

<svelte:document onmousemove={onMouseMove} />

<Button onclick={open} class={props.class}>
  <Tippy
    bind:popover
    class="flex"
    component={EmojiPicker}
    props={{onClick}}
    params={{trigger: "manual", interactive: true, ...tippyParams}}>
    {@render props.children?.()}
  </Tippy>
</Button>
