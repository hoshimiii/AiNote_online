
import { WorkPage } from "@/pages/workPage"
import { WorkSpacePage } from "@/pages/workspacesPage"
import { createBrowserRouter } from "react-router-dom"
import { Link } from "react-router-dom";

const routes = [
    {
        path: "/",
        element: <Link to="/workspace">开始你的笔记之旅</Link>
    },
    {
        path: "/workspace",
        element: <WorkSpacePage />
    },
    {
        path: "/work",
        element: <WorkPage />
    }
]

export const router = createBrowserRouter(routes)