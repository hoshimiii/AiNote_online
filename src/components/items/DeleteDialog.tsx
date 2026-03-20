import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "../ui/alert-dialog";
import { Button } from "../ui/button";


interface DeleteDialogProps {
    title: string;
    description: string;
    onConfirm: () => void;
    trigger?: React.ReactNode;
}

export const DeleteDialog = ({
    title = "确定删除吗",
    description = "此操作无法撤销，相关数据将永久消失",
    onConfirm,
    trigger
}: DeleteDialogProps) => {

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild onClick={(e) => e.stopPropagation()}>
                {trigger || <Button className="cursor-pointer text-red-400" >删除</Button>}
            </AlertDialogTrigger>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {description}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel className="cursor-pointer">取消</AlertDialogCancel>
                    <AlertDialogAction className="cursor-pointer text-red-600" onClick={onConfirm}>确认执行删除</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}