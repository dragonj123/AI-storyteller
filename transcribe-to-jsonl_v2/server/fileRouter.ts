import express from "express";
import { localStorageGet } from "./localStorage";

const router = express.Router();

/**
 * Serve files from local storage
 * GET /api/files/:path
 */
router.get("/*", async (req, res) => {
  try {
    const fileKey = (req.params as any)[0]; // Get everything after /api/files/

    if (!fileKey) {
      res.status(400).json({ error: "File key is required" });
      return;
    }

    const fileBuffer = await localStorageGet(fileKey);
    
    // Set appropriate content type based on file extension
    const ext = fileKey.split(".").pop()?.toLowerCase();
    const contentTypes: Record<string, string> = {
      mp3: "audio/mpeg",
      wav: "audio/wav",
      m4a: "audio/mp4",
      webm: "audio/webm",
      pdf: "application/pdf",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      txt: "text/plain",
      md: "text/markdown",
      jsonl: "application/jsonl",
    };

    const contentType = ext ? contentTypes[ext] || "application/octet-stream" : "application/octet-stream";
    
    res.setHeader("Content-Type", contentType);
    res.send(fileBuffer);
  } catch (error) {
    console.error("File serving error:", error);
    res.status(404).json({ error: "File not found" });
  }
});

export default router;
