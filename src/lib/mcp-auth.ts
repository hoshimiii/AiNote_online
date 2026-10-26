import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const MCP_MIGRATION_MESSAGE = "Legacy API key format: open account settings to wrap the existing secret with its account prefix, or generate a replacement key.";
export const mcpKeyPrefix = (userId: string) => `ainote_v2.${userId}.`;
let activeChecks = 0;

export async function authenticateMcp(req: Request): Promise<{ userId: string } | { error: string; status: number }> {
    const header = req.headers.get("authorization") ?? "";
    const match = /^Bearer ainote_v2\.([A-Za-z0-9_-]{1,128})\.([a-f0-9]{64})$/.exec(header);
    if (!match) {
        const legacy = /^Bearer (?:ainote_)?[a-f0-9]{64}$/.test(header);
        return { error: legacy ? MCP_MIGRATION_MESSAGE : "Invalid API Key", status: 401 };
    }
    // Per-process admission bound; deployment-wide limits still belong at ingress.
    if (activeChecks >= 4) return { error: "Authentication busy; retry later", status: 429 };
    activeChecks++;
    try {
        const user = await prisma.user.findUnique({
            where: { id: match[1] },
            select: { id: true, mcpApiKey: true },
        });
        if (user?.mcpApiKey && await bcrypt.compare(match[2], user.mcpApiKey)) return { userId: user.id };
        return { error: "Invalid API Key", status: 401 };
    } finally {
        activeChecks--;
    }
}
