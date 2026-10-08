import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader, EmptyState } from "@/components/shared";
import { formatZAR, formatDateTime, statusLabel, errMsg } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/orders")({
  validateSearch: (s: Record<string, unknown>) => ({ placed: typeof s.placed === "string" ? s.placed : undefined }),
  head: () => ({ meta: [{ title: "My orders – Community Store" }, { name: "description", content: "Your order history and payment status." }] }),
  component: Orders,
});

export function StatusPill({ status }: { status: string }) {
  const cls: Record<string, string> = {
    pending: "bg-warning/25 text-warning-foreground",
    paid: "bg-sky/20 text-primary",
    processing: "bg-sky/20 text-primary",
    ready: "bg-accent/15 text-accent",
    completed: "bg-success/15 text-success",
    cancelled: "bg-destructive/15 text-destructive",
  };
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${cls[status] ?? "bg-muted"}`}>{statusLabel[status] ?? status}</span>;
}

const methodLabel: Record<string, string> = { card: "Card", instant_eft: "Instant EFT", cash_on_collection: "Cash on collection" };

function Orders() {
  const { user } = useAuth();
  const { placed } = Route.useSearch();
  const qc = useQueryClient();
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["orders", "mine", user?.id],
    queryFn: async () =>
      (await supabase.from("orders").select("*, items:order_items(*, seller:profiles!order_items_seller_id_fkey(id,full_name))").eq("buyer_id", user!.id).order("created_at", { ascending: false })).data ?? [],
  });

  const cancel = async (id: string) => {
    if (!confirm("Cancel this order? Paid orders are refunded (simulated).")) return;
    const { error } = await supabase.rpc("update_order_status", { _order: id, _status: "cancelled" });
    if (error) return toast.error(errMsg(error));
    toast.success("Order cancelled");
    qc.invalidateQueries({ queryKey: ["orders"] });
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <PageHeader title="My orders" subtitle="Track purchases, payments and collection." />
      {isLoading ? <p className="text-muted-foreground">Loading…</p> : orders.length === 0 ? (
        <EmptyState icon={Receipt} title="No orders yet" action={<Button asChild><Link to="/marketplace">Start shopping</Link></Button>} />
      ) : (
        <div className="space-y-4">
          {orders.map((o) => (
            <div key={o.id} className={`rounded-2xl border bg-card p-5 shadow-card ${placed === o.id ? "ring-2 ring-success" : ""}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-mono text-sm font-semibold">{o.payment_ref}</div>
                  <div className="text-xs text-muted-foreground">{formatDateTime(o.created_at)} · {methodLabel[o.payment_method]} · payment {o.payment_status}</div>
                </div>
                <StatusPill status={o.status} />
              </div>
              <div className="mt-4 space-y-2">
                {o.items.map((i) => (
                  <div key={i.id} className="flex items-center gap-3 text-sm">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">{i.image_url && <img src={i.image_url} alt="" className="h-full w-full object-cover" />}</div>
                    <div className="flex-1">
                      <div className="font-medium">{i.quantity} × {i.title}</div>
                      {i.seller && <Link to="/sellers/$id" params={{ id: i.seller.id }} className="text-xs text-primary">{i.seller.full_name} · rate seller</Link>}
                    </div>
                    <div>{formatZAR(i.price * i.quantity)}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between border-t pt-3">
                <span className="text-sm text-muted-foreground">{o.delivery_method === "delivery" ? `Delivery to ${o.delivery_address}` : "Collection / meet-up"}</span>
                <div className="flex items-center gap-3">
                  {["pending", "paid"].includes(o.status) && <Button size="sm" variant="outline" onClick={() => cancel(o.id)}>Cancel</Button>}
                  <span className="font-display text-lg font-bold">{formatZAR(o.total)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
