import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { config } from "@/lib/config";

const STORAGE_ROOT = path.join(process.cwd(), config.uploads.storageDir);

export async function saveUpload(
    userId: string,
    buffer: Buffer,
    mimeType: string
): Promise<string> {
    await fs.mkdir(path.join(STORAGE_ROOT, userId), { recursive: true });

    const ext =
        mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
    const key = `${userId}/${randomUUID()}.${ext}`;

    await fs.writeFile(path.join(STORAGE_ROOT, key), buffer);

    return key;
}
export async function readUpload(storageKey: string): Promise<Buffer> {
    return fs.readFile(path.join(STORAGE_ROOT, storageKey));
}

export function storageKeyToPublicPath(storageKey: string): string {
    return `/uploads/${storageKey}`;
}
