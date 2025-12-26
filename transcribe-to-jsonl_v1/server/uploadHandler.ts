import { Router } from "express";
import { storagePut } from "./storage";

export const uploadRouter = Router();

uploadRouter.post("/upload", async (req, res) => {
  try {
    const { fileKey, fileData, mimeType } = req.body;

    if (!fileKey || !fileData || !mimeType) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    // Convert base64 back to buffer
    const buffer = Buffer.from(fileData, "base64");

    // Upload to S3
    const { url } = await storagePut(fileKey, buffer, mimeType);

    res.json({ url, key: fileKey });
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Upload failed" });
  }
});
