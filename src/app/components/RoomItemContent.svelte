<script lang="ts">
  import cx from "classnames"
  import type {ComponentProps} from "svelte"
  import {MESSAGE} from "@welshman/util"
  import {isMobile} from "@lib/html"
  import Link from "@lib/components/Link.svelte"
  import NoteContent from "@app/components/NoteContent.svelte"
  import {getRoomItemPath} from "@app/routes"

  const props: ComponentProps<typeof NoteContent> = $props()
  const path = getRoomItemPath(props.url!, props.event)

  const minLength = 5000
  const maxLength = 5500
  const className = cx("text-sm block", {"card card-sm shadow-none": props.event.kind !== MESSAGE})
</script>

{#if path && !isMobile}
  <Link href={path} class={className}>
    <NoteContent {...props} {minLength} {maxLength} />
  </Link>
{:else}
  <div class={className}>
    <NoteContent {...props} {minLength} {maxLength} />
  </div>
{/if}
