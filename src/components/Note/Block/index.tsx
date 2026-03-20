import { type Block as BlockType } from "@/store/kanban";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import { useState, useEffect, useRef, type ClipboardEvent } from "react";
import CodeMirror from "@uiw/react-codemirror";


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

export const Block = ({ block, content, onChange }: { block: BlockType, content: string, onChange: (content: string) => void }) => {
    const [isEditing, setIsEditing] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const previewRef = useRef<HTMLDivElement>(null);
    const pendingCursorRef = useRef<number>(content.length);

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
                                <CodeMirror
                                    value={content}
                                    onClick={() => setIsEditing(true)}
                                    onChange={(value) => onChange(value)}
                                    // onBlur={() => setIsEditing(false)}
                                    className="w-full field-sizing-content min-w-1 p-3 border rounded resize-none font-mono"
                                />
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
                                <div onBlur={() => setIsEditing(false)} className="min-h-12 border">
                                    <CodeMirror
                                        value={content}
                                        onChange={(value) => onChange(value)}
                                        className="w-full field-sizing-content min-w-1 p-3 border rounded resize-none font-mono"
                                    />
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
