<script lang="ts">
  import {between, throttle} from "@welshman/lib"
  import type {Maybe} from "@welshman/lib"
  import {isMobile} from "@lib/html"
  import Button from "@lib/components/Button.svelte"
  import Tippy from "@lib/components/Tippy.svelte"
  import type {TippyController} from "@lib/components/Tippy.svelte"
  import IconPickerModal from "@app/components/IconPickerModal.svelte"
  import IconPickerPopover from "@app/components/IconPickerPopover.svelte"
  import {pushModal, popModal} from "@app/modal"

  const {...props} = $props()

  const open = () => {
    if (isMobile) {
      pushModal(IconPickerModal, {onSelect: onClick}, {nested: true})
    } else {
      tippy?.show()
    }
  }

  const close = () => {
    if (isMobile) {
      popModal()
    } else {
      tippy?.hide()
    }
  }

  const onClick = (iconUrl: string) => {
    props.onSelect(iconUrl)
    close()
  }

  const onMouseMove = throttle(300, ({clientX}: MouseEvent) => {
    const rect = tippy?.rect()

    if (rect && !between([rect.x - 50, rect.x + rect.width + 50], clientX)) {
      tippy!.hide()
    }
  })

  let tippy: Maybe<TippyController> = $state()
</script>

<svelte:document onmousemove={onMouseMove} />

<Tippy
  bind:controller={tippy}
  component={IconPickerPopover}
  props={{onSelect: onClick}}
  params={{trigger: "manual", interactive: true, placement: "top-end"}}>
  <Button onclick={open} class={props.class}>
    {@render props.children?.()}
  </Button>
</Tippy>
