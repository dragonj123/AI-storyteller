import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { getLoginUrl } from "@/const";
import { Upload, FileAudio, FileText, Presentation } from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  const { user, loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-4xl font-bold">LOADING...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col bg-background text-foreground">
        {/* Header */}
        <header className="border-b-4 border-black py-8">
          <div className="container">
            <h1 className="text-2xl font-bold brutalist-bracket-left">TRANSCRIBE</h1>
          </div>
        </header>

        {/* Hero Section */}
        <main className="flex-1 flex items-center">
          <div className="container">
            <div className="max-w-4xl">
              <h2 className="text-[8rem] leading-none font-bold mb-12 tracking-tight">
                CONVERT
                <br />
                TO JSONL
              </h2>
              
              <div className="space-y-8 mb-16">
                <div className="flex items-start gap-6">
                  <div className="brutalist-border p-4 bg-white">
                    <FileAudio className="w-12 h-12" strokeWidth={3} />
                  </div>
                  <div>
                    <h3 className="text-3xl font-bold mb-2">AUDIO TRANSCRIPTION</h3>
                    <p className="text-xl text-muted-foreground">MP3, WAV, M4A, WebM → Timestamped JSONL</p>
                  </div>
                </div>

                <div className="flex items-start gap-6">
                  <div className="brutalist-border p-4 bg-white">
                    <FileText className="w-12 h-12" strokeWidth={3} />
                  </div>
                  <div>
                    <h3 className="text-3xl font-bold mb-2">DOCUMENT EXTRACTION</h3>
                    <p className="text-xl text-muted-foreground">PDF, DOCX, TXT, MD → Structured JSONL</p>
                  </div>
                </div>

                <div className="flex items-start gap-6">
                  <div className="brutalist-border p-4 bg-white">
                    <Presentation className="w-12 h-12" strokeWidth={3} />
                  </div>
                  <div>
                    <h3 className="text-3xl font-bold mb-2">SLIDE PROCESSING</h3>
                    <p className="text-xl text-muted-foreground">PPTX, PDF Slides → Page-based JSONL</p>
                  </div>
                </div>
              </div>

              <a href={getLoginUrl()}>
                <Button 
                  size="lg" 
                  className="brutalist-border brutalist-shadow text-2xl px-12 py-8 h-auto font-bold hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
                >
                  [START PROCESSING]
                </Button>
              </a>
            </div>
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t-4 border-black py-6">
          <div className="container">
            <p className="text-sm font-bold">© 2025 TRANSCRIBE PLATFORM</p>
          </div>
        </footer>
      </div>
    );
  }

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
        <div className="container max-w-5xl">
          <h2 className="text-6xl font-bold mb-16 brutalist-underline inline-block">
            UPLOAD FILES
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Audio Upload */}
            <Link href="/upload/audio">
              <div className="brutalist-border brutalist-shadow p-8 bg-white hover:translate-x-2 hover:translate-y-2 hover:shadow-none transition-all cursor-pointer">
                <FileAudio className="w-16 h-16 mb-6" strokeWidth={3} />
                <h3 className="text-2xl font-bold mb-4">AUDIO</h3>
                <p className="text-base mb-4">Transcribe audio files to timestamped JSONL</p>
                <div className="text-sm font-bold text-muted-foreground">
                  MP3 • WAV • M4A • WebM
                </div>
              </div>
            </Link>

            {/* Document Upload */}
            <Link href="/upload/document">
              <div className="brutalist-border brutalist-shadow p-8 bg-white hover:translate-x-2 hover:translate-y-2 hover:shadow-none transition-all cursor-pointer">
                <FileText className="w-16 h-16 mb-6" strokeWidth={3} />
                <h3 className="text-2xl font-bold mb-4">DOCUMENT</h3>
                <p className="text-base mb-4">Extract text from documents to JSONL</p>
                <div className="text-sm font-bold text-muted-foreground">
                  PDF • DOCX • TXT • MD
                </div>
              </div>
            </Link>

            {/* Slide Upload */}
            <Link href="/upload/slide">
              <div className="brutalist-border brutalist-shadow p-8 bg-white hover:translate-x-2 hover:translate-y-2 hover:shadow-none transition-all cursor-pointer">
                <Presentation className="w-16 h-16 mb-6" strokeWidth={3} />
                <h3 className="text-2xl font-bold mb-4">SLIDES</h3>
                <p className="text-base mb-4">Process presentation slides to JSONL</p>
                <div className="text-sm font-bold text-muted-foreground">
                  PPTX • PDF
                </div>
              </div>
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
