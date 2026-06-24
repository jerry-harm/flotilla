/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{html,js,svelte,ts}"],
  darkMode: ["selector", '[data-theme="dark"]'],
  // dynamic socket-status classes (bg-{$status.theme}) the scanner can't see
  safelist: ["w-4", "h-4", "bg-success", "bg-warning", "bg-error", "bg-gray-500"],
  theme: {
    zIndex: {
      none: 0,
      "nav-active": 1,
      "nav-item": 2,
      feature: 3,
      compose: 4,
      nav: 5,
      popover: 6,
      modal: 7,
      tooltip: 8,
      toast: 9,
    },
  },
  plugins: [],
}
