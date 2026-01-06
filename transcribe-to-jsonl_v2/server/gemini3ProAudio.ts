/**
 * Script to call Gemini 3 Pro with audio input
 * 
 * Usage:
 *   tsx server/gemini3ProAudio.ts <audio-file-path-or-url> [prompt]
 * 
 * Example:
 *   tsx server/gemini3ProAudio.ts ./audio.mp3 "Transcribe this audio and summarize the main points"
 *   tsx server/gemini3ProAudio.ts https://example.com/audio.mp3 "What is the speaker discussing?"
 * 
 * Environment variable:
 *   GEMINI_3_PRO_API_KEY - Your Gemini 3 Pro API key (placeholder: YOUR_GEMINI_3_PRO_API_KEY)
 */

import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Placeholder API key - replace with your actual key or set via environment variable
const GEMINI_API_KEY = process.env.GEMINI_3_PRO_API_KEY || "YOUR_GEMINI_3_PRO_API_KEY";

// Gemini API endpoint
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro:generateContent";

interface GeminiAudioPart {
  inlineData: {
    mimeType: string;
    data: string; // base64 encoded audio
  };
}

interface GeminiTextPart {
  text: string;
}

type GeminiPart = GeminiAudioPart | GeminiTextPart;

interface GeminiRequest {
  contents: Array<{
    parts: GeminiPart[];
  }>;
  generationConfig?: {
    temperature?: number;
    topP?: number;
    topK?: number;
    maxOutputTokens?: number;
  };
}

interface GeminiResponse {
  candidates: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
    finishReason: string;
  }>;
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

/**
 * Get MIME type from file extension or URL
 */
function getMimeType(filePath: string): string {
  const ext = filePath.toLowerCase().split(".").pop();
  const mimeTypes: Record<string, string> = {
    mp3: "audio/mpeg",
    wav: "audio/wav",
    ogg: "audio/ogg",
    m4a: "audio/mp4",
    flac: "audio/flac",
    webm: "audio/webm",
    aac: "audio/aac",
  };
  return mimeTypes[ext || ""] || "audio/mpeg";
}

/**
 * Check if a string is a URL
 */
function isUrl(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Load audio file from local path or URL
 */
async function loadAudioFile(filePathOrUrl: string): Promise<{ data: Buffer; mimeType: string }> {
  if (isUrl(filePathOrUrl)) {
    // Download from URL
    const response = await fetch(filePathOrUrl);
    if (!response.ok) {
      throw new Error(`Failed to download audio: ${response.status} ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const mimeType = response.headers.get("content-type") || getMimeType(filePathOrUrl);
    return {
      data: Buffer.from(arrayBuffer),
      mimeType,
    };
  } else {
    // Read from local file
    const absolutePath = filePathOrUrl.startsWith("/")
      ? filePathOrUrl
      : join(process.cwd(), filePathOrUrl);
    const data = readFileSync(absolutePath);
    const mimeType = getMimeType(filePathOrUrl);
    return { data, mimeType };
  }
}

/**
 * Convert audio buffer to base64
 */
function bufferToBase64(buffer: Buffer): string {
  return buffer.toString("base64");
}

/**
 * Call Gemini 3 Pro API with audio input
 */
async function callGemini3Pro(
  audioData: Buffer,
  mimeType: string,
  prompt: string
): Promise<GeminiResponse> {
  if (GEMINI_API_KEY === "YOUR_GEMINI_3_PRO_API_KEY") {
    throw new Error(
      "Please set GEMINI_3_PRO_API_KEY environment variable or replace the placeholder in the script"
    );
  }

  const audioBase64 = bufferToBase64(audioData);

  const requestBody: GeminiRequest = {
    contents: [
      {
        parts: [
          {
            inlineData: {
              mimeType,
              data: audioBase64,
            },
          } as GeminiAudioPart,
          {
            text: prompt,
          } as GeminiTextPart,
        ],
      },
    ],
    generationConfig: {
      temperature: 0.7,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 8192,
    },
  };

  const url = `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Gemini API request failed: ${response.status} ${response.statusText} - ${errorText}`
    );
  }

  return (await response.json()) as GeminiResponse;
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error("Usage: tsx server/gemini3ProAudio.ts <audio-file-path-or-url> [prompt]");
    console.error("");
    console.error("Examples:");
    console.error('  tsx server/gemini3ProAudio.ts ./audio.mp3 "Transcribe and summarize"');
    console.error('  tsx server/gemini3ProAudio.ts https://example.com/audio.mp3 "What is discussed?"');
    process.exit(1);
  }

  const audioPath = args[0];
  const prompt = args[1] || "Please transcribe this audio and provide a summary of the main points.";

  console.log(`Loading audio from: ${audioPath}`);
  console.log(`Prompt: ${prompt}`);
  console.log("");

  try {
    // Load audio file
    const { data: audioData, mimeType } = await loadAudioFile(audioPath);
    console.log(`Audio loaded: ${(audioData.length / 1024 / 1024).toFixed(2)} MB, MIME type: ${mimeType}`);
    console.log("Calling Gemini 3 Pro API...");
    console.log("");

    // Call Gemini API
    const result = await callGemini3Pro(audioData, mimeType, prompt);

    // Display results
    if (result.candidates && result.candidates.length > 0) {
      const candidate = result.candidates[0];
      if (candidate.content?.parts) {
        console.log("=== Response ===");
        for (const part of candidate.content.parts) {
          if (part.text) {
            console.log(part.text);
          }
        }
        console.log("");
        console.log(`Finish reason: ${candidate.finishReason}`);
      }
    } else {
      console.log("No response generated");
    }

    // Display usage metadata if available
    if (result.usageMetadata) {
      console.log("");
      console.log("=== Usage ===");
      console.log(`Prompt tokens: ${result.usageMetadata.promptTokenCount}`);
      console.log(`Candidates tokens: ${result.usageMetadata.candidatesTokenCount}`);
      console.log(`Total tokens: ${result.usageMetadata.totalTokenCount}`);
    }
  } catch (error) {
    console.error("Error:", error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Run main function
main();

export { callGemini3Pro, loadAudioFile };

