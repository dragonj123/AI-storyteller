#!/usr/bin/env python3
"""
Script to format JSON output into human-readable text

Usage:
    python server/format_output.py [input-file] [output-file]

Example:
    python server/format_output.py
    python server/format_output.py input.json output.txt
"""

import json
import re
import sys
from pathlib import Path


def read_json_file(file_path: str) -> dict:
    """Read JSON from a file"""
    json_path = Path(file_path)
    if not json_path.exists():
        raise FileNotFoundError(f"File not found: {json_path}")
    
    with open(json_path, "r", encoding="utf-8") as f:
        return json.load(f)


def extract_text_from_json(data: dict) -> str:
    """Extract text content from JSON structure"""
    # If it's a simple dict with "text" key
    if isinstance(data, dict) and "text" in data:
        return data["text"]
    
    # If it's nested in candidates/content/parts structure
    if isinstance(data, dict) and "candidates" in data:
        candidates = data.get("candidates", [])
        if candidates and len(candidates) > 0:
            candidate = candidates[0]
            if candidate.get("content") and candidate["content"].get("parts"):
                text_parts = []
                for part in candidate["content"]["parts"]:
                    if "text" in part:
                        text_parts.append(part["text"])
                return "\n".join(text_parts)
    
    # If it's already a string
    if isinstance(data, str):
        return data
    
    # Fallback: convert entire dict to formatted JSON string
    return json.dumps(data, indent=2, ensure_ascii=False)


def parse_mixed_json_and_text(text: str) -> str:
    """Parse text that may contain JSON mixed with regular text"""
    text = text.strip()
    result_parts = []
    
    # First, try parsing the entire text as JSON
    try:
        parsed = json.loads(text)
        return json.dumps(parsed, indent=2, ensure_ascii=False)
    except json.JSONDecodeError:
        pass
    
    # Try to extract JSON from markdown code blocks
    markdown_pattern = r'```(?:json)?\s*(\{.*?\}|\[.*?\])\s*```'
    markdown_matches = list(re.finditer(markdown_pattern, text, re.DOTALL))
    
    if markdown_matches:
        last_end = 0
        for match in markdown_matches:
            # Add text before this match
            if match.start() > last_end:
                result_parts.append(text[last_end:match.start()].strip())
            
            # Try to parse the JSON
            json_str = match.group(1)
            try:
                parsed = json.loads(json_str)
                result_parts.append(json.dumps(parsed, indent=2, ensure_ascii=False))
            except json.JSONDecodeError:
                # If parsing fails, keep as text
                result_parts.append(match.group(0))
            
            last_end = match.end()
        
        # Add remaining text
        if last_end < len(text):
            result_parts.append(text[last_end:].strip())
        
        return "\n\n".join(filter(None, result_parts))
    
    # Try to find and parse standalone JSON objects
    json_objects = []
    brace_count = 0
    start_idx = -1
    
    for i, char in enumerate(text):
        if char == '{':
            if brace_count == 0:
                start_idx = i
            brace_count += 1
        elif char == '}':
            brace_count -= 1
            if brace_count == 0 and start_idx != -1:
                json_candidate = text[start_idx:i+1]
                try:
                    parsed_obj = json.loads(json_candidate)
                    json_objects.append((start_idx, i+1, parsed_obj))
                except json.JSONDecodeError:
                    pass
                start_idx = -1
    
    # If we found JSON objects, format them and keep the rest as text
    if json_objects:
        result_parts = []
        last_end = 0
        
        for start, end, parsed_obj in json_objects:
            # Add text before this JSON object
            if start > last_end:
                before_text = text[last_end:start].strip()
                if before_text:
                    result_parts.append(before_text)
            
            # Add formatted JSON
            result_parts.append(json.dumps(parsed_obj, indent=2, ensure_ascii=False))
            last_end = end
        
        # Add remaining text
        if last_end < len(text):
            remaining = text[last_end:].strip()
            if remaining:
                result_parts.append(remaining)
        
        return "\n\n".join(result_parts)
    
    # No JSON found, return original text
    return text


def format_text_with_line_breaks(text: str) -> str:
    """Format text by replacing {} with newlines, parsing JSON when possible"""
    # Replace {} with newlines first
    formatted = text.replace('{}', '\n')
    
    # Try to parse JSON from the formatted text
    formatted = parse_mixed_json_and_text(formatted)
    
    # Clean up multiple consecutive newlines (keep max 2)
    formatted = re.sub(r'\n{3,}', '\n\n', formatted)
    
    # Strip leading/trailing whitespace
    formatted = formatted.strip()
    
    return formatted


def save_formatted_text(text: str, output_file: str) -> None:
    """Save formatted text to a file"""
    output_path = Path(output_file)
    if not output_path.is_absolute():
        output_path = Path.cwd() / output_path
    
    # Create parent directories if they don't exist
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(text)
    
    print(f"Formatted text saved to: {output_path}", file=sys.stderr)


def main():
    """Main function"""
    # Default input file
    input_file = sys.argv[1] if len(sys.argv) > 1 else "/Users/jasonwu/Documents/mock_output.json"
    
    # Generate output filename based on input
    if len(sys.argv) > 2:
        output_file = sys.argv[2]
    else:
        input_path = Path(input_file)
        output_file = str(input_path.with_suffix(".txt"))
    
    try:
        # Read JSON file
        print(f"Reading from: {input_file}", file=sys.stderr)
        json_data = read_json_file(input_file)
        
        # Extract text content
        text_content = extract_text_from_json(json_data)
        
        # Format with proper line breaks
        formatted_text = format_text_with_line_breaks(text_content)
        
        # Save to output file
        save_formatted_text(formatted_text, output_file)
        
        # Also print to stdout
        print(formatted_text)
    
    except Exception as error:
        print(f"Error: {error}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()

