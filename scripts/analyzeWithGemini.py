#!/usr/bin/env python3
"""
Script to analyze text or audio using Gemini API with translation to English

Takes either text or audio input, translates to English if needed, then runs Gemini analysis.

Usage:
    # With text input
    python scripts/analyzeWithGemini.py --text "Your text here" --prompt "Assume you are a good analyst..."
    
    # With audio input
    python scripts/analyzeWithGemini.py --audio audio.mp3 --prompt "Assume you are a good analyst..."
    
    # With prompt file
    python scripts/analyzeWithGemini.py --text "Your text" --prompt-file prompt.txt
    
    # With JSON input
    echo '{"text": "Your text", "prompt": "Analyze this..."}' | python scripts/analyzeWithGemini.py

Options:
    --text TEXT              Text input to analyze
    --audio AUDIO           Audio file path or URL to transcribe and analyze
    --prompt PROMPT         Analysis prompt (e.g., "Assume you are a good analyst...")
    --prompt-file FILE      Path to file containing the prompt
    --output FILE           Output file path (default: stdout)
    --model MODEL           Gemini model to use (default: gemini-2.5-pro)

Environment variables:
    OPENAI_API_KEY          Your OpenAI API key (required for audio transcription and translation)
    GEMINI_API_KEY          Your Gemini API key (required for analysis)
"""

import os
import sys
import json
import base64
import mimetypes
import argparse
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import urlopen
from typing import Dict, Any, Optional, Tuple

try:
    from openai import OpenAI as OpenAIClient
except ImportError:
    print("Error: openai package not installed. Install with: pip install openai", file=sys.stderr)
    sys.exit(1)

# Gemini API configuration
GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


def get_mime_type(file_path: str) -> str:
    """Get MIME type from file extension or URL"""
    mime_type, _ = mimetypes.guess_type(file_path)
    if mime_type and mime_type.startswith("audio/"):
        return mime_type
    
    ext = Path(file_path).suffix.lower()
    mime_types = {
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".ogg": "audio/ogg",
        ".m4a": "audio/mp4",
        ".flac": "audio/flac",
        ".webm": "audio/webm",
        ".aac": "audio/aac",
        ".mp4": "audio/mp4",
    }
    return mime_types.get(ext, "audio/mpeg")


def is_url(path: str) -> bool:
    """Check if a string is a URL"""
    try:
        result = urlparse(path)
        return all([result.scheme, result.netloc])
    except Exception:
        return False


def load_audio_file(file_path_or_url: str) -> Tuple[bytes, str]:
    """Load audio file from local path or URL"""
    if is_url(file_path_or_url):
        try:
            with urlopen(file_path_or_url) as response:
                audio_data = response.read()
                mime_type = response.headers.get("Content-Type") or get_mime_type(file_path_or_url)
                return audio_data, mime_type
        except Exception as e:
            raise Exception(f"Failed to download audio: {e}")
    else:
        file_path = Path(file_path_or_url)
        if not file_path.is_absolute():
            file_path = Path.cwd() / file_path
        
        if not file_path.exists():
            raise FileNotFoundError(f"Audio file not found: {file_path}")
        
        with open(file_path, "rb") as f:
            audio_data = f.read()
        
        mime_type = get_mime_type(str(file_path))
        return audio_data, mime_type


def transcribe_audio(audio_data: bytes, mime_type: str) -> str:
    """Transcribe audio to text using OpenAI Whisper"""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY environment variable is not set")
    
    client = OpenAIClient(api_key=api_key)
    
    import io
    audio_file = io.BytesIO(audio_data)
    ext = Path(mime_type.split("/")[-1] if "/" in mime_type else "mp3").split(".")[-1]
    audio_file.name = f"audio.{ext}"
    
    transcript = client.audio.transcriptions.create(
        file=audio_file,
        model="whisper-1",
        response_format="text"
    )
    
    return transcript


