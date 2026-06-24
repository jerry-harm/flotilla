<script lang="ts">
  import type {Snippet} from "svelte"
  import cx from "classnames"

  let {
    value = $bindable(),
    before,
    after,
    sm = false,
    class: className = "",
    ...restProps
  }: {
    value?: any
    before?: Snippet
    after?: Snippet
    sm?: boolean
    class?: string
    [key: string]: any
  } = $props()

  const wrapperClass = $derived(cx("input", "input-group", {"input-sm": sm}, className))
</script>

<div class={wrapperClass}>
  {@render before?.()}
  <input bind:value {...restProps} />
  {@render after?.()}
</div>
