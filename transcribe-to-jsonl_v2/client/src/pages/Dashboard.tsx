import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Download, Loader2, CheckCircle2, XCircle, Clock, ArrowLeft } from "lucide-react";
import { Link } from "wouter";
import { formatDistanceToNow } from "date-fns";

export default function Dashboard() {
  const { user, loading: authLoading } = useAuth();
  const { data: jobs, isLoading: jobsLoading, refetch } = trpc.jobs.list.useQuery(undefined, {
    refetchInterval: 3000, // Refetch every 3 seconds to update status
  });

  if (authLoading || jobsLoading) {
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="w-6 h-6 text-green-600" strokeWidth={3} />;
      case "failed":
        return <XCircle className="w-6 h-6 text-destructive" strokeWidth={3} />;
      case "processing":
        return <Loader2 className="w-6 h-6 animate-spin" strokeWidth={3} />;
      default:
        return <Clock className="w-6 h-6" strokeWidth={3} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "text-green-600";
      case "failed":
        return "text-destructive";
      case "processing":
        return "text-blue-600";
      default:
        return "text-muted-foreground";
    }
  };

  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Download error:", error);
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
            <span className="text-lg font-bold">{user?.name || user?.email}</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 py-16">
        <div className="container max-w-6xl">
          <Link href="/">
            <Button variant="ghost" className="mb-8 text-lg font-bold">
              <ArrowLeft className="mr-2" strokeWidth={3} />
              BACK
            </Button>
          </Link>

          <div className="flex justify-between items-center mb-12">
            <h2 className="text-6xl font-bold brutalist-underline inline-block">
              DASHBOARD
            </h2>
            <Button
              onClick={() => refetch()}
              variant="outline"
              className="brutalist-border text-lg px-6 py-4 h-auto font-bold"
            >
              [REFRESH]
            </Button>
          </div>

          {!jobs || jobs.length === 0 ? (
            <div className="brutalist-border brutalist-shadow p-16 bg-white text-center">
              <p className="text-2xl font-bold mb-4">NO JOBS YET</p>
              <p className="text-lg text-muted-foreground mb-8">
                Upload your first file to get started
              </p>
              <Link href="/">
                <Button
                  size="lg"
                  className="brutalist-border brutalist-shadow text-xl px-8 py-6 h-auto font-bold hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
                >
                  [START UPLOADING]
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-6">
              {jobs.map((job) => (
                <div
                  key={job.id}
                  className="brutalist-border brutalist-shadow p-8 bg-white hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
                >
                  <div className="flex items-start justify-between gap-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-4">
                        {getStatusIcon(job.status)}
                        <div>
                          <h3 className="text-2xl font-bold">{job.originalFileName}</h3>
                          <p className={`text-lg font-bold uppercase ${getStatusColor(job.status)}`}>
                            {job.status}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-base">
                        <div>
                          <span className="font-bold">TYPE:</span> {job.jobType.toUpperCase()}
                        </div>
                        <div>
                          <span className="font-bold">SIZE:</span>{" "}
                          {job.fileSize ? `${(job.fileSize / 1024 / 1024).toFixed(2)} MB` : "N/A"}
                        </div>
                        <div>
                          <span className="font-bold">CREATED:</span>{" "}
                          {formatDistanceToNow(new Date(job.createdAt), { addSuffix: true })}
                        </div>
                        {job.completedAt && (
                          <div>
                            <span className="font-bold">COMPLETED:</span>{" "}
                            {formatDistanceToNow(new Date(job.completedAt), { addSuffix: true })}
                          </div>
                        )}
                      </div>

                      {job.userQuery && (
                        <div className="mt-4 p-4 border-4 border-black bg-accent">
                          <p className="text-base font-bold">USER REQUEST:</p>
                          <p className="text-sm">{job.userQuery}</p>
                        </div>
                      )}

                      {job.customInstructions && (
                        <div className="mt-4 p-4 border-4 border-black bg-secondary">
                          <p className="text-base font-bold">PROCESSING INSTRUCTIONS:</p>
                          <p className="text-sm whitespace-pre-wrap">{job.customInstructions}</p>
                        </div>
                      )}

                      {job.errorMessage && (
                        <div className="mt-4 p-4 border-4 border-destructive bg-destructive/10">
                          <p className="text-base font-bold text-destructive">ERROR MESSAGE:</p>
                          <p className="text-sm">{job.errorMessage}</p>
                        </div>
                      )}
                    </div>

                    {job.status === "completed" && job.jsonlUrl && (
                      <Button
                        onClick={() =>
                          handleDownload(
                            job.jsonlUrl!,
                            `${job.originalFileName.replace(/\.[^/.]+$/, "")}.jsonl`
                          )
                        }
                        className="brutalist-border brutalist-shadow text-lg px-6 py-4 h-auto font-bold hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all flex-shrink-0"
                      >
                        <Download className="mr-2" strokeWidth={3} />
                        [DOWNLOAD]
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
