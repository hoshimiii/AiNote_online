"use client";
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/pages/workspacesPage");
  return (
    <div>
      <h1>Home</h1>
    </div>
  )
  
}
