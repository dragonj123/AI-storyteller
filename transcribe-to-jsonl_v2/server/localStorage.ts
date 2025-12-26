import fs from "fs/promises";
import path from "path";
import { nanoid } from "nanoid";

const STORAGE_DIR = process.env.LOCAL_STORAGE_DIR || path.join(process.cwd(), "uploads");

/**
 * Ensure storage directory exists
 */
async function ensureStorageDir() {
  try {
    await fs.access(STORAGE_DIR);
  } catch {
    await fs.mkdir(STORAGE_DIR, { recursive: true });
  }
}

/**
 * Store file locally and return URL
 * Compatible with S3 storagePut interface
 */
export async function localStoragePut(
  fileKey: string,
  data: Buffer | Uint8Array | string,
  contentType?: string
): Promise<{ key: string; url: string }> {
  await ensureStorageDir();

  const filePath = path.join(STORAGE_DIR, fileKey);
  const fileDir = path.dirname(filePath);

  // Ensure subdirectories exist
  await fs.mkdir(fileDir, { recursive: true });

  // Write file
  if (typeof data === "string") {
    await fs.writeFile(filePath, data, "utf-8");
  } else {
    await fs.writeFile(filePath, Buffer.from(data));
  }

  // Return local file URL
  const url = `/api/files/${fileKey}`;

  return { key: fileKey, url };
}

/**
 * Get file from local storage
 */
export async function localStorageGet(fileKey: string): Promise<Buffer> {
  const filePath = path.join(STORAGE_DIR, fileKey);
  return await fs.readFile(filePath);
}

/**
 * Delete file from local storage
 */
export async function localStorageDelete(fileKey: string): Promise<void> {
  const filePath = path.join(STORAGE_DIR, fileKey);
  try {
    await fs.unlink(filePath);
  } catch (error) {
    console.error(`Failed to delete file ${fileKey}:`, error);
  }
}

/**
 * Generate a unique file key
 */
export function generateFileKey(userId: number, type: string, filename: string): string {
  const ext = path.extname(filename);
  const basename = path.basename(filename, ext);
  const randomSuffix = nanoid(8);
  return `${userId}/${type}/${basename}-${randomSuffix}${ext}`;
}
