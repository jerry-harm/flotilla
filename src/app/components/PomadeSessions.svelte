<script lang="ts">
  import {onMount} from "svelte"
  import {Client} from "@pomade/core"
  import {session, isPomadeSession} from "@welshman/app"
  import MenuButton from "@lib/components/MenuButton.svelte"
  import Badge from "@lib/components/Badge.svelte"
  import PomadeSessionMenu from "@app/components/PomadeSessionMenu.svelte"
  import {pushToast} from "@app/toast"
  import {loadOtherPomadeSessions} from "@app/pomade"
  import type {PomadeSessionWithPeers} from "@app/pomade"

  let sessions = $state<PomadeSessionWithPeers[]>([])

  const deleteSession = async (sessionItem: PomadeSessionWithPeers) => {
    if (!isPomadeSession($session)) return

    try {
      const client = new Client($session.clientOptions)
      const result = await client.deleteSession(sessionItem.client, sessionItem.peers)

      if (result.ok) {
        pushToast({
          message: "Session deleted successfully",
        })

        // Remove from local list
        sessions = sessions.filter(s => s.client !== sessionItem.client)
      } else {
        pushToast({
          theme: "error",
          message: "Failed to delete session",
        })
      }
    } catch (e) {
      console.error(e)
      pushToast({
        theme: "error",
        message: "Failed to delete session",
      })
    }
  }

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp * 1000)
    return date.toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  onMount(() => {
    loadOtherPomadeSessions().then(_sessions => {
      sessions = _sessions || []
    })
  })
</script>

{#if sessions.length > 0}
  <div class="flex flex-col gap-4 border-t border-solid pt-4" style="border-color: var(--line)">
    <strong>Other Sessions</strong>
    {#each sessions as sessionItem (sessionItem.client)}
      <div class="flex flex-col gap-2">
        <div class="flex justify-between items-center">
          <div class="flex gap-3 items-center text-sm">
            <span>Session {sessionItem.client.slice(0, 8)}</span>
            <span class="opacity-75">
              {#if sessionItem.deactivated_at}
                Deactivated
              {/if}
            </span>
          </div>
          <MenuButton
            component={PomadeSessionMenu}
            componentProps={{onDelete: () => deleteSession(sessionItem)}} />
        </div>
        <div class="flex gap-1">
          <Badge variant="neutral">
            Created {formatDate(sessionItem.created_at)}
          </Badge>
          <Badge variant="neutral">
            Active {formatDate(sessionItem.last_activity)}
          </Badge>
        </div>
      </div>
    {/each}
  </div>
{/if}
