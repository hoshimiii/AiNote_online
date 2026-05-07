import { useEffect, useRef, useState } from "react";
import { useChatbot } from "@/store/Chatbot";
import type { Message } from "@/store/Chatbot";
import ReactMarkdown from "react-markdown";
import { Send, Loader2, User, Bot, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";

import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

const traceHint = (body: string) => {
    const one = body.replace(/\s+/g, " ").trim();
    if (!one) return "";
    return one.length > 36 ? `${one.slice(0, 36)}…` : one;
};

function CollapsibleTraceBlock({
    message,
    maxWClass,
}: {
    message: Message;
    maxWClass: string;
}) {
    const [open, setOpen] = useState(false);
    const raw = message.messageContent.replace(/\\n/g, "\n");
    const nl = raw.indexOf("\n");
    const titleLine = nl === -1 ? raw.replace(/^###\s*/, "").trim() : raw.slice(4, nl).trim();
    const body = nl === -1 ? "" : raw.slice(nl + 1);

    return (
        <div
            className={cn(
                maxWClass,
                "overflow-hidden rounded-xl border border-amber-200 bg-amber-50/90 text-sm shadow-sm"
            )}
        >
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left hover:bg-amber-100/60"
            >
                <ChevronRight
                    className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")}
                />
                <span className="min-w-0 truncate text-xs font-medium text-foreground">{titleLine}</span>
                {!open && body ? (
                    <span className="min-w-0 truncate text-xs text-muted-foreground">· {traceHint(body)}</span>
                ) : null}
            </button>
            {open ? (
                <div className="max-h-64 overflow-y-auto border-t border-amber-200/70 px-2.5 py-2 text-xs leading-relaxed [&_.katex-display]:max-w-full [&_.katex-display]:overflow-x-auto">
                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                        {body}
                    </ReactMarkdown>
                </div>
            ) : null}
        </div>
    );
}

interface ChatPanelProps {
    activeChatbotId: string;
    FloatMode: string | number;
}

export function ChatPanel({ FloatMode }: ChatPanelProps) {
    // useChat 会自动处理消息状态、输入框状态、以及流式请求
    const { messages, input, handleInputChange, handleSubmit, isLoading } = useChatbot();
    const scrollRef = useRef<HTMLDivElement>(null);
    // 自动滚动逻辑：每当有新消息（包括流式输出的字）时，滚动到底部
    useEffect(() => {
        if (scrollRef.current) {
            const scrollElement = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
            if (scrollElement) {
                scrollElement.scrollTop = scrollElement.scrollHeight;
            }
        }
    }, [messages]);

    return (
        <div className="flex h-full min-h-0 flex-col bg-background">
            {/* 1. 消息滚动区域 */}
            <ScrollArea ref={scrollRef} className="min-h-0 flex-1 p-4">
                {messages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-2 opacity-50 mt-20">
                        <Bot size={40} />
                        <p className="text-sm">我是你的看板助手，有什么可以帮你的吗？</p>
                    </div>
                )}

                {messages.map((m) => {
                    const maxW = FloatMode !== 2 ? "max-w-[300px]" : "max-w-[500px]";
                    if (m.role === "assistant" && m.tracePhase) {
                        return (
                            <div key={m.messageId} className="mb-3 flex flex-row gap-3">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border bg-muted">
                                    <Bot size={16} />
                                </div>
                                <CollapsibleTraceBlock message={m} maxWClass={maxW} />
                            </div>
                        );
                    }
                    return (
                        <div
                            key={m.messageId}
                            className={cn(
                                "mb-6 flex gap-3",
                                m.role === "user" ? "flex-row-reverse" : "flex-row"
                            )}
                        >
                            <div
                                className={cn(
                                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
                                    m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted border"
                                )}
                            >
                                {m.role === "user" ? <User size={16} /> : <Bot size={16} />}
                            </div>

                            <div
                                className={cn(
                                    maxW,
                                    "rounded-2xl px-3 py-2 text-sm leading-relaxed shadow-sm",
                                    m.role === "user"
                                        ? "rounded-tr-none bg-gray-200 text-foreground"
                                        : m.role === "assistant"
                                          ? "rounded-tl-none border border-amber-200 bg-amber-50 text-foreground"
                                          : "rounded-tl-none border bg-blue-100 text-foreground"
                                )}
                            >
                                <div className="min-w-0 whitespace-pre-wrap [&_.katex-display]:max-w-full [&_.katex-display]:overflow-x-auto [&_.katex-display]:overflow-y-hidden">
                                    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                                        {isLoading && (m.role === "assistant" || m.role === "chatbot") && !m.messageContent
                                            ? "正在思考..."
                                            : m.messageContent.replace(/\\n/g, "\n")}
                                    </ReactMarkdown>
                                </div>
                            </div>
                        </div>
                    );
                })}

                {/* AI 正在输入的 Loading 状态 */}
                {/* {&& (
                    <div className="flex gap-3 mb-6">
                        <div className="w-8 h-8 rounded-full bg-muted border flex items-center justify-center">
                            
                        </div>
                        <div className="bg-muted/50 rounded-2xl px-4 py-2 text-sm animate-pulse">
                            正在思考...
                        </div>
                    </div>
                )} */}
            </ScrollArea>

            {/* 2. 输入区域 */}
            <div className="shrink-0 border-t bg-background p-4">
                <form
                    onSubmit={(e) => handleSubmit(e, input)}
                    className="relative flex items-center gap-2">
                    <textarea
                        rows={1}
                        value={input}
                        onChange={handleInputChange}
                        placeholder="输入消息..."
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                handleSubmit(e, input);
                            }
                        }}
                        className="flex-1 min-h-[40px] max-h-32 p-3 bg-muted/50 border rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 text-sm transition-all"
                    />
                    <Button
                        type="submit"
                        size="icon"

                        disabled={isLoading || !input.trim()}
                        className="shrink-0 rounded-xl text-gray-900"
                    >
                        {isLoading ? <Loader2 className="animate-spin" /> : <Send size={18} />}
                    </Button>
                </form>
                <p className="text-[10px] text-center text-muted-foreground mt-2">
                    AI 可能生成错误信息，请核实重要事项。
                </p>
            </div>
        </div>
    );
}