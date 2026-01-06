#!/usr/bin/env python3
"""
Script to call Gemini 2.5 Pro with audio input

Usage:
    python server/gemini3ProAudio.py <audio-file-path-or-url> [prompt] [output-file]

Example:
    python server/gemini3ProAudio.py ./audio.mp3 "Transcribe this audio and summarize the main points"
    python server/gemini3ProAudio.py https://example.com/audio.mp3 "What is the speaker discussing?" output.json

Environment variable:
    GEMINI_3_PRO_API_KEY - Your Gemini 2.5 Pro API key (placeholder: YOUR_GEMINI_3_PRO_API_KEY)
"""

import os
import sys
import base64
import json
import mimetypes
import re
from datetime import datetime
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import urlopen
from typing import Dict, Any, Tuple, Optional


# Placeholder API key - replace with your actual key or set via environment variable
# GEMINI_API_KEY = os.getenv("GEMINI_3_PRO_API_KEY", "YOUR_GEMINI_3_PRO_API_KEY")
GEMINI_API_KEY = 'AIzaSyCe8-YlTbZsUxtaoPTlQrDPZidv1SCmEm8'
# Gemini API endpoint
GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent"


 # first schema, sales calls





def get_mime_type(file_path: str) -> str:
    """Get MIME type from file extension or URL"""
    # Try mimetypes module first
    mime_type, _ = mimetypes.guess_type(file_path)
    if mime_type and mime_type.startswith("audio/"):
        return mime_type
    
    # Fallback to extension mapping
    ext = Path(file_path).suffix.lower()
    mime_types = {
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".ogg": "audio/ogg",
        ".m4a": "audio/mp4",
        ".flac": "audio/flac",
        ".webm": "audio/webm",
        ".aac": "audio/aac",
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
        # Download from URL
        try:
            with urlopen(file_path_or_url) as response:
                audio_data = response.read()
                mime_type = response.headers.get("Content-Type") or get_mime_type(file_path_or_url)
                return audio_data, mime_type
        except Exception as e:
            raise Exception(f"Failed to download audio: {e}")
    else:
        # Read from local file
        file_path = Path(file_path_or_url)
        if not file_path.is_absolute():
            file_path = Path.cwd() / file_path
        
        if not file_path.exists():
            raise FileNotFoundError(f"Audio file not found: {file_path}")
        
        with open(file_path, "rb") as f:
            audio_data = f.read()
        
        mime_type = get_mime_type(str(file_path))
        return audio_data, mime_type


def buffer_to_base64(buffer: bytes) -> str:
    """Convert audio buffer to base64"""
    return base64.b64encode(buffer).decode("utf-8")


def call_gemini_2_5_pro(audio_data: bytes, mime_type: str, prompt: str) -> Dict[str, Any]:
    """Call Gemini 2.5 Pro API with audio input"""
    if GEMINI_API_KEY == "YOUR_GEMINI_3_PRO_API_KEY":
        raise ValueError(
            "Please set GEMINI_3_PRO_API_KEY environment variable or replace the placeholder in the script"
        )
    
    audio_base64 = buffer_to_base64(audio_data)
    
    request_body = {
        "contents": [
            {
                "parts": [
                    {
                        "inlineData": {
                            "mimeType": mime_type,
                            "data": audio_base64,
                        }
                    },
                    {
                        "text": prompt
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
    
    url = f"{GEMINI_API_URL}?key={GEMINI_API_KEY}"
    
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


def generate_output_filename(audio_path: str) -> str:
    """Generate output filename based on input audio file"""
    if is_url(audio_path):
        # For URLs, use timestamp-based filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        return f"gemini_response_{timestamp}.json"
    else:
        # For local files, use the same name with .json extension
        audio_file = Path(audio_path)
        if not audio_file.is_absolute():
            audio_file = Path.cwd() / audio_file
        return str(audio_file.with_suffix(".json"))


def read_prompt_from_file(prompt_file: str = "prompt.txt") -> str:
    """Read prompt from a text file"""
    prompt_path = Path(prompt_file)
    if not prompt_path.is_absolute():
        prompt_path = Path.cwd() / prompt_path
    
    if not prompt_path.exists():
        raise FileNotFoundError(f"Prompt file not found: {prompt_path}")
    
    with open(prompt_path, "r", encoding="utf-8") as f:
        return f.read().strip()


def extract_json_from_response(result: Dict[str, Any]) -> Dict[str, Any]:
    """Extract and parse JSON from the text response in candidates content parts"""
    if not result.get("candidates") or len(result["candidates"]) == 0:
        raise ValueError("No candidates in response")
    
    candidate = result["candidates"][0]
    if not candidate.get("content") or not candidate["content"].get("parts"):
        raise ValueError("No content parts in candidate")
    
    # Extract text from all parts
    text_parts = []
    for part in candidate["content"]["parts"]:
        if "text" in part:
            text_parts.append(part["text"])
    
    if not text_parts:
        raise ValueError("No text found in content parts")
    
    # Combine all text parts
    combined_text = "\n".join(text_parts)
    
    # Try to extract JSON from the text (might be wrapped in markdown code blocks)
    # Try to find JSON in markdown code blocks
    json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', combined_text, re.DOTALL)
    if json_match:
        json_str = json_match.group(1)
    else:
        # Try to find JSON object directly
        json_match = re.search(r'\{.*\}', combined_text, re.DOTALL)
        if json_match:
            json_str = json_match.group(0)
        else:
            # If no JSON found, return the text as-is wrapped in a dict
            return {"text": combined_text}
    
    # Parse the JSON string
    try:
        return json.loads(json_str)
    except json.JSONDecodeError:
        # If parsing fails, format text with {} to indicate new lines
        lines = combined_text.split('\n')
        formatted_text = '{}'.join(lines)
        return {"text": formatted_text}


def save_json_to_file(data: Dict[str, Any], output_file: str) -> None:
    """Save JSON data to a file"""
    output_path = Path(output_file)
    if not output_path.is_absolute():
        output_path = Path.cwd() / output_path
    
    # Create parent directories if they don't exist
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    
    print(f"Response saved to: {output_path}", file=sys.stderr)


def main():
    """Main function"""
    if len(sys.argv) < 2:
        print("Usage: python server/gemini3ProAudio.py <audio-file-path-or-url> [prompt] [output-file]", file=sys.stderr)
        print("", file=sys.stderr)
        print("Examples:", file=sys.stderr)
        print('  python server/gemini3ProAudio.py ./audio.mp3 "Transcribe and summarize"', file=sys.stderr)
        print('  python server/gemini3ProAudio.py https://example.com/audio.mp3 "What is discussed?" output.json', file=sys.stderr)
        sys.exit(1)
    
    audio_path = sys.argv[1]
    prompt = sys.argv[2] if len(sys.argv) > 2 else "Please transcribe this audio and provide a summary of the main points."
    output_file = sys.argv[3] if len(sys.argv) > 3 else None

    prompt = read_prompt_from_file("/Users/jasonwu/Downloads/mock_pitch/prompt.txt") 
    print(prompt[:10])
    try:
        # Load audio file
        audio_data, mime_type = load_audio_file(audio_path)
        
        # Call Gemini API
        result = call_gemini_2_5_pro(audio_data, mime_type, prompt)
        print('Done')
        
        # Extract and parse JSON from the text response
        parsed_json = extract_json_from_response(result)
        
        # Determine output filename
        if output_file is None:
            output_file = generate_output_filename(audio_path)
        output_file = '/Users/jasonwu/Documents/mock_output.json'
        
        # Save only the parsed JSON to file
        save_json_to_file(parsed_json, output_file)
        
        # Also output to stdout for piping/parsing
        print(json.dumps(parsed_json, indent=2, ensure_ascii=False))
    
    except Exception as error:
        error_response = {
            "error": str(error),
            "error_type": type(error).__name__
        }
        print(json.dumps(error_response, indent=2, ensure_ascii=False), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

