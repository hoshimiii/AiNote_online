"use client"

import { useLayoutEffect, useState, type ReactNode } from "react"
import { useSession } from "next-auth/react"
import { useWorkSpace } from "@/store/kanban"
import { useChatbot } from "@/store/Chatbot"
import { LegacyLocalDataRecovery } from "@/components/auth/LegacyLocalDataRecovery"
import { activateAccount, beginAccountTransition, GUEST_OWNER } from "@/lib/account-boundary"

export function ZustandRehydrate({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession()
  const owner = status === "loading" ? null : session?.user?.id ?? GUEST_OWNER
  if (owner === null) return <div className="min-h-screen flex-1 bg-background" aria-hidden />
  return <AccountHydration key={owner} owner={owner}>{children}</AccountHydration>
}

function resetStores() {
  useWorkSpace.setState(useWorkSpace.getInitialState(), true)
  useChatbot.setState(useChatbot.getInitialState(), true)
}

function AccountHydration({ owner, children }: { owner: string; children: ReactNode }) {
  const [ready, setReady] = useState(false)

  useLayoutEffect(() => {
    const generation = beginAccountTransition()
    // Suppress persistence while clearing the previous owner's in-memory state.
    resetStores()
    activateAccount(owner, generation)
    let cancelled = false
    void Promise.all([useWorkSpace.persist.rehydrate(), useChatbot.persist.rehydrate()]).then(() => {
      if (!cancelled) setReady(true)
    })
    return () => { cancelled = true; beginAccountTransition(); resetStores() }
  }, [owner])

  if (!ready) {
    return <div className="min-h-screen flex-1 bg-background" aria-hidden />
  }
  return <><LegacyLocalDataRecovery />{children}</>
}
