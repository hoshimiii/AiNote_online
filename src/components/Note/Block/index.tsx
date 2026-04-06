import { type Block as BlockType } from "@/store/kanban";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import { useState, useEffect, useRef, useMemo, type ClipboardEvent } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { cpp } from "@codemirror/lang-cpp";
import { java } from "@codemirror/lang-java";
import type { Extension } from "@codemirror/state";
import { Divide } from "lucide-react";

const SUPPORTED_LANGUAGES = [
    { value: "javascript", label: "JavaScript" },
    { value: "typescript", label: "TypeScript" },
    // { value: "python", label: "Python" },
    // { value: "cpp", label: "C++" },
    // { value: "java", label: "Java" },
] as const;

function getLanguageExtension(lang?: string): Extension[] {
    switch (lang) {
        case "javascript": return [javascript()];
        case "typescript": return [javascript({ typescript: true })];
        case "python": return [python()];
        case "cpp": return [cpp()];
        case "java": return [java()];
        default: return [javascript()];
    }
}

const CodeToolbar = ({
    block,
    isRunning,
    onUpdateBlock,
    onExecute,
}: {
    block: BlockType;
    isRunning: boolean;
    onUpdateBlock?: (updates: Partial<BlockType>) => void;
    onExecute: () => void;
}) => (
    <div className="flex items-center py-1 bg-gray-50 border-b gap-3">
        <select
            value={block.language || "javascript"}
            onChange={(e) => onUpdateBlock?.({ language: e.target.value })}
            className="h-6 px-1.5 text-xs border rounded bg-white cursor-pointer"
            onClick={(e) => e.stopPropagation()}
        >
            {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>{l.label}</option>
            ))}
        </select>
        <button
            onClick={(e) => { e.stopPropagation(); onExecute(); }}
            disabled={isRunning}
            title="运行代码"
            aria-label="运行代码"
            className="relative z-10 text-black-500 text-sm flex mr-auto items-center px-3 py-1 rounded-md bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-60 disabled:bg-indigo-400 transition-shadow shadow-sm"
        >
            {isRunning ? (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
            ) : (
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
            )}
            <span className="ml-0.5">{isRunning ? "运行中..." : "运行"}</span>
        </button>
        <div></div>
    </div>
);

const ExecutionOutput = ({ block, onClear }: { block: BlockType; onClear: () => void }) => {
    const hasOutput = block.executionOutput || block.executionError || block.executionExitCode !== undefined;
    if (!hasOutput) return null;

    const isError = (block.executionExitCode ?? 0) !== 0;
    return (
        <div className="mt-1 border rounded text-sm font-mono">
            <div className="flex items-center justify-between px-3 py-1 bg-gray-50 border-b text-xs text-gray-500">
                <div className="flex items-center gap-2">
                    <span className={`inline-block w-2 h-2 rounded-full ${isError ? "bg-red-500" : "bg-green-500"}`} />
                    <span>退出码: {block.executionExitCode ?? 0}</span>
                    {block.executionTimestamp && (
                        <span>· {new Date(block.executionTimestamp).toLocaleTimeString()}</span>
                    )}
                </div>
                <button onClick={onClear} className="text-gray-400 hover:text-red-500 transition-colors cursor-pointer">
                    清除
                </button>
            </div>
            {block.executionOutput && (
                <pre className="px-3 py-2 whitespace-pre-wrap break-words text-gray-800 max-h-64 overflow-y-auto">
                    {block.executionOutput}
                </pre>
            )}
            {block.executionError && (
                <pre className="px-3 py-2 whitespace-pre-wrap break-words text-red-600 bg-red-50 max-h-64 overflow-y-auto border-t">
                    {block.executionError}
                </pre>
            )}
        </div>
    );
};


const inlineToMarkdown = (node: ChildNode): string => {
    if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const el = node as HTMLElement;
    const children = Array.from(el.childNodes).map(inlineToMarkdown).join("");
    switch (el.tagName.toLowerCase()) {
        case "strong":
        case "b":
            return `**${children}**`;
        case "em":
        case "i":
            return `*${children}*`;
        case "code":
            return `\`${children}\``;
        case "a": {
            const href = el.getAttribute("href") ?? "";
            return href ? `[${children || href}](${href})` : children;
        }
        case "br":
            return "\n";
        case "img": {
            const src = el.getAttribute("src") ?? "";
            const alt = el.getAttribute("alt") ?? "";
            return src ? `![${alt}](${src})` : "";
        }
        default:
            return children;
    }
};

