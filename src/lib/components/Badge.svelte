<script lang="ts">
  import type {Snippet} from "svelte"
  import type {HTMLAttributes} from "svelte/elements"
  import cx from "classnames"

  type Props = HTMLAttributes<HTMLSpanElement> & {
    children?: Snippet
    variant?: "neutral" | "primary" | "warning"
  }

  const {children, variant = "neutral", ...restProps}: Props = $props()

  const className = $derived(cx("badge", `badge-${variant}`, restProps.class))
</script>

<span {...restProps} class={className}>
  {@render children?.()}
</span>
