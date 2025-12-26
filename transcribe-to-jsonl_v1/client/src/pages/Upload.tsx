import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Upload as UploadIcon, ArrowLeft, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Link, useLocation, useRoute } from "wouter";
import { useState, useRef } from "react";
import { storagePut } from "../../../server/storage";
import { nanoid } from "nanoid";

const FILE_CONFIGS = {
  audio: {
    title: "AUDIO TRANSCRIPTION",
    accept: ".mp3,.wav,.m4a,.webm,audio/*",
    maxSize: 16 * 1024 * 1024, // 16MB
    formats: "MP3, WAV, M4A, WebM",
  },
  document: {
    title: "DOCUMENT EXTRACTION",
    accept: ".pdf,.docx,.txt,.md",
    maxSize: 50 * 1024 * 1024, // 50MB
    formats: "PDF, DOCX, TXT, MD",
  },
  slide: {
    title: "SLIDE PROCESSING",
    accept: ".pptx,.pdf",
    maxSize: 50 * 1024 * 1024, // 50MB
    formats: "PPTX, PDF",
  },
};

export default function Upload() {
  const { user, loading: authLoading } = useAuth();
  const [, params] = useRoute("/upload/:type");
  const type = params?.type as keyof typeof FILE_CONFIGS;
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createJobMutation = trpc.jobs.create.useMutation();

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-4xl font-bold">LOADING...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-4xl font-bold">UNAUTHORIZED</div>
      </div>
    );
  }

  if (!type || !FILE_CONFIGS[type]) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-4xl font-bold">INVALID TYPE</div>
      </div>
    );
  }

  const config = FILE_CONFIGS[type];

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > config.maxSize) {
      setUploadError(`File size exceeds ${config.maxSize / 1024 / 1024}MB limit`);
      return;
    }

    setSelectedFile(file);
    setUploadError(null);
    setUploadSuccess(false);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setUploadError(null);

    try {
      // Read file as buffer
      const arrayBuffer = await selectedFile.arrayBuffer();
      const buffer = new Uint8Array(arrayBuffer);

      // Upload to S3
      const fileKey = `uploads/${user.id}/${type}/${nanoid()}-${selectedFile.name}`;
      
      // Convert Uint8Array to base64 for fetch
      const base64 = btoa(String.fromCharCode.apply(null, Array.from(buffer)));
      
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileKey,
          fileData: base64,
          mimeType: selectedFile.type,
        }),
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      const { url } = await response.json();

      // Create job
      const job = await createJobMutation.mutateAsync({
        jobType: type,
        originalFileName: selectedFile.name,
        originalFileUrl: url,
        originalFileKey: fileKey,
        mimeType: selectedFile.type,
        fileSize: selectedFile.size,
      });

      // Redirect to query page
      window.location.href = `/query/${job.id}`;
    } catch (error) {
      console.error("Upload error:", error);
      setUploadError(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <header className="border-b-4 border-black py-6">
        <div className="container flex justify-between items-center">
          <Link href="/">
            <h1 className="text-2xl font-bold brutalist-bracket-left cursor-pointer">TRANSCRIBE</h1>
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/dashboard">
              <Button variant="ghost" className="text-lg font-bold">
                [DASHBOARD]
              </Button>
            </Link>
            <span className="text-lg font-bold">{user?.name || user?.email}</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 py-16">
        <div className="container max-w-3xl">
          <Link href="/">
            <Button variant="ghost" className="mb-8 text-lg font-bold">
              <ArrowLeft className="mr-2" strokeWidth={3} />
              BACK
            </Button>
          </Link>

          <h2 className="text-6xl font-bold mb-4 brutalist-underline inline-block">
            {config.title}
          </h2>
          <p className="text-xl text-muted-foreground mb-12">
            Supported formats: {config.formats}
          </p>

          {/* Upload Area */}
          <div className="brutalist-border brutalist-shadow p-12 bg-white mb-8">
            <input
              ref={fileInputRef}
              type="file"
              accept={config.accept}
              onChange={handleFileSelect}
              className="hidden"
              id="file-input"
            />
            
            <label
              htmlFor="file-input"
              className="block cursor-pointer"
            >
              <div className="flex flex-col items-center justify-center py-12 border-4 border-dashed border-black hover:bg-secondary transition-colors">
                <UploadIcon className="w-16 h-16 mb-4" strokeWidth={3} />
                <p className="text-2xl font-bold mb-2">CLICK TO SELECT FILE</p>
                <p className="text-base text-muted-foreground">
                  Max size: {config.maxSize / 1024 / 1024}MB
                </p>
              </div>
            </label>

            {selectedFile && (
              <div className="mt-8 p-6 border-4 border-black bg-secondary">
                <p className="text-xl font-bold mb-2">SELECTED FILE:</p>
                <p className="text-lg mb-1">{selectedFile.name}</p>
                <p className="text-base text-muted-foreground">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            )}

            {uploadError && (
              <div className="mt-8 p-6 border-4 border-black bg-destructive/10 flex items-start gap-4">
                <XCircle className="w-6 h-6 flex-shrink-0 text-destructive" strokeWidth={3} />
                <div>
                  <p className="text-lg font-bold text-destructive">ERROR</p>
                  <p className="text-base">{uploadError}</p>
                </div>
              </div>
            )}

            {uploadSuccess && (
              <div className="mt-8 p-6 border-4 border-black bg-green-50 flex items-start gap-4">
                <CheckCircle2 className="w-6 h-6 flex-shrink-0 text-green-600" strokeWidth={3} />
                <div>
                  <p className="text-lg font-bold text-green-600">SUCCESS</p>
                  <p className="text-base">File uploaded and processing started</p>
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-4">
            <Button
              size="lg"
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
              className="brutalist-border brutalist-shadow text-xl px-8 py-6 h-auto font-bold hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 animate-spin" strokeWidth={3} />
                  UPLOADING...
                </>
              ) : (
                "[UPLOAD & PROCESS]"
              )}
            </Button>


          </div>
        </div>
      </main>
    </div>
  );
}
