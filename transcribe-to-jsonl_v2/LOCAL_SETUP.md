# Local Setup Guide

This guide explains how to run the Transcribe & Extract to JSONL application on your local machine without Manus platform dependencies.

## Prerequisites

- **Node.js** v22 or later
- **pnpm** package manager
- **MySQL** or **MariaDB** database server
- **OpenAI API Key** (for transcription and LLM features)

## Installation Steps

### 1. Install Dependencies

```bash
cd transcribe-to-jsonl
pnpm install
```

### 2. Set Up Database

Create a MySQL database for the application:

```sql
CREATE DATABASE transcribe_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### 3. Configure Environment Variables

Create a `.env` file in the project root with the following variables:

```env
# Database Configuration
DATABASE_URL=mysql://user:password@localhost:3306/transcribe_db

# JWT Secret for Authentication
# Generate a strong random string for production
JWT_SECRET=your-secret-key-change-this-in-production

# OpenAI API Configuration
# Get your API key from https://platform.openai.com/api-keys
OPENAI_API_KEY=sk-your-openai-api-key-here

# Local Storage Configuration
# Set to "true" to use local file system instead of S3
USE_LOCAL_STORAGE=true

# Local Storage Directory (optional, defaults to ./uploads)
LOCAL_STORAGE_DIR=./uploads

# Server Port (optional, defaults to 3000)
PORT=3000

# Node Environment
NODE_ENV=development
```

**Important:** Replace the placeholder values with your actual credentials:
- `DATABASE_URL`: Your MySQL connection string
- `JWT_SECRET`: A strong random string (you can generate one with `openssl rand -base64 32`)
- `OPENAI_API_KEY`: Your OpenAI API key from https://platform.openai.com/api-keys

### 4. Initialize Database Schema

Run the database migration to create all required tables:

```bash
pnpm db:push
```

This command will:
- Generate migration files from the schema
- Apply migrations to your database
- Create `users` and `jobs` tables

### 5. Start the Development Server

```bash
pnpm dev
```

The application will start on `http://localhost:3000` (or the port specified in your `.env` file).

## First Time Usage

### Create an Account

1. Navigate to `http://localhost:3000`
2. Click on "Register" or access `/register` directly
3. Enter your email, password, and name
4. Submit the registration form

### Login

1. Use your registered email and password to log in
2. You'll be redirected to the home page after successful authentication

## Features

The local setup includes all features from the Manus version:

- ✅ **User Authentication** - Email/password login with JWT tokens
- ✅ **Audio Transcription** - Using OpenAI Whisper API
- ✅ **Document Extraction** - PDF, DOCX, TXT, MD support
- ✅ **Slide Processing** - PPTX and PDF presentations
- ✅ **Custom Query Processing** - AI-powered processing instructions using OpenAI GPT
- ✅ **Local File Storage** - Files stored in `./uploads` directory
- ✅ **Processing History** - Dashboard to view all jobs
- ✅ **JSONL Download** - Download processed results

## API Costs

This application uses OpenAI APIs which have associated costs:

- **Whisper API**: ~$0.006 per minute of audio
- **GPT-4o-mini API**: ~$0.15 per million input tokens, ~$0.60 per million output tokens

Monitor your usage at https://platform.openai.com/usage

## Troubleshooting

### Database Connection Issues

If you see database connection errors:

1. Verify MySQL is running: `mysql --version`
2. Check your `DATABASE_URL` in `.env`
3. Ensure the database exists and user has proper permissions

### OpenAI API Errors

If transcription or query processing fails:

1. Verify your `OPENAI_API_KEY` is correct
2. Check your OpenAI account has available credits
3. Review API usage limits at https://platform.openai.com/account/limits

### File Upload Issues

If file uploads fail:

1. Ensure `USE_LOCAL_STORAGE=true` in `.env`
2. Check write permissions for the `LOCAL_STORAGE_DIR`
3. Verify the directory exists or can be created

### Port Already in Use

If port 3000 is already in use:

1. Change `PORT` in `.env` to another port (e.g., 3001)
2. Or stop the process using port 3000

## Production Deployment

For production deployment:

1. Set `NODE_ENV=production`
2. Use a strong `JWT_SECRET`
3. Configure proper database backups
4. Set up HTTPS/SSL certificates
5. Use a process manager like PM2:

```bash
pnpm build
pm2 start dist/index.js --name transcribe-app
```

## File Structure

```
transcribe-to-jsonl/
├── client/               # Frontend React application
├── server/              # Backend Express + tRPC server
│   ├── localAuth.ts     # JWT authentication
│   ├── localStorage.ts  # Local file storage
│   ├── openaiIntegration.ts  # OpenAI API integration
│   ├── processing.ts    # File processing logic
│   └── routers.ts       # tRPC API routes
├── drizzle/            # Database schema and migrations
├── uploads/            # Local file storage (created automatically)
└── .env                # Environment configuration (create this)
```

## Support

For issues specific to the local setup, check:
- OpenAI API documentation: https://platform.openai.com/docs
- MySQL documentation: https://dev.mysql.com/doc/
- Node.js documentation: https://nodejs.org/docs/

## License

MIT
