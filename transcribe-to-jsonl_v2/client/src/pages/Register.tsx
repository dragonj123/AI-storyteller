import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function Register() {
  const [, setLocation] = useLocation();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || "Registration failed");
        return;
      }

      toast.success("Registration successful! Please log in.");
      setLocation("/login");
    } catch (error) {
      toast.error("Registration failed. Please try again.");
      console.error("Registration error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="border-b-4 border-black py-6">
        <div className="container">
          <h1 className="text-2xl font-bold brutalist-bracket-left">TRANSCRIBE</h1>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center py-16">
        <div className="container max-w-md">
          <div className="brutalist-border p-8 bg-white">
            <h2 className="text-4xl font-bold mb-8">REGISTER</h2>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-lg font-bold">
                  NAME (OPTIONAL)
                </Label>
                <Input
                  id="name"
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="brutalist-border"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-lg font-bold">
                  EMAIL *
                </Label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="brutalist-border"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-lg font-bold">
                  PASSWORD *
                </Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  className="brutalist-border"
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full brutalist-border brutalist-shadow text-xl px-8 py-6 h-auto font-bold hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
              >
                {loading ? "[REGISTERING...]" : "[REGISTER]"}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <button
                onClick={() => setLocation("/login")}
                className="text-sm font-bold underline hover:no-underline"
              >
                ALREADY HAVE AN ACCOUNT? LOG IN
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}











