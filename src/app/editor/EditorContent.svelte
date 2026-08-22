<script lang="ts">
  import {Editor} from "@welshman/editor"
  import {onDestroy, onMount} from "svelte"

  type Props = {
    editor: Promise<Editor>
    autofocus?: boolean
  }

  const {editor, autofocus}: Props = $props()

  let element: HTMLElement

  onMount(() => {
    editor.then(ed => {
      if (ed.options.element) {
        // Tiptap builds and owns its editor element, so mounting it here is the point of this
        // component rather than something svelte could be left to render.
        // eslint-disable-next-line svelte/no-dom-manipulating
        element?.append(ed.options.element)
      }

      if (autofocus) {
        const hasContent = ed.getText().trim().length > 0

        requestAnimationFrame(() => {
          ed.commands.focus(hasContent ? "end" : "start")
        })
      }
    })
  })

  onDestroy(() => {
    editor.then($editor => $editor.destroy())
  })
</script>

<div bind:this={element}></div>