def detect_language(text: str) -> str:
    """Detect language of text using OpenAI"""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY environment variable is not set")
    
    client = OpenAIClient(api_key=api_key)
    
    # Use a simple prompt to detect language
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": "You are a language detection expert. Respond with only the ISO 639-1 language code (e.g., 'en', 'es', 'fr', 'de', 'zh', 'ja'). If the text is already in English, respond with 'en'."
            },
            {
                "role": "user",
                "content": f"Detect the language of this text and respond with only the ISO 639-1 code:\n\n{text[:500]}"
            }
        ],
        temperature=0.1,
        max_tokens=10
    )
    
    detected_lang = response.choices[0].message.content.strip().lower()
    # Extract just the language code if there's extra text
    detected_lang = detected_lang.split()[0] if detected_lang else "en"
    
    return detected_lang


def translate_to_english(text: str, source_language: str) -> str:
    """Translate text to English using OpenAI"""
    if source_language == "en":
        return text
    
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY environment variable is not set")
    
    client = OpenAIClient(api_key=api_key)
    
    language_names = {
        "es": "Spanish",
        "fr": "French",
        "de": "German",
        "it": "Italian",
        "pt": "Portuguese",
        "ru": "Russian",
        "ja": "Japanese",
        "ko": "Korean",
        "zh": "Chinese",
        "ar": "Arabic",
        "hi": "Hindi",
    }
    
    source_lang_name = language_names.get(source_language, source_language)
    
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": f"You are a professional translator. Translate the following text from {source_lang_name} to English. Preserve the meaning, tone, and style. Return only the translated text without any explanations or additional text."
            },
            {
                "role": "user",
                "content": text
            }
        ],
        temperature=0.3
    )
    
    translated_text = response.choices[0].message.content.strip()
    return translated_text


