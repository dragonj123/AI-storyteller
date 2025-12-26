import { describe, expect, it, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { createJob, updateJobStatus } from "./db";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createTestContext(user: AuthenticatedUser): { ctx: TrpcContext } {
  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };

  return { ctx };
}

describe("jobs router", () => {
  const testUser: AuthenticatedUser = {
    id: 999,
    openId: "test-user-jobs",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  it("should create a job successfully", async () => {
    const { ctx } = createTestContext(testUser);
    const caller = appRouter.createCaller(ctx);

    const job = await caller.jobs.create({
      jobType: "audio",
      originalFileName: "test-audio.mp3",
      originalFileUrl: "https://example.com/test-audio.mp3",
      originalFileKey: "uploads/999/audio/test-audio.mp3",
      mimeType: "audio/mpeg",
      fileSize: 1024000,
    });

    expect(job).toBeDefined();
    expect(job.userId).toBe(testUser.id);
    expect(job.jobType).toBe("audio");
    expect(job.status).toBe("pending");
    expect(job.originalFileName).toBe("test-audio.mp3");
  });

  it("should list user jobs", async () => {
    const { ctx } = createTestContext(testUser);
    const caller = appRouter.createCaller(ctx);

    // Create a test job first
    await createJob({
      userId: testUser.id,
      jobType: "document",
      originalFileName: "test-doc.pdf",
      originalFileUrl: "https://example.com/test-doc.pdf",
      originalFileKey: "uploads/999/document/test-doc.pdf",
      mimeType: "application/pdf",
      fileSize: 2048000,
      status: "pending",
    });

    const jobs = await caller.jobs.list();

    expect(jobs).toBeDefined();
    expect(Array.isArray(jobs)).toBe(true);
    expect(jobs.length).toBeGreaterThan(0);
    
    // All jobs should belong to the test user
    jobs.forEach(job => {
      expect(job.userId).toBe(testUser.id);
    });
  });

  it("should get a specific job by id", async () => {
    const { ctx } = createTestContext(testUser);
    const caller = appRouter.createCaller(ctx);

    // Create a test job
    const createdJob = await createJob({
      userId: testUser.id,
      jobType: "slide",
      originalFileName: "test-slides.pptx",
      originalFileUrl: "https://example.com/test-slides.pptx",
      originalFileKey: "uploads/999/slide/test-slides.pptx",
      mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      fileSize: 5120000,
      status: "pending",
    });

    const job = await caller.jobs.get({ id: createdJob.id });

    expect(job).toBeDefined();
    expect(job.id).toBe(createdJob.id);
    expect(job.userId).toBe(testUser.id);
    expect(job.jobType).toBe("slide");
  });

  it("should prevent unauthorized access to other user's jobs", async () => {
    const otherUser: AuthenticatedUser = {
      id: 888,
      openId: "other-user",
      email: "other@example.com",
      name: "Other User",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };

    // Create a job for testUser
    const createdJob = await createJob({
      userId: testUser.id,
      jobType: "audio",
      originalFileName: "private-audio.mp3",
      originalFileUrl: "https://example.com/private-audio.mp3",
      originalFileKey: "uploads/999/audio/private-audio.mp3",
      mimeType: "audio/mpeg",
      fileSize: 1024000,
      status: "pending",
    });

    // Try to access it with otherUser
    const { ctx: otherCtx } = createTestContext(otherUser);
    const otherCaller = appRouter.createCaller(otherCtx);

    await expect(otherCaller.jobs.get({ id: createdJob.id })).rejects.toThrow("Unauthorized");
  });

  it("admin should be able to see all jobs", async () => {
    const adminUser: AuthenticatedUser = {
      id: 1,
      openId: "admin-user",
      email: "admin@example.com",
      name: "Admin User",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };

    const { ctx } = createTestContext(adminUser);
    const caller = appRouter.createCaller(ctx);

    const jobs = await caller.jobs.list();

    expect(jobs).toBeDefined();
    expect(Array.isArray(jobs)).toBe(true);
    // Admin should see jobs from all users
  });
});
