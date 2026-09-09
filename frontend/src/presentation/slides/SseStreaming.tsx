import { Reveal, SlideFrame, SlideTitle } from "@/presentation/ui"

const FLOW = [
  {
    name: "管线线程",
    detail: "run_pipeline 边执行边 emit(event, payload)，事件写入 queue.Queue",
    tag: "producer",
  },
  {
    name: "SSE 生成器",
    detail: "event_stream() 从队列逐条取出，序列化为 event:/data: 帧",
    tag: "bridge",
  },
  {
    name: "StreamingResponse",
    detail: "text/event-stream + no-cache，Nginx 关闭缓冲（X-Accel-Buffering: no）",
    tag: "transport",
  },
  {
    name: "前端 Reader",
    detail: "fetch body.getReader() 逐帧解析，按事件名分发到进度条 / 剧场动画",
    tag: "consumer",
  },
]

/** 关键技术 ③：SSE 流式管线（对应 backend/app/routers/optimize_router.py）。 */
export default function SseStreaming({ step }: { step: number }) {
  return (
    <SlideFrame>
      <SlideTitle
        kicker="03 关键技术实现 ③"
        title="SSE 流式管线：一次请求，全程直播"
        subtitle="五阶段几十秒的等待，被拆解成秒级到达的实时反馈"
      />

      <div className="flex items-stretch gap-2">
        {FLOW.map((f, i) => (
          <div key={f.name} className="flex min-w-0 flex-1 items-stretch">
            <Reveal at={0} step={step} className="flex min-w-0 flex-1">
              <div className="flex min-w-0 flex-1 flex-col rounded-2xl border border-slate-200/80 bg-white px-5 py-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_20px_rgba(15,23,42,0.05)]">
                <p className="font-mono text-[11.5px] uppercase tracking-widest text-indigo-400">{f.tag}</p>
                <p className="mt-1.5 text-[17px] font-bold text-slate-900">{f.name}</p>
                <p className="mt-2 text-[13.5px] leading-relaxed text-slate-500">{f.detail}</p>
              </div>
            </Reveal>
            {i < FLOW.length - 1 && (
              <div className="flex items-center px-0.5">
                <span className="text-[16px] font-bold text-indigo-300">→</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-8 pt-7">
        <Reveal at={1} step={step}>
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50 px-6 py-5">
            <p className="text-[16.5px] font-bold text-slate-900">中间事件「原样转发」</p>
            <p className="mt-2 text-[14.5px] leading-relaxed text-slate-600">
              事件名即前端契约：progress / score / skill / issue / question / rewrite…
              服务层不感知 HTTP，SSE 层只做透明桥接 —— 管线与传输彻底解耦。
            </p>
          </div>
        </Reveal>
        <Reveal at={2} step={step}>
          <div className="rounded-2xl border border-slate-200/80 bg-slate-50 px-6 py-5">
            <p className="text-[16.5px] font-bold text-slate-900">流式响应里的两个坑</p>
            <p className="mt-2 text-[14.5px] leading-relaxed text-slate-600">
              落库改用独立 <span className="font-mono text-[13.5px]">SessionLocal()</span>
              （请求级 session 在流期间不可依赖）；finally 中注销问答门并 cancel，
              客户端断开时管线线程不会永久阻塞。
            </p>
          </div>
        </Reveal>
      </div>
    </SlideFrame>
  )
}
