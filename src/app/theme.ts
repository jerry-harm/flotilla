import twColors from "tailwindcss/colors"
import {derived, readable} from "svelte/store"
import {synced} from "@welshman/store"
import {FL_THEME} from "@app/env"
import {kv} from "@app/storage"

export const colors = [
  ["amber", twColors.amber[600]],
  ["blue", twColors.blue[600]],
  ["cyan", twColors.cyan[600]],
  ["emerald", twColors.emerald[600]],
  ["fuchsia", twColors.fuchsia[600]],
  ["green", twColors.green[600]],
  ["indigo", twColors.indigo[600]],
  ["sky", twColors.sky[600]],
  ["lime", twColors.lime[600]],
  ["orange", twColors.orange[600]],
  ["pink", twColors.pink[600]],
  ["purple", twColors.purple[600]],
  ["red", twColors.red[600]],
  ["rose", twColors.rose[600]],
  ["sky", twColors.sky[600]],
  ["teal", twColors.teal[600]],
  ["violet", twColors.violet[600]],
  ["yellow", twColors.yellow[600]],
  ["zinc", twColors.zinc[600]],
]

// Every theme with token values in lib/components/theme.css
export const flThemes = ["clay", "flat", "navy"]

export const flTheme = synced({
  key: "flTheme",
  defaultValue: FL_THEME,
  storage: kv,
})

export const theme = synced({
  key: "theme",
  defaultValue: "system",
  storage: kv,
})

const prefersDark = readable(window.matchMedia("(prefers-color-scheme: dark)").matches, set => {
  const query = window.matchMedia("(prefers-color-scheme: dark)")
  const onChange = () => set(query.matches)

  query.addEventListener("change", onChange)

  return () => query.removeEventListener("change", onChange)
})

// What actually gets stamped on the document, since `theme` may defer to the os
export const activeTheme = derived([theme, prefersDark], ([$theme, $prefersDark]) => {
  if ($theme === "system") {
    return $prefersDark ? "dark" : "light"
  }

  return $theme
})
