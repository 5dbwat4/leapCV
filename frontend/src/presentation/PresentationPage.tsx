import DeckPlayer from "@/presentation/player/DeckPlayer"
import { buildDeck } from "@/presentation/deck"

/**
 * /presentation —— 独立的课程汇报幻灯片路由。
 *
 * 刻意不接入 RequireAuth / Navbar / 全站 Footer：不提供任何从站内其他页面
 * 进入的入口，只能通过直接输入 URL 访问，保证演示视图与产品视图完全隔离。
 */
export default function PresentationPage() {
  return <DeckPlayer slides={buildDeck()} />
}
