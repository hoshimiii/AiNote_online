import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { type Note as NoteType } from "@/store/kanban";

interface MissionItemProps {
    MissionId: string,
    WorkSpaceId: string
    title: string,
    Notes: NoteType[],
}

export const MissionItem = ({ MissionId, title }: MissionItemProps) => {
    const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
        id: MissionId,
        data: { type: 'mission' }
    });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} className="flex items-center gap-1 w-full">
            <span {...attributes} {...listeners} className="cursor-grab text-gray-400 select-none">⠿</span>
            <span className="flex-1 truncate">{title}</span>
        </div>
    );
};
