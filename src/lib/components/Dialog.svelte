<script module lang="ts">
  export type DialogSize = "default" | "large"
</script>

<script lang="ts">
  import type {Component} from "svelte"
  import cx from "classnames"
  import {noop} from "@welshman/lib"
  import {fade, fly} from "@lib/transition"
  import Close from "@assets/icons/close.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"

  type Props = {
    onClose?: any
    noEscape?: boolean
    fullscreen?: boolean
    size?: DialogSize
    children: {
      component: Component<any>
      props: Record<string, any>
    }
  }

  const {
    onClose = noop,
    noEscape = false,
    fullscreen = false,
    size = "default",
    children,
  }: Props = $props()

  const wrapperClass = $derived(
    cx("absolute inset-0 flex sm:relative pointer-events-none", {
      "items-center justify-center": fullscreen,
      "items-end sm:items-center": !fullscreen,
      "sm:w-[520px]": !fullscreen && size === "default",
      "sm:w-[90%]": !fullscreen && size === "large",
    }),
  )

  const innerClass = $derived(
    cx("dialog relative text-content grow pointer-events-auto", "rounded-t-2xl sm:rounded-3xl", {
      "bg-surface max-h-[90vh] flex flex-col max-w-full pb-sai sm:pb-0": !fullscreen,
    }),
  )

  const buttonClass = $derived(
    cx("absolute right-3 z-tooltip", {
      "top-3": fullscreen,
      "-top-4 mr-sai": !fullscreen,
    }),
  )
</script>

<div class="dialog flex justify-center items-center fixed inset-0 z-modal">
  <button
    type="button"
    aria-label="Close dialog"
    class="absolute inset-0 cursor-pointer bg-black opacity-50 dark:opacity-75"
    transition:fade={{duration: 200}}
    onclick={onClose}>
  </button>
  <div class={wrapperClass}>
    <div
      class={innerClass}
      style={!fullscreen ? "box-shadow: var(--shadow-lg)" : undefined}
      transition:fly>
      {#if !noEscape}
        <Button
          class={cx("button button-neutral button-sm button-circle", buttonClass)}
          onclick={onClose}>
          <Icon icon={Close} size={6} />
        </Button>
      {/if}
      <children.component {...children.props} />
    </div>
  </div>
</div>
