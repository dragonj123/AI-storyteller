import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Email address - unique identifier for local auth */
  email: varchar("email", { length: 320 }).notNull().unique(),
  /** Hashed password for local authentication */
  password: varchar("password", { length: 255 }),
  /** Optional: Manus OAuth identifier (openId) for backward compatibility */
  openId: varchar("openId", { length: 64 }).unique(),
  name: text("name"),
  loginMethod: varchar("loginMethod", { length: 64 }).default("local"),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Jobs table for tracking transcription and extraction tasks
 */
export const jobs = mysqlTable("jobs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  jobType: mysqlEnum("jobType", ["audio", "document", "slide"]).notNull(),
  status: mysqlEnum("status", ["pending", "processing", "completed", "failed"]).default("pending").notNull(),
  originalFileName: text("originalFileName").notNull(),
  originalFileUrl: text("originalFileUrl").notNull(),
  originalFileKey: text("originalFileKey").notNull(),
  mimeType: varchar("mimeType", { length: 100 }),
  fileSize: int("fileSize"),
  jsonlUrl: text("jsonlUrl"),
  jsonlFileKey: text("jsonlFileKey"),
  errorMessage: text("errorMessage"),
  userQuery: text("userQuery"),
  customInstructions: text("customInstructions"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type Job = typeof jobs.$inferSelect;
export type InsertJob = typeof jobs.$inferInsert;
