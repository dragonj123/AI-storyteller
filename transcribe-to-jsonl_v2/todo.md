# Project TODO

## Core Features
- [x] User authentication with role-based access control (admin and user roles)
- [x] Audio file upload with format validation (MP3, WAV, M4A, WebM, 16MB limit)
- [x] Audio transcription using Whisper API
- [x] Document upload with format validation (PDF, DOCX, TXT, MD)
- [x] Document text extraction
- [x] Slide upload with format validation (PPTX, PDF presentations)
- [x] Slide content extraction
- [x] JSONL output generation with timestamps for audio
- [x] JSONL output generation with page numbers for documents/slides
- [x] S3 storage for uploaded files
- [x] S3 storage for generated JSONL outputs
- [x] Processing history dashboard
- [x] Job status tracking (pending, processing, completed, failed)
- [x] Download functionality for JSONL files
- [x] Database schema for jobs metadata

## Design
- [x] Brutalist typography with heavy-weight sans-serif fonts
- [x] High-contrast black on white color scheme
- [x] Asymmetric layout with geometric lines
- [x] Abundant negative space
- [x] Industrial aesthetic

## Testing
- [x] Vitest tests for job creation and management
- [x] Vitest tests for user authorization
- [x] Vitest tests for admin access control
- [x] Vitest tests for job listing and retrieval

## Query Page Feature
- [x] Create query page component after file upload
- [x] Add chat-style input interface for user queries
- [x] Implement LLM integration for processing user requests
- [x] Store user query and LLM response with job metadata
- [x] Update job schema to include query and custom instructions
- [x] Display query results in dashboard
- [x] Allow users to skip or submit custom queries

## Local Setup Modifications
- [x] Replace Manus OAuth with email/password JWT authentication
- [ ] Add login and registration pages (frontend)
- [x] Replace Manus LLM API with OpenAI Chat API
- [x] Replace Manus Whisper API with OpenAI Whisper API
- [x] Replace S3 storage with local file system storage
- [x] Update environment variables for local setup
- [x] Create LOCAL_SETUP.md with setup documentation
- [ ] Test complete local workflow
