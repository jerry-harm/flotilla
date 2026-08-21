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

  const deleted = deriveIsDeleted(event)
  const history = $thunks.history
  const thunk = $derived($thunks.merge($history.filter(t => t.event.id === event.id)))
</script>

{#if $deleted}
  <div class="button button-error button-xs rounded-full">Deleted</div>
{:else}
  {#if thunk.thunks.length > 0 && !thunk.hasStatus(PublishStatus.Success)}
    <ThunkStatus {thunk} />
  {:else}
    {@render status?.()}
  {/if}
  {@render children?.()}
{/if}
