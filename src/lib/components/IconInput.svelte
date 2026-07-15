<script lang="ts">
  import StickerSmileSquare from "@assets/icons/sticker-smile-square.svg?dataurl"
  import UploadMinimalistic from "@assets/icons/upload-minimalistic.svg?dataurl"
  import Icon from "@lib/components/Icon.svelte"
  import ImageIcon from "@lib/components/ImageIcon.svelte"
  import IconPickerButton from "@lib/components/IconPickerButton.svelte"

  type Props = {
    // The parent uploads this on submit — never `preview`, which may be a data: URL.
    file?: File | undefined
    // An existing hosted URL, or the data: URL of a freshly picked image.
    preview?: string | undefined
    previewClass?: string
  }

  let {file = $bindable(), preview = $bindable(), previewClass = ""}: Props = $props()

  // Decode a built-in icon's base64 SVG data: URL into a File so it uploads on
  // submit like any image.
  const handleIconSelect = (iconUrl: string) => {
    preview = iconUrl

    const parts = iconUrl.split(",")
    const imageData = atob(parts[1])
    const bytes = new Uint8Array(imageData.length)

    for (let n = 0; n < imageData.length; n++) {
      bytes[n] = imageData.charCodeAt(n)
    }

    file = new File([bytes], "icon.svg", {type: "image/svg+xml"})
  }

  const handleImageUpload = (event: Event) => {
    const selected = (event.target as HTMLInputElement).files?.[0]

    if (selected && selected.type.startsWith("image/")) {
      const reader = new FileReader()

      reader.onload = e => {
        file = selected
        preview = e.target?.result as string
      }

      reader.readAsDataURL(selected)
    }
  }
</script>

<div class="flex grow items-center justify-between gap-4">
  {#if preview}
    <div class="flex items-center gap-2">
      <span class="text-sm opacity-75">Selected:</span>
      <ImageIcon src={preview} alt="" class={previewClass} />
    </div>
  {:else}
    <span class="text-sm opacity-75">No icon selected</span>
  {/if}
  <div class="flex gap-2">
    <IconPickerButton onSelect={handleIconSelect} class="button button-primary button-sm">
      <Icon icon={StickerSmileSquare} size={4} />
    </IconPickerButton>
    <label class="button button-neutral button-sm cursor-pointer">
      <Icon icon={UploadMinimalistic} size={4} />
      <input type="file" accept="image/*" class="hidden" onchange={handleImageUpload} />
    </label>
  </div>
</div>
