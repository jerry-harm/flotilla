<script lang="ts">
  import RoleBadge from "@app/components/RoleBadge.svelte"
  import type {SpaceRole} from "@app/members"

  interface Props {
    role: SpaceRole
  }

  const {role}: Props = $props()
</script>

<div class="flex min-w-0 flex-col gap-2 justify-between">
  <RoleBadge {role} size="md" />
  {#if role.description}
    <p class="text-sm opacity-70">{role.description}</p>
  {/if}
</div>
