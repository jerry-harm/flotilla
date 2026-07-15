import theme from "tailwindcss/defaultTheme"
import {readable} from "svelte/store"
import type {Readable} from "svelte/store"

export const matchWidth = (query: string): Readable<boolean> =>
  readable(typeof window !== "undefined" && window.matchMedia(query).matches, set => {
    const mq = window.matchMedia(query)

    const onChange = () => set(mq.matches)

    onChange()
    mq.addEventListener("change", onChange)

    return () => mq.removeEventListener("change", onChange)
  })

export const matchMd = matchWidth(`(min-width: ${theme.screens.md})`)
