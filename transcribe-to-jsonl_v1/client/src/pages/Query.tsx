import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Send, Loader2, CheckCircle2, Sparkles } from "lucide-react";
import { Link, useLocation, useRoute } from "wouter";
import { useState, useEffect } from "react";

export default function Query() {
  const { user, loading: authLoading } = useAuth();
  const [, params] = useRoute("/query/:jobId");
  const jobId = params?.jobId ? parseInt(params.jobId) : null;
  const [, navigate] = useLocation();
  
  const [query, setQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [customInstructions, setCustomInstructions] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);

  const { data: job, isLoading: jobLoading } = trpc.jobs.get.useQuery(
    { id: jobId! },
    { enabled: !!jobId }
  );

  const updateQueryMutation = trpc.jobs.updateQuery.useMutation();

  if (authLoading || jobLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-4xl font-bold">LOADING...</div>
      </div>
    );
  }

  if (!user || !job || !jobId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-4xl font-bold">NOT FOUND</div>
      </div>
    );
  }

  const handleSubmit = async () => {
    if (!query.trim()) return;

    setIsSubmitting(true);
    try {
      const result = await updateQueryMutation.mutateAsync({
        jobId,
        userQuery: query,
      });

      setCustomInstructions(result.customInstructions);
      setShowSuccess(true);
    } catch (error) {
      console.error("Query submission error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContinue = () => {
    navigate("/dashboard");
  };

  const handleSkip = () => {
    navigate("/dashboard");
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
        <div className="container max-w-4xl">
          <Link href="/dashboard">
            <Button variant="ghost" className="mb-8 text-lg font-bold">
              <ArrowLeft className="mr-2" strokeWidth={3} />
              BACK
            </Button>
          </Link>

          <div className="mb-12">
            <h2 className="text-6xl font-bold mb-6 brutalist-underline inline-block">
              CUSTOMIZE PROCESSING
            </h2>
            <p className="text-xl text-muted-foreground mb-4">
              File uploaded: <span className="font-bold text-foreground">{job.originalFileName}</span>
            </p>
            <p className="text-lg text-muted-foreground">
              Ask questions or provide specific instructions for how you'd like this file processed.
            </p>
          </div>

          {!showSuccess ? (
            <div className="space-y-8">
              {/* Query Input */}
              <div className="brutalist-border brutalist-shadow p-8 bg-white">
                <div className="flex items-center gap-3 mb-6">
                  <Sparkles className="w-8 h-8" strokeWidth={3} />
                  <h3 className="text-2xl font-bold">YOUR REQUEST</h3>
                </div>

                <Textarea
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Example: Extract only the speaker names and timestamps, or summarize the main topics discussed, or focus on technical terminology..."
                  className="min-h-[200px] text-lg brutalist-border resize-none mb-6 font-normal"
                  disabled={isSubmitting}
                />

                <div className="flex gap-4">
                  <Button
                    size="lg"
                    onClick={handleSubmit}
                    disabled={!query.trim() || isSubmitting}
                    className="brutalist-border brutalist-shadow text-xl px-8 py-6 h-auto font-bold hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 animate-spin" strokeWidth={3} />
                        PROCESSING...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2" strokeWidth={3} />
                        [SUBMIT REQUEST]
                      </>
                    )}
                  </Button>

                  <Button
                    size="lg"
                    variant="outline"
                    onClick={handleSkip}
                    disabled={isSubmitting}
                    className="brutalist-border text-xl px-8 py-6 h-auto font-bold hover:bg-secondary transition-all"
                  >
                    [SKIP - USE DEFAULT]
                  </Button>
                </div>
              </div>

              {/* Example Queries */}
              <div className="brutalist-border p-6 bg-secondary">
                <h4 className="text-lg font-bold mb-4">EXAMPLE REQUESTS:</h4>
                <ul className="space-y-2 text-base">
                  <li className="flex items-start gap-2">
                    <span className="font-bold">•</span>
                    <span>"Extract only timestamps and speaker identifications"</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold">•</span>
                    <span>"Summarize each section with key points"</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold">•</span>
                    <span>"Focus on technical terms and definitions"</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold">•</span>
                    <span>"Include sentiment analysis for each segment"</span>
                  </li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Success Message */}
              <div className="brutalist-border brutalist-shadow p-8 bg-white">
                <div className="flex items-center gap-4 mb-6">
                  <CheckCircle2 className="w-12 h-12 text-green-600" strokeWidth={3} />
                  <h3 className="text-3xl font-bold text-green-600">REQUEST RECEIVED</h3>
                </div>

                <div className="mb-8">
                  <h4 className="text-xl font-bold mb-3">YOUR QUERY:</h4>
                  <div className="p-4 border-4 border-black bg-secondary">
                    <p className="text-lg">{query}</p>
                  </div>
                </div>

                {customInstructions && (
                  <div className="mb-8">
                    <h4 className="text-xl font-bold mb-3">AI PROCESSING INSTRUCTIONS:</h4>
                    <div className="p-4 border-4 border-black bg-accent">
                      <p className="text-base whitespace-pre-wrap">{customInstructions}</p>
                    </div>
                  </div>
                )}

                <p className="text-lg text-muted-foreground mb-8">
                  Your file will be processed according to these custom instructions. You can monitor the progress in your dashboard.
                </p>

                <Button
                  size="lg"
                  onClick={handleContinue}
                  className="brutalist-border brutalist-shadow text-xl px-8 py-6 h-auto font-bold hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
                >
                  [GO TO DASHBOARD]
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
