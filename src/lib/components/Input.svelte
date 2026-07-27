<script lang="ts">
  import type {Snippet} from "svelte"
  import type {HTMLInputAttributes} from "svelte/elements"
  import cx from "classnames"

  type Props = Omit<HTMLInputAttributes, "value"> & {
    value?: string
    before?: Snippet
    after?: Snippet
    sm?: boolean
  }

  let {
    value = $bindable(),
    before,
    after,
    sm = false,
    class: className = "",
    ...restProps
  }: Props = $props()

  const wrapperClass = $derived(cx("input", "input-group", {"input-sm": sm}, className))
</script>

<div class={wrapperClass}>
  {@render before?.()}
  <input bind:value {...restProps} />
  {@render after?.()}
</div>
