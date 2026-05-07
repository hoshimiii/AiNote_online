import { Button } from "../ui/button";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from "../ui/sheet";

interface LinkManagerSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    title: string;
    description: string;
    currentSummary?: React.ReactNode;
    preview?: React.ReactNode;
    onSave: () => void;
    onClear?: () => void;
    saveLabel?: string;
    clearLabel?: string;
    saveDisabled?: boolean;
    trigger?: React.ReactNode;
    children: React.ReactNode;
}

export const LinkManagerSheet = ({
    open,
    onOpenChange,
    title,
    description,
    currentSummary,
    preview,
    onSave,
    onClear,
    saveLabel = "保存关联",
    clearLabel = "清除关联",
    saveDisabled = false,
    trigger,
    children,
}: LinkManagerSheetProps) => {
    const handleClose = () => onOpenChange(false);

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetTrigger asChild onClick={(event) => event.stopPropagation()}>
                {trigger || <Button variant="ghost" size="sm">管理关联</Button>}
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-2xl">
                <SheetHeader className="border-b px-6 py-5">
                    <SheetTitle>{title}</SheetTitle>
                    <SheetDescription>{description}</SheetDescription>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                    {currentSummary ? (
                        <section className="rounded-xl border bg-muted/30 p-4">
                            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">当前关联</div>
                            {currentSummary}
                        </section>
                    ) : null}

                    <div className={preview ? "grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(260px,0.9fr)]" : "space-y-4"}>
                        <div className="space-y-4">{children}</div>
                        {preview ? (
                            <aside className="rounded-xl border bg-background p-4">
                                <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">预览</div>
                                {preview}
                            </aside>
                        ) : null}
                    </div>
                </div>

                <SheetFooter className="border-t px-6 py-4 sm:flex-row sm:justify-end">
                    {onClear ? (
                        <Button
                            type="button"
                            variant="outline"
                            className="cursor-pointer"
                            onClick={() => {
                                onClear();
                                handleClose();
                            }}
                        >
                            {clearLabel}
                        </Button>
                    ) : null}
                    <Button type="button" variant="outline" className="cursor-pointer" onClick={handleClose}>
                        取消
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        className="cursor-pointer"
                        onClick={() => {
                            onSave();
                            handleClose();
                        }}
                        disabled={saveDisabled}
                    >
                        {saveLabel}
                    </Button>
                </SheetFooter>
            </SheetContent>
        </Sheet>
    );
};