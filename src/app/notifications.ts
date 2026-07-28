import {derived, get, writable} from "svelte/store"
import {Badge} from "@capawesome/capacitor-badge"
import {page} from "$app/stores"
import {assoc, prop, first, identity, groupBy, now, throttle, parseJson, gt} from "@welshman/lib"
import type {SignedEvent, TrustedEvent} from "@welshman/util"
import {
  sortEventsDesc,
  tagSpec,
  tagValue,
  MESSAGE,
  makeHttpAuth,
  makeHttpAuthHeader,
} from "@welshman/util"
import {synced, throttled, withGetter} from "@welshman/store"
import {Relays, RoomLists} from "@welshman/app"
import {deriveEventsByIdByUrl} from "@app/repository"
import {app, fromApp} from "@app/core"
import {makeSpacePath, makeRoomPath, makeSpaceChatPath, makeChatPath} from "@app/routes"
import {CONTENT_KINDS, makeCommentFilter} from "@app/content"
import {notificationSettings} from "@app/settings"
import {chatsById} from "@app/chats"
import {dufflepud, DUFFLEPUD_URL, PLATFORM_RELAYS} from "@app/env"
import {kv} from "@app/storage"

// Checked state

export const checked = withGetter(
  synced<Record<string, number>>({
    key: "checked",
    defaultValue: {},
    storage: kv,
  }),
)

export const getChecked = (key: string) => checked.get()[key]

export const deriveChecked = (key: string) => derived(checked, prop<number>(key))

export const setChecked = (key: string) => checked.update(assoc(key, now()))

/** Room path while video call UI hides chat; checked + badge stay active until chat is shown. */
export const deferredRoomPath = writable<string | undefined>(undefined)

export const syncChecked = () => {
  let prev = ""

  const getPaths = (path: string) =>
    path
      .split("/")
      .map((_, i, segments) => segments.slice(0, i + 1).join("/"))
      .slice(1)

  return page.subscribe($page => {
    // Set checked when we leave a given page
    checked.update($checked => {
      for (const path of getPaths(prev)) {
        $checked[path] = now()
      }

      return $checked
    })

    // Set checked when we visit a given page - but delay it a tad
    setTimeout(() => {
      const defer = get(deferredRoomPath)

      checked.update($checked => {
        for (const path of getPaths($page.url.pathname)) {
          if (defer && path === defer) continue
          $checked[path] = now()
        }

        return $checked
      })
    }, 300)

    prev = $page.url.pathname
  })
}

const CHECKED_KV_KEY = "checked"
const NIP98_MAX_AGE = 23 * 60 * 60

let nip98Auth: SignedEvent | undefined

const nip98Header = async () => {
  const $signer = app.get().user?.signer

  if (!$signer) {
    return undefined
  }

  if (!nip98Auth || now() - nip98Auth.created_at > NIP98_MAX_AGE) {
    nip98Auth = await $signer.sign(await makeHttpAuth(DUFFLEPUD_URL, "GET"))
  }

  return makeHttpAuthHeader(nip98Auth)
}

const pullCheckedRemote = async () => {
  const authorization = await nip98Header()

  if (!authorization) {
    return
  }

  const res = await fetch(dufflepud(`kv/${CHECKED_KV_KEY}`), {headers: {authorization}})

  if (!res.ok) {
    return
  }

  const remote = parseJson<Record<string, number>>(await res.text())

  if (!remote) {
    return
  }

  checked.update($checked => {
    for (const [path, ts] of Object.entries(remote)) {
      if (gt(ts, $checked[path])) {
        $checked[path] = ts
      }
    }

    return $checked
  })
}

const pushCheckedRemote = throttle(3000, async () => {
  const authorization = await nip98Header()

  if (!authorization) {
    return
  }

  try {
    await fetch(dufflepud(`kv/${CHECKED_KV_KEY}`), {
      method: "POST",
      headers: {authorization},
      body: JSON.stringify(checked.get()),
    })
  } catch {
    // pass
  }
})

