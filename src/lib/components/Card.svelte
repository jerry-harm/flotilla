<script lang="ts">
  import type {Snippet} from "svelte"
  import cx from "classnames"

  const {
    children,
    tag = "div",
    sm = false,
    flat = false,
    interactive = false,
    ...restProps
  }: {
    children?: Snippet
    tag?: string
    sm?: boolean
    flat?: boolean
    interactive?: boolean
    class?: string
    [key: string]: any
  } = $props()

  const className = $derived(
    cx(
      "card",
      {
        "card-sm": sm,
        "card-flat": flat,
        "card-interactive": interactive,
      },
      restProps.class,
    ),
  )
</script>

<svelte:element this={tag} {...restProps} class={className}>
  {@render children?.()}
</svelte:element>
