#!/usr/bin/env python3
"""
Script to transcribe audio and split by speaker using Whisper and speaker diarization

Usage:
    python scripts/transcribeWithSpeakers.py <audio-url-or-path> [options]
    
    Or with JSON input:
    echo '{"audioUrl": "https://example.com/audio.mp3", "output": "output.json"}' | python scripts/transcribeWithSpeakers.py

Options:
    --language LANGUAGE    Language code (e.g., "en", "es") - optional, auto-detected if not provided
    --min-speakers N       Minimum number of speakers (default: 1)
    --max-speakers N       Maximum number of speakers (default: None, auto-detect)
    --output-format FORMAT Output format: "json" (default), "text", or "srt"
    --output, -o FILE      Output file path (if not specified, output goes to stdout)

Environment variables:
    OPENAI_API_KEY         Your OpenAI API key (required for Whisper)
    HF_TOKEN               HuggingFace token (required for pyannote.audio speaker diarization)
                           Get one at: https://huggingface.co/settings/tokens

Dependencies:
    pip install openai pyannote.audio torch torchaudio
"""

import os
import sys
import json
import mimetypes
import argparse
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import urlopen
from typing import Dict, Any, List, Optional, Tuple
from datetime import timedelta

try:
    from openai import OpenAI
except ImportError:
    print("Error: openai package not installed. Install with: pip install openai", file=sys.stderr)
    sys.exit(1)

try:
    from pyannote.audio import Pipeline
except ImportError:
    print("Error: pyannote.audio package not installed. Install with: pip install pyannote.audio", file=sys.stderr)
    sys.exit(1)


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


def load_audio_file(file_path_or_url: str) -> Tuple[bytes, str, str]:
    """Load audio file from local path or URL, return (data, mime_type, temp_path)"""
    if is_url(file_path_or_url):
        # Download from URL
        try:
            with urlopen(file_path_or_url) as response:
                audio_data = response.read()
                mime_type = response.headers.get("Content-Type") or get_mime_type(file_path_or_url)
                
                # Save to temporary file for pyannote.audio
                import tempfile
                ext = Path(urlparse(file_path_or_url).path).suffix or ".mp3"
                temp_file = tempfile.NamedTemporaryFile(delete=False, suffix=ext)
                temp_file.write(audio_data)
                temp_file.close()
                
                return audio_data, mime_type, temp_file.name
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
        return audio_data, mime_type, str(file_path)


def transcribe_with_whisper(
    audio_data: bytes,
    mime_type: str,
    language: Optional[str] = None,
    prompt: Optional[str] = None
) -> Dict[str, Any]:
    """Transcribe audio using OpenAI Whisper API"""
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise ValueError("OPENAI_API_KEY environment variable is not set")
    
    client = OpenAI(api_key=api_key)
    
    import io
    audio_file = io.BytesIO(audio_data)
    audio_file.name = f"audio.{get_file_extension(mime_type)}"
    
    transcript = client.audio.transcriptions.create(
        file=audio_file,
        model="whisper-1",
        language=language,
        prompt=prompt,
        response_format="verbose_json",
        timestamp_granularities=["segment"]
    )
    
    result = {
        "task": "transcribe",
        "language": transcript.language,
        "duration": transcript.duration,
        "text": transcript.text,
        "segments": []
    }
    
    if hasattr(transcript, 'segments') and transcript.segments:
        for seg in transcript.segments:
            result["segments"].append({
                "id": seg.id,
                "seek": seg.seek,
                "start": seg.start,
                "end": seg.end,
                "text": seg.text,
                "tokens": seg.tokens if hasattr(seg, 'tokens') else [],
                "temperature": seg.temperature if hasattr(seg, 'temperature') else 0.0,
                "avg_logprob": seg.avg_logprob if hasattr(seg, 'avg_logprob') else 0.0,
                "compression_ratio": seg.compression_ratio if hasattr(seg, 'compression_ratio') else 0.0,
                "no_speech_prob": seg.no_speech_prob if hasattr(seg, 'no_speech_prob') else 0.0,
            })
    
    return result


