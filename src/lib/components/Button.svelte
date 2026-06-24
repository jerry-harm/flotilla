<script lang="ts">
  import type {Snippet} from "svelte"

  // Button is BEHAVIOR only: it renders a <button>, swallows the default
  // event/propagation, and forwards everything else. Styling is supplied by the
  // caller as classes (`class="button button-primary"`), so the same `button*` styles in
  // common.css can be applied to <a> (via Link), <span>, etc. without a prop API.
  const {
    children,
    onclick,
    type = "button",
    ...restProps
  }: {
    children: Snippet
    onclick?: (event: Event) => any
    type?: "button" | "submit"
    class?: string
    style?: string
    disabled?: boolean
    "data-tip"?: string
    "aria-label"?: string
    "aria-pressed"?: boolean
  } = $props()

  const onClick = (e: Event) => {
    e.preventDefault()
    e.stopPropagation()

    onclick?.(e)
  }
</script>

{#if type === "submit"}
  <button {...restProps} {type}>
    {@render children?.()}
  </button>
{:else}
  <button {...restProps} onclick={onClick} type="button">
    {@render children?.()}
  </button>
{/if}
