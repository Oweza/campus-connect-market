import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CreditCard, Package, BadgeCheck, Flag, Info, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader, EmptyState } from "@/components/shared";
import { timeAgo } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({ meta: [{ title: "Notifications – Community Store" }, { name: "description", content: "Order, payment and vendor updates." }] }),
  component: Notifications,
});

const ICON: Record<string, React.ElementType> = { payment: CreditCard, order: Package, vendor: BadgeCheck, report: Flag, info: Info };

function Notifications() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => (await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(100)).data ?? [],
  });
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["notifications"] });
    qc.invalidateQueries({ queryKey: ["unread"] });
  };
  const markAll = async () => {
    await supabase.from("notifications").update({ read: true }).eq("read", false);
    refresh();
  };
  const markOne = async (id: string) => {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    refresh();
  };
  const remove = async (id: string) => {
    await supabase.from("notifications").delete().eq("id", id);
    refresh();
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <PageHeader title="Notifications">{data.some((n) => !n.read) && <Button variant="outline" onClick={markAll}>Mark all as read</Button>}</PageHeader>
      {data.length === 0 ? <EmptyState icon={Bell} title="You're all caught up" /> : (
        <div className="space-y-2">
          {data.map((n) => {
            const Icon = ICON[n.kind] ?? Info;
            return (
              <div key={n.id} className={`flex items-start gap-3 rounded-2xl border p-4 ${n.read ? "bg-card" : "border-primary/40 bg-primary/5"}`}>
                <div className="rounded-xl bg-secondary p-2"><Icon className="h-5 w-5 text-primary" /></div>
                <div className="flex-1">
                  <div className="font-semibold">{n.title}</div>
                  {n.body && <div className="text-sm text-muted-foreground">{n.body}</div>}
                  <div className="mt-1 flex gap-3 text-xs">
                    <span className="text-muted-foreground">{timeAgo(n.created_at)}</span>
                    {n.link && <Link to={n.link} onClick={() => markOne(n.id)} className="font-semibold text-primary">Open</Link>}
                    {!n.read && <button onClick={() => markOne(n.id)} className="text-muted-foreground hover:text-foreground">Mark read</button>}
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => remove(n.id)} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
