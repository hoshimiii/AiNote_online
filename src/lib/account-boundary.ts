import type { StateStorage } from "zustand/middleware";

export const GUEST_OWNER = "guest";
let owner: string | null = null;
let generation = 0;
let controller = new AbortController();

export function beginAccountTransition() {
    controller.abort();
    controller = new AbortController();
    owner = null;
    return ++generation;
}

export function activateAccount(nextOwner: string, expectedGeneration: number) {
    if (generation !== expectedGeneration) return false;
    owner = nextOwner;
    return true;
}

export const accountLease = () => ({ owner, generation, signal: controller.signal });
export const isCurrentAccount = (lease: ReturnType<typeof accountLease>) =>
    lease.owner !== null && lease.owner === owner && lease.generation === generation && !lease.signal.aborted;

// Unowned legacy keys are retained for explicit export and never auto-adopted.
export const accountStorage: StateStorage = {
    getItem: (name) => owner === null ? null : localStorage.getItem(`${name}:owner:${encodeURIComponent(owner)}`),
    setItem: (name, value) => {
        if (owner !== null) localStorage.setItem(`${name}:owner:${encodeURIComponent(owner)}`, value);
    },
    removeItem: (name) => {
        if (owner !== null) localStorage.removeItem(`${name}:owner:${encodeURIComponent(owner)}`);
    },
};