def perform_speaker_diarization(
    audio_path: str,
    min_speakers: Optional[int] = None,
    max_speakers: Optional[int] = None
) -> List[Dict[str, Any]]:
    """Perform speaker diarization using pyannote.audio"""
    hf_token = os.getenv("HF_TOKEN")
    if not hf_token:
        raise ValueError("HF_TOKEN environment variable is not set. Get a token from https://huggingface.co/settings/tokens")
    
    # Load the pretrained speaker diarization pipeline
    pipeline = Pipeline.from_pretrained(
        "pyannote/speaker-diarization-3.1",
        use_auth_token=hf_token
    )
    
    # Run diarization
    diarization = pipeline(audio_path, min_speakers=min_speakers, max_speakers=max_speakers)
    
    # Convert to list of segments
    segments = []
    for turn, _, speaker in diarization.itertracks(yield_label=True):
        segments.append({
            "speaker": speaker,
            "start": turn.start,
            "end": turn.end,
            "duration": turn.end - turn.start
        })
    
    return segments


def align_transcription_with_speakers(
    transcription_segments: List[Dict[str, Any]],
    speaker_segments: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """Align transcription segments with speaker segments"""
    aligned_segments = []
    
    for trans_seg in transcription_segments:
        trans_start = trans_seg["start"]
        trans_end = trans_seg["end"]
        
        # Find the speaker segment that overlaps most with this transcription segment
        best_speaker = None
        best_overlap = 0
        
        for speaker_seg in speaker_segments:
            speaker_start = speaker_seg["start"]
            speaker_end = speaker_seg["end"]
            
            # Calculate overlap
            overlap_start = max(trans_start, speaker_start)
            overlap_end = min(trans_end, speaker_end)
            overlap = max(0, overlap_end - overlap_start)
            
            if overlap > best_overlap:
                best_overlap = overlap
                best_speaker = speaker_seg["speaker"]
        
        # Create aligned segment
        aligned_seg = {
            **trans_seg,
            "speaker": best_speaker if best_speaker else "UNKNOWN"
        }
        aligned_segments.append(aligned_seg)
    
    return aligned_segments


def format_timestamp(seconds: float) -> str:
    """Format seconds to HH:MM:SS.mmm"""
    td = timedelta(seconds=seconds)
    total_seconds = int(td.total_seconds())
    hours, remainder = divmod(total_seconds, 3600)
    minutes, seconds = divmod(remainder, 60)
    milliseconds = int((td.total_seconds() - total_seconds) * 1000)
    return f"{hours:02d}:{minutes:02d}:{seconds:02d}.{milliseconds:03d}"


def format_as_text(aligned_segments: List[Dict[str, Any]]) -> str:
    """Format aligned segments as readable text"""
    lines = []
    current_speaker = None
    
    for seg in aligned_segments:
        speaker = seg["speaker"]
        text = seg["text"].strip()
        
        if speaker != current_speaker:
            lines.append(f"\n[{speaker}]:")
            current_speaker = speaker
        
        lines.append(text)
    
    return "\n".join(lines).strip()


def format_as_srt(aligned_segments: List[Dict[str, Any]]) -> str:
    """Format aligned segments as SRT subtitle format"""
    lines = []
    
    for i, seg in enumerate(aligned_segments, 1):
        start_time = format_timestamp(seg["start"]).replace(".", ",")
        end_time = format_timestamp(seg["end"]).replace(".", ",")
        text = seg["text"].strip()
        speaker = seg["speaker"]
        
        lines.append(f"{i}")
        lines.append(f"{start_time} --> {end_time}")
        lines.append(f"[{speaker}] {text}")
        lines.append("")
    
    return "\n".join(lines)


def get_file_extension(mime_type: str) -> str:
    """Get file extension from MIME type"""
    mime_to_ext: Dict[str, str] = {
        'audio/webm': 'webm',
        'audio/mp3': 'mp3',
        'audio/mpeg': 'mp3',
        'audio/wav': 'wav',
        'audio/wave': 'wav',
        'audio/ogg': 'ogg',
        'audio/m4a': 'm4a',
        'audio/mp4': 'm4a',
        'audio/flac': 'flac',
        'audio/aac': 'aac',
    }
    return mime_to_ext.get(mime_type, 'mp3')


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
        description="Transcribe audio and split by speaker",
        formatter_class=argparse.RawDescriptionHelpFormatter
    )
    
    parser.add_argument(
        "audio",
        nargs="?",
        help="Audio file path or URL"
    )
    
    parser.add_argument(
        "--language",
        type=str,
        default=None,
        help="Language code (e.g., 'en', 'es') - auto-detected if not provided"
    )
    
    parser.add_argument(
        "--min-speakers",
        type=int,
        default=None,
        help="Minimum number of speakers"
    )
    
    parser.add_argument(
        "--max-speakers",
        type=int,
        default=None,
        help="Maximum number of speakers"
    )
    
    parser.add_argument(
        "--output-format",
        type=str,
        choices=["json", "text", "srt"],
        default="json",
        help="Output format: json (default), text, or srt"
    )
    
    parser.add_argument(
        "--output",
        "-o",
        type=str,
        default=None,
        help="Output file path (if not specified, output goes to stdout)"
    )
    
    args = parser.parse_args()
    
    # Get audio URL/path from args or input_data
    audio_url = args.audio or input_data.get("audioUrl")
    if not audio_url:
        parser.print_help()
        sys.exit(1)
    
    language = args.language or input_data.get("language")
    min_speakers = args.min_speakers or input_data.get("minSpeakers")
    max_speakers = args.max_speakers or input_data.get("maxSpeakers")
    output_format = args.output_format or input_data.get("outputFormat", "json")
    output_file = args.output or input_data.get("output")
    
    temp_file_path = None
    try:
        # Load audio file
        audio_data, mime_type, temp_file_path = load_audio_file(audio_url)
        
        # Check file size (16MB limit for Whisper)
        size_mb = len(audio_data) / (1024 * 1024)
        if size_mb > 16:
            print(json.dumps({
                "error": "Audio file exceeds maximum size limit",
                "code": "FILE_TOO_LARGE",
                "details": f"File size is {size_mb:.2f}MB, maximum allowed is 16MB"
            }), file=sys.stderr)
            sys.exit(1)
        
        # Step 1: Transcribe audio
        print("Transcribing audio with Whisper...", file=sys.stderr)
        transcription = transcribe_with_whisper(audio_data, mime_type, language)
        
        # Step 2: Perform speaker diarization
        print("Performing speaker diarization...", file=sys.stderr)
        speaker_segments = perform_speaker_diarization(
            temp_file_path,
            min_speakers=min_speakers,
            max_speakers=max_speakers
        )
        
        # Step 3: Align transcription with speakers
        print("Aligning transcription with speakers...", file=sys.stderr)
        aligned_segments = align_transcription_with_speakers(
            transcription["segments"],
            speaker_segments
        )
        
        # Step 4: Format output
        if output_format == "text":
            output = format_as_text(aligned_segments)
        elif output_format == "srt":
            output = format_as_srt(aligned_segments)
        else:  # json
            result = {
                "task": "transcribe",
                "language": transcription["language"],
                "duration": transcription["duration"],
                "text": transcription["text"],
                "speakers": list(set(seg["speaker"] for seg in aligned_segments)),
                "segments": aligned_segments
            }
            output = json.dumps(result, indent=2, ensure_ascii=False)
        
        # Write output to file or stdout
        if output_file:
            output_path = Path(output_file)
            if not output_path.is_absolute():
                output_path = Path.cwd() / output_path
            
            # Create parent directories if they don't exist
            output_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Write to file
            with open(output_path, "w", encoding="utf-8") as f:
                f.write(output)
            
            print(f"Output saved to: {output_path}", file=sys.stderr)
        else:
            # Print to stdout
            print(output)
    
    except ValueError as e:
        error_response = {
            "error": str(e),
            "code": "SERVICE_ERROR",
            "details": str(e)
        }
        print(json.dumps(error_response, indent=2), file=sys.stderr)
        sys.exit(1)
    
    except FileNotFoundError as e:
        error_response = {
            "error": "Audio file not found",
            "code": "INVALID_FORMAT",
            "details": str(e)
        }
        print(json.dumps(error_response, indent=2), file=sys.stderr)
        sys.exit(1)
    
    except Exception as e:
        error_response = {
            "error": "Transcription failed",
            "code": "TRANSCRIPTION_FAILED",
            "details": str(e)
        }
        print(json.dumps(error_response, indent=2), file=sys.stderr)
        sys.exit(1)
    
    finally:
        # Clean up temporary file if created
        if temp_file_path and is_url(audio_url) and os.path.exists(temp_file_path):
            try:
                os.unlink(temp_file_path)
            except Exception:
                pass


if __name__ == "__main__":
    main()

