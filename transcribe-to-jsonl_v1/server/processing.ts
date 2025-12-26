import { transcribeAudio } from "./_core/voiceTranscription";
import mammoth from "mammoth";
import axios from "axios";
import officeParser from "officeparser";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

export interface AudioTranscriptionSegment {
  timestamp: string;
  text: string;
  start: number;
  end: number;
}

export interface DocumentPage {
  page: number;
  content: string;
}

export interface SlideContent {
  slide: number;
  title?: string;
  content: string;
}

/**
 * Transcribe audio file and convert to JSONL format
 */
export async function processAudioToJsonl(audioUrl: string): Promise<string> {
  const result = await transcribeAudio({
    audioUrl,
  });

  // Check if transcription was successful
  if ('error' in result) {
    throw new Error(`Transcription failed: ${result.error}`);
  }

  const jsonlLines: string[] = [];

  if (result.segments && result.segments.length > 0) {
    for (const segment of result.segments) {
      const entry: AudioTranscriptionSegment = {
        timestamp: formatTimestamp(segment.start),
        text: segment.text.trim(),
        start: segment.start,
        end: segment.end,
      };
      jsonlLines.push(JSON.stringify(entry));
    }
  } else {
    // Fallback if no segments available
    const entry: AudioTranscriptionSegment = {
      timestamp: "00:00:00",
      text: result.text,
      start: 0,
      end: 0,
    };
    jsonlLines.push(JSON.stringify(entry));
  }

  return jsonlLines.join("\n");
}

/**
 * Extract text from document and convert to JSONL format
 */
export async function processDocumentToJsonl(
  fileUrl: string,
  mimeType: string
): Promise<string> {
  const response = await axios.get(fileUrl, { responseType: "arraybuffer" });
  const buffer = Buffer.from(response.data);

  let pages: DocumentPage[] = [];

  if (mimeType === "application/pdf") {
    const pdfData = await pdfParse(buffer);
    const text = pdfData.text;
    // Split by page breaks (heuristic approach)
    const pageTexts = text.split(/\f|\n{3,}/);
    pages = pageTexts.map((content: string, index: number) => ({
      page: index + 1,
      content: content.trim(),
    })).filter((p: DocumentPage) => p.content.length > 0);
  } else if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const result = await mammoth.extractRawText({ buffer });
    pages = [{ page: 1, content: result.value.trim() }];
  } else if (mimeType === "text/plain" || mimeType === "text/markdown") {
    const text = buffer.toString("utf-8");
    pages = [{ page: 1, content: text.trim() }];
  } else {
    throw new Error(`Unsupported document type: ${mimeType}`);
  }

  const jsonlLines = pages.map((page) => JSON.stringify(page));
  return jsonlLines.join("\n");
}

/**
 * Extract content from slides and convert to JSONL format
 */
export async function processSlidesToJsonl(
  fileUrl: string,
  mimeType: string
): Promise<string> {
  const response = await axios.get(fileUrl, { responseType: "arraybuffer" });
  const buffer = Buffer.from(response.data);

  let slides: SlideContent[] = [];

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  ) {
    const text = await officeParser.parseOfficeAsync(buffer);
    // Split by slide markers or use heuristics
    const slideTexts = text.split(/Slide \d+|\n{3,}/).filter((s: string) => s.trim().length > 0);
    slides = slideTexts.map((content: string, index: number) => ({
      slide: index + 1,
      content: content.trim(),
    }));
  } else if (mimeType === "application/pdf") {
    // For PDF presentations, treat each page as a slide
    const pdfData = await pdfParse(buffer);
    const pageTexts = pdfData.text.split(/\f/);
    slides = pageTexts.map((content: string, index: number) => ({
      slide: index + 1,
      content: content.trim(),
    })).filter((s: SlideContent) => s.content.length > 0);
  }
  
  if (slides.length === 0) {
    throw new Error(`No content extracted from slide file`);
  }

  const jsonlLines = slides.map((slide) => JSON.stringify(slide));
  return jsonlLines.join("\n");
}

/**
 * Format seconds to HH:MM:SS timestamp
 */
function formatTimestamp(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  return [hours, minutes, secs]
    .map((v) => v.toString().padStart(2, "0"))
    .join(":");
}
