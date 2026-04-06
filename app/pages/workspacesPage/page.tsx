"use client"

import { Button } from "@/components/ui/button"
import { WorkSpace } from "@/components/WorkSpace"
import { useWorkSpace } from "@/store/kanban"
import { generateRandomId } from "@/components/utils/RandomGenerator"
import { LogoutButton } from "@/components/auth/LogoutButton"

export const WorkSpacePage = () => {
  const { createWorkSpace } = useWorkSpace()
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-6 py-10">
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">工作区</h1>
        <LogoutButton />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <WorkSpace />
        <Button
          type="button"
          className="min-h-32 w-full cursor-pointer border-dashed text-muted-foreground shadow-sm hover:text-foreground"
          variant="outline"
          onClick={() =>
            createWorkSpace({
              workspaceId: generateRandomId(),
              workspaceName: "new WorkSpace",
            })
          }
        >
          + 新建工作区
        </Button>
      </div>
    </div>
  )
}

export default WorkSpacePage
