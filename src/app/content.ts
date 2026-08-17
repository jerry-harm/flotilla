import {
  CLASSIFIED,
  COMMENT,
  DELETE,
  DIRECT_MESSAGE,
  DIRECT_MESSAGE_FILE,
  EVENT_TIME,
  GENERIC_REPOST,
  PINBOARD,
  LONG_FORM,
  POLL,
  REACTION,
  REPORT,
  REPOST,
  THREAD,
  ZAP_GOAL,
  ZAP_RECEIPT,
} from "@welshman/util"
import type {Filter} from "@welshman/util"
import {ENABLE_ZAPS} from "@app/env"
export const IMAGE_CONTENT_TYPES = ["image/jpeg", "image/png", "image/gif", "image/webp"]

export const VIDEO_CONTENT_TYPES = ["video/quicktime", "video/webm", "video/mp4"]

export const makeCommentFilter = (kinds: number[], extra: Filter = {}) => ({
  kinds: [COMMENT],
  "#K": kinds.map(String),
  ...extra,
})

export const makeDeleteFilter = (kinds: number[], extra: Filter = {}) => ({
  kinds: [DELETE],
  "#k": kinds.map(String),
  ...extra,
})

export const REPOST_KINDS = [REPOST, GENERIC_REPOST]

export const REACTION_KINDS = [REPORT, DELETE, REACTION]

if (ENABLE_ZAPS) {
  REACTION_KINDS.push(ZAP_RECEIPT)
}

export const CONTENT_KINDS = [ZAP_GOAL, EVENT_TIME, THREAD, CLASSIFIED, POLL, PINBOARD, LONG_FORM]

export const DM_KINDS = [DIRECT_MESSAGE, DIRECT_MESSAGE_FILE]

export const displayReaction = (content: string) => {
  if (!content || content === "+") return "❤️"
  if (content === "-") return "👎"
  return content
}
