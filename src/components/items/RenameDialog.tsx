// src/components/common/RenameDialog.tsx

// import  { Dialog } from "radix-ui";
import { useState } from "react";
import { Button } from "../ui/button";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog";
import { Input } from "../ui/input";

interface RenameDialogProps {
    initialName: string;
    title?: string;
    // 核心：由外部定义具体的修改逻辑
    onConfirm: (newName: string) => void;
    // 触发器按钮（可选，方便自定义样式）
    trigger?: React.ReactNode;
}

export const RenameDialog = ({
    initialName,
    title = "重命名",
    onConfirm,
    trigger
}: RenameDialogProps) => {
    const [name, setName] = useState(initialName);
    const [open, setOpen] = useState(false);

    const handleSave = () => {
        if (name.trim()) {
            onConfirm(name.trim()); // 执行外部传入的逻辑
            setOpen(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild onClick={(e) => e.stopPropagation()}>
                {trigger || <Button className="cursor-pointer" variant="ghost" size="sm">重命名</Button>}
            </DialogTrigger>

            <DialogContent onClick={(e) => e.stopPropagation()}>
                <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
                <DialogFooter>
                    <Button className="cursor-pointer" variant="outline" onClick={() => setOpen(false)}>取消</Button>
                    <Button className="cursor-pointer" variant="outline" onClick={handleSave}>保存</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};