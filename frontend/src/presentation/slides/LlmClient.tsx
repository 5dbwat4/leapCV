import { Braces, RotateCcw } from "lucide-react"

import { Card, Reveal, SlideFrame, SlideTitle } from "@/presentation/ui"
import { cn } from "@/lib/utils"

const RETRY_PLANS = [
  {
    no: "1",
    title: "json_object 模式 + 关闭思维链",
    detail: "优先结构化输出；Qwen3 等思维模型先尝试 chat_template_kwargs 关闭思考，端点不支持则下一级自动去掉",
  },
  {
    no: "2",
    title: "解除 json_mode 约束",
    detail: "部分兼容端点对 response_format 支持不佳，宽松输出反而更容易拿到合法 JSON",
  },
  {
    no: "3",
    title: "json_object + 双倍 token 预算",
    detail: "输出被截断（finish_reason=length）时加倍 max_tokens 重试，专治长 JSON 被腰斩",
  },
]

const JSON_STEPS = ["剥离 <think>…</think> 思维标签", "剥离 ```json 代码围栏", "截取首个 { 到最后一个 }", "json.loads 解析，失败抛出可读错误"]

/** 关键技术 ①：LLM 可靠调用（对应 backend/app/services/llm.py）。 */
export default function LlmClient({ step }: { step: number }) {
  return (
    <SlideFrame>
      <SlideTitle
        kicker="03 关键技术实现 ①"
        title="LLM 可靠调用：三级重试梯度 + JSON 容错提取"
        subtitle="真实厂商接口并不总是听话 —— 把「不稳定」当成常态来设计"
      />

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-8">
        <Reveal at={0} step={step} className="flex flex-col gap-3">
          {RETRY_PLANS.map((p, i) => (
            <Card key={p.no} className="flex flex-1 items-start gap-4 px-6 py-4">
              <span
                className={cn(
                  "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full font-mono text-[14px] font-bold text-white",
                  i === 2 ? "bg-indigo-600" : "bg-slate-800",
                )}
              >
                {p.no}
              </span>
              <div>
                <p className="text-[16.5px] font-bold text-slate-900">{p.title}</p>
                <p className="mt-1 text-[13.5px] leading-relaxed text-slate-500">{p.detail}</p>
              </div>
              {i < 2 && <span className="ml-auto self-center text-slate-300">↓ 失败降级</span>}
            </Card>
          ))}
          <p className="flex items-center gap-2 text-[13.5px] text-slate-400">
            <RotateCcw className="size-4" />
            全部失败才把可读错误抛给用户；单次超时 120s，openai SDK 层再兜底重试 1 次
          </p>
        </Reveal>

        <Reveal at={1} step={step} className="flex flex-col">
          <Card className="flex-1 px-6 py-5">
            <div className="flex items-center gap-2.5">
              <Braces className="size-5 text-indigo-600" />
              <p className="text-[17px] font-bold text-slate-900">_extract_json：四步容错提取</p>
            </div>
            <div className="mt-4 flex flex-col">
              {JSON_STEPS.map((s, i) => (
                <div key={s} className={`flex items-center gap-3 py-2.5 ${i > 0 ? "border-t border-slate-100" : ""}`}>
                  <span className="font-mono text-[12px] text-indigo-500">0{i + 1}</span>
                  <p className="text-[15px] text-slate-600">{s}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-[13.5px] leading-relaxed text-slate-500">
              兼容 <span className="font-semibold text-slate-800">OpenAI 兼容协议</span>：
              base_url + model 各一行即可切换智谱 GLM / DeepSeek / Kimi / OpenAI；
              trust_env=False 绕过系统代理，避免本地网关 502。
            </div>
          </Card>
        </Reveal>
      </div>
    </SlideFrame>
  )
}
