import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import React from "react";


interface BoardProps extends React.PropsWithChildren {
    id: string,
    title: string,
}

export const BoardItem = (props: BoardProps) => {
    const { id, title, children } = props;
    const { setNodeRef, attributes, listeners, transform, transition, isDragging } = useSortable({
        id,
        data: { type: 'board' }
    });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const childrenArray = React.Children.toArray(children);
    const firstChild = childrenArray[0];
    const restChildren = childrenArray.slice(1);

    return (
        <div ref={setNodeRef} style={style} className="flex flex-col gap-2">
            <div className="flex flex-row items-center gap-2">
                <span {...attributes} {...listeners} className="cursor-grab text-gray-400 select-none">⠿</span>
                <span className="flex-1 font-medium text-sm">{title}</span>
                {firstChild}
            </div>
            {restChildren}
        </div>
    );
};