def call_gemini_api(text: str, prompt: str, model: str = "gemini-2.5-pro") -> Dict[str, Any]:
    """Call Gemini API with text input"""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        # Try alternative env var name
        api_key = os.getenv("GEMINI_3_PRO_API_KEY")
    
    if not api_key:
        raise ValueError("GEMINI_API_KEY or GEMINI_3_PRO_API_KEY environment variable is not set")
    
    url = GEMINI_API_URL.format(model=model)
    url = f"{url}?key={api_key}"
    
    request_body = {
        "contents": [
            {
                "parts": [
                    {
                        "text": f"{prompt}\n\nText to analyze:\n{text}"
                    }
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.7,
            "topP": 0.95,
            "topK": 40,
            "maxOutputTokens": 8192,
        }
    }
    
    import urllib.request
    import urllib.error
    
    try:
        req = urllib.request.Request(
            url,
            data=json.dumps(request_body).encode("utf-8"),
            headers={"Content-Type": "application/json"}
        )
        
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode("utf-8"))
            return result
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8")
        raise Exception(f"Gemini API request failed: {e.code} {e.reason} - {error_body}")


def extract_text_from_gemini_response(result: Dict[str, Any]) -> str:
    """Extract text from Gemini API response"""
    if not result.get("candidates") or len(result["candidates"]) == 0:
        raise ValueError("No candidates in Gemini response")
    
    candidate = result["candidates"][0]
    if not candidate.get("content") or not candidate["content"].get("parts"):
        raise ValueError("No content parts in candidate")
    
    text_parts = []
    for part in candidate["content"]["parts"]:
        if "text" in part:
            text_parts.append(part["text"])
    
    if not text_parts:
        raise ValueError("No text found in content parts")
    
    return "\n".join(text_parts)


def read_prompt_from_file(prompt_file: str) -> str:
    """Read prompt from a text file"""
    prompt_path = Path(prompt_file)
    if not prompt_path.is_absolute():
        prompt_path = Path.cwd() / prompt_path
    
    if not prompt_path.exists():
        raise FileNotFoundError(f"Prompt file not found: {prompt_path}")
    
    with open(prompt_path, "r", encoding="utf-8") as f:
        return f.read().strip()


def main():
    """Main function"""
    # Check if input is JSON from stdin
    input_data = {}
    if not sys.stdin.isatty():
        try:
            input_data = json.load(sys.stdin)
        except json.JSONDecodeError:
            pass
    
    parser = argparse.ArgumentParser(
        description="Analyze text or audio with Gemini API after translating to English",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    
    parser.add_argument(
        "--text",
        type=str,
        default=None,
        help="Text input to analyze"
    )
    
    parser.add_argument(
        "--audio",
        type=str,
        default=None,
        help="Audio file path or URL to transcribe and analyze"
    )
    
    parser.add_argument(
        "--prompt",
        type=str,
        default=None,
        help="Analysis prompt (e.g., 'Assume you are a good analyst...')"
    )
    
    parser.add_argument(
        "--prompt-file",
        type=str,
        default=None,
        help="Path to file containing the prompt"
    )
    
    parser.add_argument(
        "--output",
        "-o",
        type=str,
        default=None,
        help="Output file path (default: stdout)"
    )
    
    parser.add_argument(
        "--model",
        type=str,
        default="gemini-2.5-pro",
        help="Gemini model to use (default: gemini-2.5-pro)"
    )
    
    args = parser.parse_args()
    
    # Get inputs from args or input_data
    text_input = args.text or input_data.get("text")
    audio_input = args.audio or input_data.get("audio")
    prompt = args.prompt or input_data.get("prompt")
    prompt_file = args.prompt_file or input_data.get("promptFile")
    output_file = args.output or input_data.get("output")
    model = args.model or input_data.get("model", "gemini-2.5-pro")
    
    # Validate inputs
    if not text_input and not audio_input:
        parser.error("Either --text or --audio must be provided")
    
    if text_input and audio_input:
        parser.error("Cannot provide both --text and --audio")
    
    if not prompt and not prompt_file:
        parser.error("Either --prompt or --prompt-file must be provided")
    
    try:
        # Step 1: Get text input (transcribe if audio)
        if audio_input:
            print("Transcribing audio...", file=sys.stderr)
            audio_data, mime_type = load_audio_file(audio_input)
            text_input = transcribe_audio(audio_data, mime_type)
            print(f"Transcribed text: {text_input[:100]}...", file=sys.stderr)
        
        if not text_input or not text_input.strip():
            raise ValueError("No text content to analyze")
        
        # Step 2: Detect language
        print("Detecting language...", file=sys.stderr)
        detected_lang = detect_language(text_input)
        print(f"Detected language: {detected_lang}", file=sys.stderr)
        
        # Step 3: Translate to English if needed
        if detected_lang != "en":
            print(f"Translating from {detected_lang} to English...", file=sys.stderr)
            text_input = translate_to_english(text_input, detected_lang)
            print("Translation complete.", file=sys.stderr)
        else:
            print("Text is already in English.", file=sys.stderr)
        

        prompt_file = './prompts/storytelling_v0.txt'
        # Step 4: Read prompt
        if prompt_file:
            prompt = read_prompt_from_file(prompt_file)
        
        if not prompt:
            raise ValueError("Prompt is required")
        
        # Step 5: Call Gemini API
        print("Calling Gemini API...", file=sys.stderr)
        gemini_response = call_gemini_api(text_input, prompt, model)
        
        # Step 6: Extract response text
        analysis_result = extract_text_from_gemini_response(gemini_response)
        
        # Step 7: Output result
        result = {
            "original_language": detected_lang,
            "translated_to_english": detected_lang != "en",
            "analysis": analysis_result,
            "full_response": gemini_response
        }
        
        output = json.dumps(result, indent=2, ensure_ascii=False)
        
        if output_file:
            output_path = Path(output_file)
            if not output_path.is_absolute():
                output_path = Path.cwd() / output_path
            
            output_path.parent.mkdir(parents=True, exist_ok=True)
            
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(output)
            
            print(f"Output saved to: {output_path}", file=sys.stderr)
        else:
            print(output)
    
    except ValueError as e:
        error_response = {
            "error": str(e),
            "code": "VALIDATION_ERROR",
            "details": str(e)
        }
        print(json.dumps(error_response, indent=2), file=sys.stderr)
        sys.exit(1)
    
    except FileNotFoundError as e:
        error_response = {
            "error": "File not found",
            "code": "FILE_NOT_FOUND",
            "details": str(e)
        }
        print(json.dumps(error_response, indent=2), file=sys.stderr)
        sys.exit(1)
    
    except Exception as e:
        error_response = {
            "error": "Analysis failed",
            "code": "ANALYSIS_FAILED",
            "details": str(e)
        }
        print(json.dumps(error_response, indent=2), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

