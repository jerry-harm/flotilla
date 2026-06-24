<script lang="ts">
  import {onMount} from "svelte"
  import {Client} from "@pomade/core"
  import {session, isPomadeSession} from "@welshman/app"
  import MenuDots from "@assets/icons/menu-dots.svg?dataurl"
  import {fly} from "@lib/transition"
  import Icon from "@lib/components/Icon.svelte"
  import Button from "@lib/components/Button.svelte"
  import Badge from "@lib/components/Badge.svelte"
  import Popover from "@lib/components/Popover.svelte"
  import TrashBin2 from "@assets/icons/trash-bin-2.svg?dataurl"
  import {pushToast} from "@app/toast"
  import {loadOtherPomadeSessions} from "@app/pomade"
  import type {PomadeSessionWithPeers} from "@app/pomade"

  const toggleMenu = (client: string) => {
    menuClient = menuClient === client ? "" : client
  }

  const closeMenu = () => {
    menuClient = ""
  }

  let menuClient = $state("")
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
          <div class="relative">
            <Button
              class="button button-ghost button-sm button-circle"
              onclick={() => toggleMenu(sessionItem.client)}>
              <Icon icon={MenuDots} />
            </Button>
            {#if menuClient === sessionItem.client}
              <Popover hideOnClick onClose={closeMenu}>
                <ul
                  transition:fly
                  class="menu bg-surface absolute right-0 z-popover mt-2 w-48 gap-1 rounded-2xl p-2">
                  <li>
                    <Button onclick={() => deleteSession(sessionItem)}>
                      <Icon icon={TrashBin2} />
                      Delete Session
                    </Button>
                  </li>
                </ul>
              </Popover>
            {/if}
          </div>
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
