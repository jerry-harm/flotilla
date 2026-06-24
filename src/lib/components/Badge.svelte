<script lang="ts">
  import type {Snippet} from "svelte"
  import cx from "classnames"

  const {
    children,
    variant = "neutral",
    ...restProps
  }: {
    children?: Snippet
    variant?: "neutral" | "primary" | "warning"
    class?: string
    [key: string]: any
  } = $props()

  const className = $derived(cx("badge", `badge-${variant}`, restProps.class))
</script>

<span {...restProps} class={className}>
  {@render children?.()}
</span>
