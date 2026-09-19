import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { db } from "@/lib/db";

const SESSION_COOKIE = "ai_slice_session";

const globalForSessions = globalThis as unknown as {
    sessions: Map<string, { userId: string }> | undefined;
};

const sessions = globalForSessions.sessions ?? new Map<string, { userId: string }>();
globalForSessions.sessions = sessions;

export async function createSession(userId: string): Promise<void> {
    const token = randomBytes(32).toString("hex");
    sessions.set(token, { userId });

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 7,
    });
}

export async function destroySession(): Promise<void> {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (token) sessions.delete(token);
    cookieStore.delete(SESSION_COOKIE);
}

export async function getCurrentUser() {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    if (!token) return null;

    const session = sessions.get(token);
    if (!session) return null;

    return db.user.findUnique({ where: { id: session.userId } });
}
