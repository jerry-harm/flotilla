<script lang="ts">
  import type {Snippet} from "svelte"
  import type {TrustedEvent} from "@welshman/util"
  import {PublishStatus} from "@welshman/net"
  import {deriveIsDeleted} from "@app/repository"
  import ThunkStatus from "@app/components/ThunkStatus.svelte"
  import {thunks} from "@app/core"

  type Props = {
    event: TrustedEvent
    status?: Snippet
    children?: Snippet
  }

  const {event, status, children}: Props = $props()

  // Editing a replaceable event hands this a different event
  const deleted = $derived(deriveIsDeleted(event))
  const history = $thunks.history
  // Subscribed rather than read: a thunk mutates its results in place and notifies, so reading
  // them off the object would leave this showing a publish that has since finished.
  const thunk = $derived($thunks.merge($history.filter(t => t.event.id === event.id)))
</script>

{#if $deleted}
  <div class="button button-error button-xs rounded-full">Deleted</div>
{:else}
  {#if $thunk.thunks.length > 0 && !$thunk.hasStatus(PublishStatus.Success)}
    <ThunkStatus {thunk} />
  {:else}
    {@render status?.()}
  {/if}
  {@render children?.()}
{/if}
