import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { createJob } from "./db";

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

describe("query functionality", () => {
  const testUser: AuthenticatedUser = {
    id: 888,
    openId: "test-user-query",
    email: "query@example.com",
    name: "Query Test User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  it("should update job with user query and generate custom instructions", async () => {
    const { ctx } = createTestContext(testUser);
    const caller = appRouter.createCaller(ctx);

    // Create a test job
    const job = await createJob({
      userId: testUser.id,
      jobType: "audio",
      originalFileName: "test-meeting.mp3",
      originalFileUrl: "https://example.com/test-meeting.mp3",
      originalFileKey: "uploads/888/audio/test-meeting.mp3",
      mimeType: "audio/mpeg",
      fileSize: 2048000,
      status: "pending",
    });

    // Update job with query
    const result = await caller.jobs.updateQuery({
      jobId: job.id,
      userQuery: "Extract only speaker names and timestamps",
    });

    expect(result.success).toBe(true);
    expect(result.customInstructions).toBeDefined();
    expect(typeof result.customInstructions).toBe("string");
    expect(result.customInstructions.length).toBeGreaterThan(0);
  });

  it("should prevent unauthorized users from updating other users' job queries", async () => {
    const otherUser: AuthenticatedUser = {
      id: 777,
      openId: "other-user-query",
      email: "other@example.com",
      name: "Other User",
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    };

    // Create a job for testUser
    const job = await createJob({
      userId: testUser.id,
      jobType: "document",
      originalFileName: "private-doc.pdf",
      originalFileUrl: "https://example.com/private-doc.pdf",
      originalFileKey: "uploads/888/document/private-doc.pdf",
      mimeType: "application/pdf",
      fileSize: 1024000,
      status: "pending",
    });

    // Try to update it with otherUser
    const { ctx: otherCtx } = createTestContext(otherUser);
    const otherCaller = appRouter.createCaller(otherCtx);

    await expect(
      otherCaller.jobs.updateQuery({
        jobId: job.id,
        userQuery: "Summarize this document",
      })
    ).rejects.toThrow("Unauthorized");
  });

  it("should handle empty or invalid queries gracefully", async () => {
    const { ctx } = createTestContext(testUser);
    const caller = appRouter.createCaller(ctx);

    // Create a test job
    const job = await createJob({
      userId: testUser.id,
      jobType: "slide",
      originalFileName: "presentation.pptx",
      originalFileUrl: "https://example.com/presentation.pptx",
      originalFileKey: "uploads/888/slide/presentation.pptx",
      mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      fileSize: 3072000,
      status: "pending",
    });

    // Update with minimal query
    const result = await caller.jobs.updateQuery({
      jobId: job.id,
      userQuery: "help",
    });

    expect(result.success).toBe(true);
    expect(result.customInstructions).toBeDefined();
  });
});