const blockToMarkdown = (node: ChildNode, depth = 0): string => {
    if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? "").trim();
    if (node.nodeType !== Node.ELEMENT_NODE) return "";
    const el = node as HTMLElement;
    const name = el.tagName.toLowerCase();
    const inline = () => Array.from(el.childNodes).map(inlineToMarkdown).join("").trim();
    const blocks = () => Array.from(el.childNodes).map(child => blockToMarkdown(child, depth)).filter(Boolean).join("\n\n");

    if (name === "h1") return `# ${inline()}`;
    if (name === "h2") return `## ${inline()}`;
    if (name === "h3") return `### ${inline()}`;
    if (name === "h4") return `#### ${inline()}`;
    if (name === "h5") return `##### ${inline()}`;
    if (name === "h6") return `###### ${inline()}`;
    if (name === "p") return inline();
    if (name === "blockquote") {
        const text = blocks() || inline();
        return text.split("\n").map(line => `> ${line}`).join("\n");
    }
    if (name === "pre") {
        const codeNode = el.querySelector("code");
        const langClass = codeNode?.className ?? "";
        const language = langClass.includes("language-") ? langClass.split("language-")[1].split(" ")[0] : "";
        const code = (codeNode?.textContent ?? el.textContent ?? "").replace(/\n$/, "");
        return `\`\`\`${language}\n${code}\n\`\`\``;
    }
    if (name === "ul" || name === "ol") {
        const items = Array.from(el.children)
            .filter(child => child.tagName.toLowerCase() === "li")
            .map((li, index) => {
                const marker = name === "ol" ? `${index + 1}. ` : "- ";
                const text = Array.from(li.childNodes).map(child => blockToMarkdown(child, depth + 1) || inlineToMarkdown(child)).join("").trim();
                const indent = "  ".repeat(depth);
                return `${indent}${marker}${text}`;
            });
        return items.join("\n");
    }
    if (name === "li") return inline();
    if (name === "div" || name === "section" || name === "article") return blocks();
    return blocks() || inline();
};

const extractMathFromHtml = (html: string): string => {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const annotations = doc.querySelectorAll('annotation[encoding="application/x-tex"]');
    annotations.forEach((ann) => {
        const latex = (ann.textContent ?? "").trim();
        if (!latex) return;
        const katexSpan = ann.closest(".katex");
        if (katexSpan) {
            const replacement = doc.createTextNode("$" + latex + "$");
            katexSpan.parentNode?.replaceChild(replacement, katexSpan);
        }
    });
    const scripts = doc.querySelectorAll('script[type="math/tex"], script[type="math/tex; mode=display"]');
    scripts.forEach((script) => {
        const latex = (script.textContent ?? "").trim();
        if (!latex) return;
        const wrap = script.getAttribute("type")?.includes("display") ? "$$" : "$";
        const replacement = doc.createTextNode(wrap + latex + wrap);
        script.parentNode?.replaceChild(replacement, script);
    });
    return doc.body.innerHTML;
};

const htmlToMarkdown = (html: string): string => {
    const withMath = extractMathFromHtml(html);
    const doc = new DOMParser().parseFromString(withMath, "text/html");
    const out = Array.from(doc.body.childNodes).map(node => blockToMarkdown(node)).filter(Boolean).join("\n\n");
    return out.replace(/\n{3,}/g, "\n\n").trim();
};

