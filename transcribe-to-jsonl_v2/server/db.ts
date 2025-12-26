import { eq, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, jobs, InsertJob, Job } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.email) {
    throw new Error("User email is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      email: user.email,
      openId: user.openId || null,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      if (field !== 'email') { // email is required, skip in update
        values[field] = normalized;
      }
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId && user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (user.password !== undefined) {
      values.password = user.password;
      updateSet.password = user.password;
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);

  return result.length > 0 ? result[0] : undefined;
}

// Job-related database helpers
export async function createJob(job: InsertJob): Promise<Job> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const result = await db.insert(jobs).values(job);
  const insertedId = Number(result[0].insertId);
  
  const inserted = await db.select().from(jobs).where(eq(jobs.id, insertedId)).limit(1);
  if (!inserted[0]) {
    throw new Error("Failed to retrieve inserted job");
  }
  
  return inserted[0];
}

export async function getJobById(jobId: number): Promise<Job | undefined> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const result = await db.select().from(jobs).where(eq(jobs.id, jobId)).limit(1);
  return result[0];
}

export async function getUserJobs(userId: number): Promise<Job[]> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  return db.select().from(jobs).where(eq(jobs.userId, userId)).orderBy(desc(jobs.createdAt));
}

export async function getAllJobs(): Promise<Job[]> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  return db.select().from(jobs).orderBy(desc(jobs.createdAt));
}

export async function updateJobStatus(
  jobId: number,
  status: Job["status"],
  updates?: {
    jsonlUrl?: string;
    jsonlFileKey?: string;
    errorMessage?: string;
    completedAt?: Date;
  }
): Promise<void> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  const updateData: Partial<Job> = { status };
  if (updates?.jsonlUrl) updateData.jsonlUrl = updates.jsonlUrl;
  if (updates?.jsonlFileKey) updateData.jsonlFileKey = updates.jsonlFileKey;
  if (updates?.errorMessage) updateData.errorMessage = updates.errorMessage;
  if (updates?.completedAt) updateData.completedAt = updates.completedAt;

  await db.update(jobs).set(updateData).where(eq(jobs.id, jobId));
}
