import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { z } from "zod";
import { createJob, getJobById, getUserJobs, getAllJobs, updateJobStatus, getDb } from "./db";
import { storagePut } from "./storage";
import { processAudioToJsonl, processDocumentToJsonl, processSlidesToJsonl } from "./processing";
import { nanoid } from "nanoid";
import { jobs } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";
import { invokeOpenAILLM } from "./openaiIntegration";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return {
        success: true,
      } as const;
    }),
  }),

  jobs: router({
    create: protectedProcedure
      .input(
        z.object({
          jobType: z.enum(["audio", "document", "slide"]),
          originalFileName: z.string(),
          originalFileUrl: z.string(),
          originalFileKey: z.string(),
          mimeType: z.string(),
          fileSize: z.number(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const job = await createJob({
          userId: ctx.user.id,
          jobType: input.jobType,
          originalFileName: input.originalFileName,
          originalFileUrl: input.originalFileUrl,
          originalFileKey: input.originalFileKey,
          mimeType: input.mimeType,
          fileSize: input.fileSize,
          status: "pending",
        });

        // Process job asynchronously
        processJobAsync(job.id, input.jobType, input.originalFileUrl, input.mimeType).catch(
          console.error
        );

        return job;
      }),

    list: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user.role === "admin") {
        return getAllJobs();
      }
      return getUserJobs(ctx.user.id);
    }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const job = await getJobById(input.id);
        if (!job) {
          throw new Error("Job not found");
        }
        // Users can only see their own jobs, admins can see all
        if (job.userId !== ctx.user.id && ctx.user.role !== "admin") {
          throw new Error("Unauthorized");
        }
        return job;
      }),

    updateQuery: protectedProcedure
      .input(
        z.object({
          jobId: z.number(),
          userQuery: z.string(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const job = await getJobById(input.jobId);
        if (!job) {
          throw new Error("Job not found");
        }
        if (job.userId !== ctx.user.id && ctx.user.role !== "admin") {
          throw new Error("Unauthorized");
        }

        // Use LLM to generate custom instructions based on user query
        const customInstructions = await generateCustomInstructions(
          input.userQuery,
          job.jobType,
          job.originalFileName
        );

        // Update job with query and instructions
        const db = await getDb();
        if (!db) {
          throw new Error("Database not available");
        }

        await db.update(jobs).set({
          userQuery: input.userQuery,
          customInstructions,
        }).where(eq(jobs.id, input.jobId));

        return { success: true, customInstructions };
      }),
  }),
});

export type AppRouter = typeof appRouter;

/**
 * Generate custom instructions based on user query using LLM
 */
async function generateCustomInstructions(
  userQuery: string,
  jobType: string,
  fileName: string
): Promise<string> {
  const systemPrompt = `You are an AI assistant helping users process their ${jobType} files. The user has uploaded a file named "${fileName}" and wants to customize how it should be processed into JSONL format. Based on their query, provide clear, specific instructions for processing this file.`;

  try {
    // Try OpenAI first if API key is available
    if (process.env.OPENAI_API_KEY) {
      const response = await invokeOpenAILLM([
        { role: "system", content: systemPrompt },
        { role: "user", content: userQuery },
      ]);
      return response.choices[0]?.message?.content || "Standard processing will be applied.";
    }

    // Fallback to Manus LLM if available
    const response = await invokeLLM({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userQuery },
      ],
    });

    const content = response.choices[0]?.message?.content;
    return typeof content === "string" ? content : "Standard processing will be applied.";
  } catch (error) {
    console.error("LLM error:", error);
    return "Standard processing will be applied. (LLM service unavailable)";
  }
}

/**
 * Process job asynchronously in the background
 */
async function processJobAsync(
  jobId: number,
  jobType: "audio" | "document" | "slide",
  fileUrl: string,
  mimeType: string
): Promise<void> {
  try {
    await updateJobStatus(jobId, "processing");

    let jsonlContent: string;

    if (jobType === "audio") {
      jsonlContent = await processAudioToJsonl(fileUrl);
    } else if (jobType === "document") {
      jsonlContent = await processDocumentToJsonl(fileUrl, mimeType);
    } else if (jobType === "slide") {
      jsonlContent = await processSlidesToJsonl(fileUrl, mimeType);
    } else {
      throw new Error(`Unknown job type: ${jobType}`);
    }

    // Upload JSONL to S3
    const jsonlKey = `jsonl/${jobId}-${nanoid()}.jsonl`;
    const { url: jsonlUrl } = await storagePut(
      jsonlKey,
      jsonlContent,
      "application/jsonl"
    );

    await updateJobStatus(jobId, "completed", {
      jsonlUrl,
      jsonlFileKey: jsonlKey,
      completedAt: new Date(),
    });
  } catch (error) {
    console.error(`Job ${jobId} failed:`, error);
    await updateJobStatus(jobId, "failed", {
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