export const syncCheckedRemote = () => {
  let ready = false

  const unsubscribeUser = app.subscribe($app => {
    ready = false
    nip98Auth = undefined

    if ($app.user) {
      pullCheckedRemote().then(() => {
        ready = true
        pushCheckedRemote()
      })
    }
  })

  const unsubscribeChecked = checked.subscribe(() => {
    if (ready && app.get().user?.pubkey) {
      pushCheckedRemote()
    }
  })

  return () => {
    unsubscribeUser()
    unsubscribeChecked()
  }
}

// Derived notifications state

export const allNotifications = derived(
  throttled(
    1000,
    derived(
      [
        app,
        checked,
        chatsById,
        fromApp($app => $app.use(Relays).index.$),
        fromApp($app => $app.use(RoomLists).index.$),
        deriveEventsByIdByUrl([
          {kinds: [MESSAGE, ...CONTENT_KINDS]},
          makeCommentFilter(CONTENT_KINDS),
        ]),
      ],
      identity,
    ),
  ),
  ([$app, $checked, $chatsById, $relays, $roomLists, eventsByIdByUrl]) => {
    const hasNotification = (path: string, latestEvent?: TrustedEvent) => {
      if (!latestEvent || latestEvent.pubkey === $app.user?.pubkey) {
        return false
      }

      for (const [entryPath, ts] of Object.entries($checked)) {
        const isMatch =
          entryPath === "*" ||
          entryPath.startsWith(path) ||
          (entryPath === "/chat/*" && path.startsWith("/chat/"))

        if (isMatch && ts > latestEvent.created_at) {
          return false
        }
      }

      return true
    }

    const paths = new Set<string>()

    for (const {pubkeys, messages} of $chatsById.values()) {
      const chatPath = makeChatPath(pubkeys)

      if (hasNotification(chatPath, messages[0])) {
        paths.add("/chat")
        paths.add(chatPath)
      }
    }

    const roomList = $app.user?.pubkey ? $roomLists.get($app.user?.pubkey) : undefined
    const urls = PLATFORM_RELAYS.length > 0 ? PLATFORM_RELAYS : (roomList?.urls() ?? [])

    for (const url of urls) {
      const spacePath = makeSpacePath(url)
      const events = sortEventsDesc((eventsByIdByUrl.get(url) || new Map()).values())

      if ($relays.get(url)?.hasNip(29)) {
        for (const [h, [latestEvent]] of groupBy(e => tagValue(tagSpec("h"), e.tags), events)) {
          if (h) {
            const roomPath = makeRoomPath(url, h)

            if (hasNotification(roomPath, latestEvent)) {
              paths.add(roomPath)

              if (hasNotification(spacePath, latestEvent)) {
                paths.add(spacePath)
              }
            }
          }
        }
      } else {
        const messagesPath = makeSpaceChatPath(url)
        const latestEvent = first(events)

        if (hasNotification(messagesPath, latestEvent)) {
          paths.add(messagesPath)

          if (hasNotification(spacePath, latestEvent)) {
            paths.add(spacePath)
          }
        }
      }
    }

    return paths
  },
)

export const notifications = derived(
  [page, allNotifications, deferredRoomPath],
  ([$page, $allNotifications, $deferredRoomPath]) =>
    new Set(
      [...$allNotifications].filter(p => {
        if (!$page.url.pathname.startsWith(p)) return true
        if ($deferredRoomPath && p === $deferredRoomPath) return true
        return false
      }),
    ),
)

// Badges

export const syncBadges = () =>
  derived([notifications, notificationSettings], identity).subscribe(
    async ([$notifications, $notificationSettings]) => {
      if ($notificationSettings.badge) {
        try {
          await Badge.set({count: $notifications.size})
        } catch (err) {
          // pass - firefox doesn't support badges
        }
      } else {
        await clearBadges()
      }
    },
  )

export const clearBadges = async () => {
  try {
    await Badge.clear()
  } catch (e) {
    // pass - firefox doesn't support this
  }
}
