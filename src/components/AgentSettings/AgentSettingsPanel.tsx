import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { useChatbot } from "@/store/Chatbot";
import type { LLMConfig } from "@/api/llm";

interface AgentSettingsPanelProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const AgentSettingsPanel = ({ open, onOpenChange }: AgentSettingsPanelProps) => {
    const { config, setConfig } = useChatbot();
    const [form, setForm] = useState<LLMConfig>({
        baseurl: config.baseurl,
        usertoken: config.usertoken,
        model: config.model,
        temperature: config.temperature ?? 0.7,
        userRules: config.userRules ?? "",
    });
    useEffect(() => {
        if (open) setForm({
            baseurl: config.baseurl,
            usertoken: config.usertoken,
            model: config.model,
            temperature: config.temperature ?? 0.7,
            userRules: config.userRules ?? "",
        });
    }, [open, config.baseurl, config.usertoken, config.model, config.temperature, config.userRules]);

    const handleSave = () => {
        setConfig({
            baseurl: form.baseurl,
            usertoken: form.usertoken,
            model: form.model,
            temperature: form.temperature,
            userRules: form.userRules,
        });
        onOpenChange(false);
    };

    const update = (k: keyof LLMConfig, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="right" className="sm:max-w-md">
                <SheetHeader>
                    <SheetTitle>Agent 配置</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-4 py-4">
                    <div className="flex flex-col gap-2">
                        <span className="text-sm font-medium">Base URL</span>
                        <Input
                            value={form.baseurl}
                            onChange={(e) => update("baseurl", e.target.value)}
                            placeholder="https://api.xxx.com/v1/chat/completions"
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <span className="text-sm font-medium">API Key</span>
                        <Input
                            type="password"
                            value={form.usertoken}
                            onChange={(e) => update("usertoken", e.target.value)}
                            placeholder="sk-xxx"
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <span className="text-sm font-medium">Model</span>
                        <Input
                            value={form.model}
                            onChange={(e) => update("model", e.target.value)}
                            placeholder="deepseek-ai/DeepSeek-V3.2"
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <span className="text-sm font-medium">温度 (0-2)</span>
                        <Input
                            type="number"
                            min={0}
                            max={2}
                            step={0.1}
                            value={form.temperature ?? 0.7}
                            onChange={(e) => update("temperature", parseFloat(e.target.value) || 0.7)}
                        />
                    </div>
                    <div className="flex flex-col gap-2">
                        <span className="text-sm font-medium">用户规则</span>
                        <textarea
                            className="min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm resize-y"
                            value={form.userRules ?? ""}
                            onChange={(e) => update("userRules", e.target.value)}
                            placeholder="自定义规则，会追加到系统提示中..."
                        />
                    </div>
                </div>
                <SheetFooter>
                    <Button variant="outline" className="cursor-pointer" onClick={() => onOpenChange(false)}>取消</Button>
                    <Button variant="outline" className="cursor-pointer" onClick={handleSave}>保存</Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
};
