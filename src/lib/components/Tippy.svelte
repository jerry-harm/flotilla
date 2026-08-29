<script lang="ts">
  import "tippy.js/animations/shift-away.css"

  import tippy from "tippy.js"
  import type {Instance} from "tippy.js"
  import {onMount, mount, unmount} from "svelte"
  import {getTippyTarget, isMobile} from "@lib/html"

  let {
    component,
    children = undefined,
    props = {},
    params = {},
    popover = $bindable(),
    instance = $bindable(),
    show = $bindable(),
    ...restProps
  } = $props()

  let element: Element

  // `mount` only tracks prop changes when the props come from a `$state` object,
  // so sync incoming props into a reactive one. Without this the popover keeps
  // the props it was first mounted with, showing stale data after the source updates.
  const mountedProps = $state({...props})

  // Building a tippy costs a popper element and a set of listeners, which is wasted on the
  // hover menus of a chat row nobody ever opens. Only a real trigger needs the instance up
  // front — tippy is the one listening for it. A manual one can wait for `show`.
  const create = () => {
    popover ??= tippy(element, {
      content: target,
      animation: "shift-away",
      appendTo: getTippyTarget(),
      trigger: isMobile ? "click" : "mouseenter focus",
      ...params,
      onShow: (tippyInstance: Instance) => {
        instance ??= mount(component, {target, props: mountedProps})

        return params.onShow?.(tippyInstance)
      },
    })

    return popover
  }

  const target = document.createElement("div")

  show = () => create().show()

  $effect(() => {
    Object.assign(mountedProps, props)
  })

  onMount(() => {
    if (params.trigger !== "manual") {
      create()
    }

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
