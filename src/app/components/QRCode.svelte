<script lang="ts">
  import QRCode from "qrcode"
  import Button from "@lib/components/Button.svelte"
  import {clip} from "@app/toast"

  const {code, ...props} = $props()

  let canvas: HTMLCanvasElement | undefined = $state()
  let wrapper: Element | undefined = $state()
  let scale = $state(0.1)
  let height = $state(0)

  const copy = () => clip(code)

  $effect(() => {
    if (canvas && wrapper && code) {
      QRCode.toCanvas(canvas, code)
    }
  })

  $effect(() => {
    // Draw first so canvas.width/height reflect the current code, then fit the
    // intrinsic canvas size to the wrapper. Measure the intrinsic size (not
    // getBoundingClientRect, which includes the transform below) so this stays
    // idempotent — otherwise scale feeds back into its own measurement and loops.
    if (canvas && wrapper && code) {
      const wrapperRect = wrapper.getBoundingClientRect()

      scale = wrapperRect.width / canvas.width
      height = canvas.height * scale
    }
  })
</script>

<Button class="flex w-full justify-center {props.class}" onclick={copy}>
  <div bind:this={wrapper} class="w-md" style={`height: ${height}px`}>
    <canvas
      class="rounded-2xl"
      bind:this={canvas}
      style={`transform-origin: top left; transform: scale(${scale}, ${scale})`}>
    </canvas>
  </div>
</Button>