export const Block = ({
    block,
    content,
    onChange,
    onUpdateBlock,
}: {
    block: BlockType;
    content: string;
    onChange: (content: string) => void;
    onUpdateBlock?: (updates: Partial<BlockType>) => void;
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [isRunning, setIsRunning] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const previewRef = useRef<HTMLDivElement>(null);
    const pendingCursorRef = useRef<number>(content.length);

    const langExtensions = useMemo(() => getLanguageExtension(block.language), [block.language]);

    useEffect(() => {
        if (!isEditing || !textareaRef.current) return;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(pendingCursorRef.current, pendingCursorRef.current);
    }, [isEditing]);

    const handlePreviewClick = (e: React.MouseEvent<HTMLDivElement>) => {
        pendingCursorRef.current = content.length;
        if (previewRef.current && document.caretRangeFromPoint) {
            const range = document.caretRangeFromPoint(e.clientX, e.clientY);
            if (range) {
                const fullRange = document.createRange();
                fullRange.setStart(previewRef.current, 0);
                fullRange.setEnd(range.startContainer, range.startOffset);
                const textBeforeClick = fullRange.toString();
                const search = textBeforeClick.slice(-30);
                if (search) {
                    const idx = content.lastIndexOf(search);
                    if (idx !== -1) {
                        pendingCursorRef.current = idx + search.length;
                    } else {
                        const shortSearch = textBeforeClick.slice(-5);
                        const idx2 = content.lastIndexOf(shortSearch);
                        if (idx2 !== -1) pendingCursorRef.current = idx2 + shortSearch.length;
                    }
                }
            }
        }
        setIsEditing(true);
    };

    const handleMarkdownPaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
        const html = e.clipboardData.getData("text/html");
        if (!html) return;
        e.preventDefault();
        const markdown = htmlToMarkdown(html);
        const target = e.currentTarget;
        const start = target.selectionStart ?? target.value.length;
        const end = target.selectionEnd ?? target.value.length;
        const next = `${content.slice(0, start)}${markdown}${content.slice(end)}`;
        onChange(next);
    };

    const handleExecute = async () => {
        if (isRunning || block.blockType !== "code") return;
        setIsRunning(true);
        try {
            const res = await fetch("/api/execute", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ code: content, language: block.language || "javascript" }),
            });
            const data = await res.json();
            if (!res.ok) {
                onUpdateBlock?.({
                    executionOutput: "",
                    executionError: data.error || `HTTP ${res.status}`,
                    executionExitCode: 1,
                    executionTimestamp: new Date().toISOString(),
                });
            } else {
                onUpdateBlock?.({
                    executionOutput: data.stdout || "",
                    executionError: data.stderr || "",
                    executionExitCode: data.exitCode ?? 0,
                    executionTimestamp: new Date().toISOString(),
                });
            }
        } catch (err: any) {
            onUpdateBlock?.({
                executionOutput: "",
                executionError: err?.message ?? "网络错误",
                executionExitCode: 1,
                executionTimestamp: new Date().toISOString(),
            });
        } finally {
            setIsRunning(false);
        }
    };

    const handleClearOutput = () => {
        onUpdateBlock?.({
            executionOutput: undefined,
            executionError: undefined,
            executionExitCode: undefined,
            executionTimestamp: undefined,
        });
    };

    return (
        <>

            {!isEditing ? (
                (() => {

                    switch (block.blockType) {
                        case 'markdown':
                            return (
                                <div className="min-h-12"
                                    ref={previewRef}
                                    onClick={handlePreviewClick}
                                >
                                    <ReactMarkdown
                                        remarkPlugins={[remarkMath]}
                                        rehypePlugins={[rehypeKatex]}
                                        components={{
                                            h1: ({ children }) => <h1 className="text-3xl font-bold my-3">{children}</h1>,
                                            h2: ({ children }) => <h2 className="text-2xl font-semibold my-3">{children}</h2>,
                                            h3: ({ children }) => <h3 className="text-xl font-semibold my-2">{children}</h3>,
                                            p: ({ children }) => <p className="my-2 leading-7">{children}</p>,
                                            ul: ({ children }) => <ul className="list-disc pl-6 my-2 space-y-1">{children}</ul>,
                                            ol: ({ children }) => <ol className="list-decimal pl-6 my-2 space-y-1">{children}</ol>,
                                            li: ({ children }) => <li className="leading-7">{children}</li>,
                                            code: ({ children }) => (
                                                <code className="bg-gray-100 px-1 py-0.5 rounded text-sm">{children}</code>
                                            ),
                                            pre: ({ children }) => <pre className="bg-gray-100 p-3 rounded my-2 overflow-x-auto">{children}</pre>,
                                            blockquote: ({ children }) => (
                                                <blockquote className="border-l-4 border-gray-300 pl-3 text-gray-600 my-2">{children}</blockquote>
                                            ),
                                        }}
                                    >
                                        {content}
                                    </ReactMarkdown>
                                </div>
                            );
                        case 'code':
                            return (
                                <div className="border rounded overflow-hidden">
                                    <CodeToolbar block={block} isRunning={isRunning} onUpdateBlock={onUpdateBlock} onExecute={handleExecute} />
                                    <CodeMirror
                                        value={content}
                                        onChange={(value) => onChange(value)}
                                        extensions={langExtensions}
                                        className="w-full field-sizing-content min-w-1"
                                    />
                                    <ExecutionOutput block={block} onClear={handleClearOutput} />
                                </div>
                            );
                    }
                })()
            ) : (
                (() => {
                    switch (block.blockType) {
                        case 'markdown':
                            return (
                                <textarea
                                    ref={textareaRef}
                                    value={content}
                                    onBlur={() => setIsEditing(false)}
                                    onChange={(e) => onChange(e.target.value)}
                                    onPaste={handleMarkdownPaste}
                                    className="w-full field-sizing-content min-w-1 p-3 border rounded resize-none font-mono"
                                    placeholder="输入 Markdown 内容..."
                                />

                            );
                        case 'code':
                            return (
                                <div className="border rounded overflow-hidden">
                                    <CodeToolbar block={block} isRunning={isRunning} onUpdateBlock={onUpdateBlock} onExecute={handleExecute} />
                                    <CodeMirror
                                        value={content}
                                        onChange={(value) => onChange(value)}
                                        extensions={langExtensions}
                                        className="w-full field-sizing-content min-w-1"
                                    />
                                    <ExecutionOutput block={block} onClear={handleClearOutput} />
                                </div>
                            );
                        default:
                            return <div>Unknown block type: {block.blockType}</div>;
                    }
                })()
            )}
        </>
    );
}
