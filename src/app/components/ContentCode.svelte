<script lang="ts">
  const {value, isBlock} = $props()
</script>

<code
  class="bg-surface-more text-content w-full overflow-auto whitespace-pre rounded px-1 text-sm"
  class:block={isBlock}>
  {value.trim()}
</code>
