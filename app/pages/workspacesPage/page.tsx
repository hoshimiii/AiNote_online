"use client";
import { Button } from "@/components/ui/button";
import { WorkSpace } from "@/components/WorkSpace";
import { useWorkSpace } from "@/store/kanban"
import { generateRandomId } from "@/components/utils/RandomGenerator";


export const WorkSpacePage = () => {
    const {createWorkSpace } = useWorkSpace();
    return (
        <div className=" grid grid-cols-3 gap-3 w-[80vw] p-4 ">
            {/* <h1>工作区</h1> */}
            <WorkSpace />
            <Button className="cursor-pointer w-full h-[20vh]" variant="outline" onClick={() => createWorkSpace({
                workspaceId: generateRandomId(),
                workspaceName: 'new WorkSpace'
            })}>创建一个新的workspace</Button>
        </div>
    )
}

export default WorkSpacePage;
