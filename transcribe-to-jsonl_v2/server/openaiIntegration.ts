import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
});

/**
 * Call OpenAI Chat API for LLM responses
 */
export async function invokeOpenAILLM(messages: Array<{ role: string; content: string }>) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: messages as any,
  });

  return response;
}

/**
 * Transcribe audio using OpenAI Whisper API
 */
export async function transcribeAudioWithOpenAI(audioUrl: string, language?: string) {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY environment variable is not set");
  }

  // Download the audio file first
  const audioResponse = await fetch(audioUrl);
  if (!audioResponse.ok) {
    throw new Error(`Failed to download audio: ${audioResponse.statusText}`);
  }

  const audioBuffer = await audioResponse.arrayBuffer();
  const audioBlob = new Blob([audioBuffer]);
  
  // Create a File object from the blob
  const audioFile = new File([audioBlob], "audio.mp3", { type: "audio/mpeg" });

  const response = await openai.audio.transcriptions.create({
    file: audioFile,
    model: "whisper-1",
    language: language,
    response_format: "verbose_json",
    timestamp_granularities: ["segment"],
  });

  return response;
}
