import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CalendarDays, MapPin, Megaphone, Pin, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader, EmptyState } from "@/components/shared";
import { formatDateTime, timeAgo } from "@/lib/format";

export const Route = createFileRoute("/bulletin")({
  head: () => ({
    meta: [
      { title: "Community Bulletin – Community Store" },
      { name: "description", content: "Announcements and events from the District 6 campus and community." },
      { property: "og:title", content: "Community Bulletin – Community Store" },
      { property: "og:description", content: "What's happening around District 6 and campus." },
    ],
  }),
  component: Bulletin,
});

function Bulletin() {
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<"announcement" | "event">("announcement");
  const [pinned, setPinned] = useState(false);

  const { data: posts = [] } = useQuery({
    queryKey: ["posts", "all"],
    queryFn: async () =>
      (await supabase.from("posts").select("*, author:profiles!posts_author_id_fkey(full_name,verified)").order("pinned", { ascending: false }).order("created_at", { ascending: false })).data ?? [],
  });
  const shown = posts.filter((p) => filter === "all" || p.kind === filter);

  const create = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const title = String(f.get("title")).trim();
    const body = String(f.get("body")).trim();
    if (title.length < 3 || body.length < 3) return toast.error("Please add a title and message");
    const date = String(f.get("event_date") ?? "");
    const { error } = await supabase.from("posts").insert({
      author_id: user!.id,
      kind,
      title,
      body,
      location: String(f.get("location") ?? "") || null,
      event_date: kind === "event" && date ? new Date(date).toISOString() : null,
      pinned: isAdmin && pinned,
    });
    if (error) return toast.error(error.message);
    toast.success("Posted to the bulletin");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["posts"] });
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this post?")) return;
    const { error } = await supabase.from("posts").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["posts"] });
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <PageHeader title="Community Bulletin" subtitle="Announcements, events and happenings around District 6.">
        {user ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus /> New post</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Share with the community</DialogTitle></DialogHeader>
              <form onSubmit={create} className="space-y-4">
                <Tabs value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
                  <TabsList className="grid w-full grid-cols-2"><TabsTrigger value="announcement">Announcement</TabsTrigger><TabsTrigger value="event">Event</TabsTrigger></TabsList>
                </Tabs>
                <div className="space-y-1.5"><Label>Title</Label><Input name="title" maxLength={120} required /></div>
                <div className="space-y-1.5"><Label>Message</Label><Textarea name="body" rows={4} maxLength={2000} required /></div>
                {kind === "event" && <div className="space-y-1.5"><Label>Date & time</Label><Input name="event_date" type="datetime-local" required /></div>}
                <div className="space-y-1.5"><Label>Location (optional)</Label><Input name="location" placeholder="e.g. Main Hall, CPUT District 6" /></div>
                {isAdmin && <div className="flex items-center gap-2"><Switch checked={pinned} onCheckedChange={setPinned} id="pin" /><Label htmlFor="pin">Pin to top</Label></div>}
                <Button className="w-full">Publish</Button>
              </form>
            </DialogContent>
          </Dialog>
        ) : (
          <Button asChild variant="outline"><Link to="/auth">Sign in to post</Link></Button>
        )}
      </PageHeader>
      <Tabs value={filter} onValueChange={setFilter} className="mb-6">
        <TabsList><TabsTrigger value="all">All</TabsTrigger><TabsTrigger value="announcement">Announcements</TabsTrigger><TabsTrigger value="event">Events</TabsTrigger></TabsList>
      </Tabs>
      {shown.length === 0 ? <EmptyState icon={Megaphone} title="Nothing here yet" text="Be the first to share an announcement or event." /> : (
        <div className="space-y-4">
          {shown.map((p) => (
            <article key={p.id} className={`rounded-2xl border bg-card p-5 shadow-card ${p.pinned ? "border-accent" : ""}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                  {p.pinned && <span className="inline-flex items-center gap-1 text-accent"><Pin className="h-3.5 w-3.5" /> Pinned</span>}
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${p.kind === "event" ? "bg-sky/20 text-primary" : "bg-warning/25 text-warning-foreground"}`}>
                    {p.kind === "event" ? <CalendarDays className="h-3.5 w-3.5" /> : <Megaphone className="h-3.5 w-3.5" />}{p.kind}
                  </span>
                </div>
                {(user?.id === p.author_id || isAdmin) && (
                  <Button variant="ghost" size="icon" onClick={() => remove(p.id)} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>
                )}
              </div>
              <h2 className="mt-2 text-xl font-semibold">{p.title}</h2>
              {(p.event_date || p.location) && (
                <div className="mt-1 flex flex-wrap gap-3 text-sm text-primary">
                  {p.event_date && <span className="inline-flex items-center gap-1"><CalendarDays className="h-4 w-4" />{formatDateTime(p.event_date)}</span>}
                  {p.location && <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" />{p.location}</span>}
                </div>
              )}
              <p className="mt-2 whitespace-pre-line text-muted-foreground">{p.body}</p>
              <div className="mt-3 text-xs text-muted-foreground">Posted by {p.author?.full_name} · {timeAgo(p.created_at)}</div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
