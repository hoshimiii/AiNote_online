"use client";
import { useState, useEffect } from "react";
import { MessageCircle, X, Minimize2, Maximize2, ChevronDown, RotateCcw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { ChatPanel } from "@/components/ChatBot/ChatPanel"; // 刚才写的面板逻辑
import { cn } from "@/lib/utils";
import { useChatbot } from "@/store/Chatbot";
import { createPortal } from "react-dom";

export function ChatController() {
    const { chatbotId, resetChatbot, isLoading } = useChatbot();
    const [isOpen, setIsOpen] = useState(false);
    const [FloatMode, setIsFloating] = useState(0); // 切换模式的状态 0 1 2 0作为右下角浮动，1作为侧边栏，2作为底部对话框形式（防止遮挡）
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;

    return createPortal(
        <>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="fixed bottom-6 right-6 z-50 rounded-full bg-primary p-4 text-gray-900 shadow-2xl transition-transform hover:scale-110"
            >
                {isOpen ? <X /> : <MessageCircle />}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        className={cn(
                            "fixed bottom-24 right-6 z-40 flex flex-col overflow-hidden border bg-background shadow-2xl transition-all duration-300",
                            FloatMode === 0
                                ? "h-[600px] w-[400px] rounded-2xl"
                                : FloatMode === 1
                                    ? "h-[720px] w-[480px] rounded-2xl"
                                    : "h-[420px] w-[min(720px,calc(100vw-3rem))] rounded-2xl"
                        )}
                    >
                        <div className="flex items-center justify-between border-b bg-muted/30 p-3">
                            <span className="font-bold text-sm">小ai同学</span>
                            <button onClick={resetChatbot} disabled={isLoading} className="ml-auto rounded p-1 hover:bg-accent disabled:opacity-50" title="重置对话">
                                <RotateCcw size={16} />
                            </button>
                            <button onClick={() => setIsFloating(FloatMode === 2 ? 0 : 2)} className="rounded p-1 hover:bg-accent" title={FloatMode === 2 ? "返回浮窗" : "切换至紧凑模式"}>
                                <ChevronDown size={16} />
                            </button>
                            <button onClick={() => setIsFloating(FloatMode === 0 ? 1 : 0)} className="rounded p-1 hover:bg-accent" title={FloatMode === 0 ? "放大面板" : "返回浮窗"}>
                                {FloatMode !== 1 ? <Maximize2 size={16} /> : <Minimize2 size={16} />}
                            </button>
                        </div>

                        <ChatPanel activeChatbotId={chatbotId} FloatMode={FloatMode} />
                    </motion.div>
                )}
            </AnimatePresence>
        </>,
        document.body
    );
}