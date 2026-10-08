import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/lib/auth";
import { errMsg } from "@/lib/format";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" && s.redirect.startsWith("/") ? s.redirect : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Sign in – Community Store" },
      { name: "description", content: "Sign in or create your Community Store account." },
      { property: "og:title", content: "Sign in – Community Store" },
      { property: "og:description", content: "Join the District 6 campus & local marketplace." },
    ],
  }),
  component: AuthPage,
});

const signUpSchema = z.object({
  full_name: z.string().trim().min(2, "Enter your name").max(80),
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

function AuthPage() {
  const { redirect } = Route.useSearch();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [userType, setUserType] = useState("student");
  const dest = redirect ?? "/marketplace";

  useEffect(() => {
    if (user) navigate({ to: dest });
  }, [user, dest, navigate]);

  const signIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: String(f.get("email")),
      password: String(f.get("password")),
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Welcome back!");
  };

  const signUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const parsed = signUpSchema.safeParse({
      full_name: f.get("full_name"),
      email: f.get("email"),
      password: f.get("password"),
    });
    if (!parsed.success) return toast.error(parsed.error.issues[0].message);
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          full_name: parsed.data.full_name,
          user_type: userType,
          business_name: userType === "vendor" ? String(f.get("business_name") ?? "") : null,
        },
      },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    if (!data.session) toast.success("Check your email to confirm your account, then sign in.");
  };

  const google = async () => {
    try {
      const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
      if (res.error) toast.error(errMsg(res.error));
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col px-4 py-12">
      <div className="mb-6 text-center">
        <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
          <Store className="h-6 w-6" />
        </span>
        <h1 className="text-3xl font-bold">Welcome to Community Store</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your District 6 campus & local marketplace</p>
      </div>
      <div className="rounded-2xl border bg-card p-6 shadow-card">
        <Tabs defaultValue="signin">
          <TabsList className="mb-5 grid w-full grid-cols-2">
            <TabsTrigger value="signin">Sign in</TabsTrigger>
            <TabsTrigger value="signup">Create account</TabsTrigger>
          </TabsList>
          <TabsContent value="signin">
            <form onSubmit={signIn} className="space-y-4">
              <div className="space-y-1.5"><Label htmlFor="si-email">Email</Label><Input id="si-email" name="email" type="email" required /></div>
              <div className="space-y-1.5"><Label htmlFor="si-pw">Password</Label><Input id="si-pw" name="password" type="password" required /></div>
              <Button className="w-full" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
            </form>
          </TabsContent>
          <TabsContent value="signup">
            <form onSubmit={signUp} className="space-y-4">
              <div className="space-y-1.5"><Label htmlFor="su-name">Full name</Label><Input id="su-name" name="full_name" required /></div>
              <div className="space-y-1.5">
                <Label>I am a…</Label>
                <Select value={userType} onValueChange={setUserType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="faculty">Faculty / Staff</SelectItem>
                    <SelectItem value="resident">Local resident</SelectItem>
                    <SelectItem value="vendor">Vendor / Business</SelectItem>
                  </SelectContent>
                </Select>
                {userType === "vendor" && <p className="text-xs text-muted-foreground">Vendor accounts are reviewed by an admin before receiving a verified badge.</p>}
              </div>
              {userType === "vendor" && (
                <div className="space-y-1.5"><Label htmlFor="su-biz">Business name</Label><Input id="su-biz" name="business_name" required /></div>
              )}
              <div className="space-y-1.5"><Label htmlFor="su-email">Email</Label><Input id="su-email" name="email" type="email" required /></div>
              <div className="space-y-1.5"><Label htmlFor="su-pw">Password</Label><Input id="su-pw" name="password" type="password" minLength={8} required /></div>
              <Button className="w-full" disabled={busy}>{busy ? "Creating…" : "Create account"}</Button>
            </form>
          </TabsContent>
        </Tabs>
        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><div className="h-px flex-1 bg-border" />or<div className="h-px flex-1 bg-border" /></div>
        <Button variant="outline" className="w-full" onClick={google}>Continue with Google</Button>
      </div>
    </div>
  );
}
