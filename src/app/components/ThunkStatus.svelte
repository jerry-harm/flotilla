<script lang="ts">
  import {BaseThunk} from "@welshman/app"
  import ThunkFailure from "@app/components/ThunkFailure.svelte"
  import ThunkPending from "@app/components/ThunkPending.svelte"

  interface Props {
    thunk: BaseThunk
    showToastOnRetry?: boolean
    class?: string
  }

  const {thunk, showToastOnRetry, ...restProps}: Props = $props()

  const showFailure = $derived($thunk.isComplete() && $thunk.getFailedUrls().length > 0)
  const showPending = $derived(!$thunk.isComplete())
</script>

{#if showFailure}
  <ThunkFailure class={restProps.class} {thunk} {showToastOnRetry} />
{:else if showPending}
  <ThunkPending class={restProps.class} {thunk} />
{/if}
