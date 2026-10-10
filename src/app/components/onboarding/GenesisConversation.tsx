import { useEffect, useRef, useState } from "react";
import { ChevronDown, MessageSquare, Sparkles } from "lucide-react";
import type { GenesisTool } from "../../domain/sparkExperience";

export interface GenesisMessage {
  id: number;
  role: "user" | "spark";
  text: string;
  tool?: GenesisTool;
  complete?: boolean;
  summary?: string;
}
export const TOOL_LABELS: Record<GenesisTool, string> = {
  purpose: "Your Spark",
  identity: "Identity & purpose",
  connect: "Connected accounts",
  format: "Format & visual language",
  character: "Characters & settings",
  voice: "Voice",
  preferences: "Operating preferences",
  review: "Your Spark, together",
};

/** One timeline and one composer. Controls belong to the assistant message. */
export function GenesisConversation({
  messages,
  thinking,
  activeTool,
  renderTool,
  composer,
  canConfirm,
  onConfirm,
  onSkip,
  onEdit,
  onFinish,
  onCancel,
}: {
  messages: GenesisMessage[];
  thinking: boolean;
  activeTool: GenesisTool;
  renderTool: () => React.ReactNode;
  composer: React.ReactNode;
  canConfirm: boolean;
  onConfirm: () => void;
  onSkip: () => void;
  onEdit: (tool: GenesisTool) => void;
  onFinish: () => void;
  onCancel?: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const nearBottom = useRef(true);
  const [hasNew, setHasNew] = useState(false);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (nearBottom.current)
      endRef.current?.scrollIntoView({ block: "end", behavior: "auto" });
    else setHasNew(true);
  }, [messages, thinking]);
  const activeId = [...messages]
    .reverse()
    .find((m) => m.tool && !m.complete)?.id;
  return (
    <div className="genesis-conversation relative z-10 w-full max-w-[680px] h-full flex flex-col min-h-0">
      <header className="flex items-center justify-between px-5 sm:px-8 py-5 shrink-0 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-purple-500/10 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-purple-300" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white">Super Spark</h1>
            <p className="text-[11px] text-white/40 mt-0.5">
              Your creative director · Setting up your Spark
            </p>
          </div>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-xs text-white/50 hover:text-white min-h-11 px-2"
          >
            Save & exit
          </button>
        )}
      </header>
      <div
        ref={scrollRef}
        onScroll={() => {
          const node = scrollRef.current;
          nearBottom.current =
            !node ||
            node.scrollHeight - node.scrollTop - node.clientHeight < 90;
          if (nearBottom.current) setHasNew(false);
        }}
        className="flex-1 overflow-y-auto min-h-0 px-5 sm:px-8 pt-7 pb-5 space-y-6"
        role="log"
        aria-label="Setup conversation"
        aria-live="polite"
        aria-relevant="additions text"
      >
        <p className="text-[10px] text-white/25 text-center tracking-wide">
          A conversation, not a form. Ask, choose, or change your mind.
        </p>
        {messages.map((message) => (
          <article
            key={message.id}
            className={
              message.role === "user" ? "flex justify-end" : "space-y-3"
            }
          >
            <div
              className={
                message.role === "user"
                  ? "max-w-[88%] rounded-2xl rounded-br-md px-4 py-3 bg-purple-600/20 border border-purple-400/15 text-white/90"
                  : "text-white/80"
              }
            >
              {message.role === "spark" && (
                <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-purple-300/65 mb-2">
                  Super Spark
                </p>
              )}
              <p className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
                {message.text}
              </p>
            </div>
            {message.tool && message.complete && (
              <div className="flex gap-3 rounded-2xl bg-white/[0.035] px-4 py-3 border border-white/5">
                <MessageSquare className="w-4 h-4 text-white/30 shrink-0 mt-1" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-white/70 font-medium">
                    {TOOL_LABELS[message.tool]}
                  </p>
                  <p className="text-xs text-white/40 leading-relaxed mt-1 break-words">
                    {message.summary || "Previous choices · review or edit"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onEdit(message.tool!)}
                  disabled={thinking}
                  className="text-xs text-purple-300 min-h-11 px-2 disabled:opacity-40"
                >
                  Edit
                </button>
              </div>
            )}
            {message.id === activeId && message.tool && (
              <div className="rounded-3xl bg-white/[0.035] border border-white/[0.07] p-4 sm:p-5 space-y-5">
                <div className="flex items-center gap-2 text-xs text-white/45">
                  <MessageSquare className="w-3.5 h-3.5" />
                  {TOOL_LABELS[activeTool]}
                </div>
                {renderTool()}
                {activeTool !== "purpose" && activeTool !== "review" && (
                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={onConfirm}
                      disabled={!canConfirm || thinking}
                      className="genesis-primary rounded-full px-5 py-3 bg-purple-600 text-white text-xs font-semibold disabled:opacity-30"
                    >
                      Use these choices
                    </button>
                    <button
                      type="button"
                      onClick={onSkip}
                      disabled={thinking}
                      className="text-xs text-white/45 hover:text-white px-3 min-h-11 disabled:opacity-30"
                    >
                      Set up later
                    </button>
                  </div>
                )}
                {activeTool === "review" && (
                  <>
                    <p className="text-xs text-white/40 leading-relaxed">
                      This saves your Spark. It does not publish, authorize a
                      platform or start paid generation. Missing assets and
                      permissions can be completed later.
                    </p>
                    <button
                      type="button"
                      disabled={!canConfirm || thinking}
                      onClick={onFinish}
                      className="genesis-primary w-full rounded-full py-3.5 bg-purple-600 text-white text-sm font-semibold disabled:opacity-30"
                    >
                      Review agreements & open My Spark
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing((v) => !v)}
                      className="text-xs text-purple-300 min-h-11"
                    >
                      Change something
                    </button>
                    {editing && (
                      <div className="flex flex-wrap gap-2">
                        {(Object.keys(TOOL_LABELS) as GenesisTool[])
                          .filter((t) => t !== "review")
                          .map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => onEdit(t)}
                              className="rounded-full px-3 py-2 border border-white/10 text-white/60 text-xs"
                            >
                              {TOOL_LABELS[t]}
                            </button>
                          ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </article>
        ))}
        {thinking && (
          <p role="status" className="text-xs text-purple-300/60 animate-pulse">
            Spark is thinking…
          </p>
        )}
        <div ref={endRef} />
      </div>
      {hasNew && (
        <button
          type="button"
          onClick={() => {
            endRef.current?.scrollIntoView({ block: "end" });
            nearBottom.current = true;
            setHasNew(false);
          }}
          className="self-center flex items-center gap-2 px-3 py-2 rounded-full bg-purple-600 text-white text-xs mb-2"
        >
          New messages
          <ChevronDown className="w-3 h-3" />
        </button>
      )}
      <footer className="shrink-0 px-5 sm:px-8 pt-3 pb-5 border-t border-white/5 bg-[#0B0F17]">
        {composer}
        <p className="text-[10px] text-white/25 text-center mt-2">
          Tools appear when needed. You remain in control.
        </p>
      </footer>
    </div>
  );
}
