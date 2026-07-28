<script lang="ts">
  import "tippy.js/animations/shift-away.css"

  import tippy from "tippy.js"
  import type {Instance} from "tippy.js"
  import {onMount, mount, unmount} from "svelte"
  import {isMobile} from "@lib/html"

  let {
    component,
    children = undefined,
    props = {},
    params = {},
    popover = $bindable(),
    instance = $bindable(),
    ...restProps
  } = $props()

  let element: Element

  // `mount` only tracks prop changes when the props come from a `$state` object,
  // so sync incoming props into a reactive one. Without this the popover keeps
  // the props it was first mounted with, showing stale data after the source updates.
  const mountedProps = $state({...props})

  $effect(() => {
    Object.assign(mountedProps, props)
  })

  onMount(() => {
    const target = document.createElement("div")

    popover = tippy(element, {
      content: target,
      animation: "shift-away",
      appendTo: document.querySelector(".tippy-target")!,
      trigger: isMobile ? "click" : "mouseenter focus",
      ...params,
      onShow: (tippyInstance: Instance) => {
        instance ??= mount(component, {target, props: mountedProps})

        return params.onShow?.(tippyInstance)
      },
    })

    return () => {
      popover?.destroy()

      if (instance) {
        unmount(instance)
      }
    }
  })
</script>

<div bind:this={element} class={restProps.class}>
  {@render children?.()}
</div>
