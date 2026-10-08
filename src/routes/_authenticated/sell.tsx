import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Eye, EyeOff, Package, BadgeCheck, Clock, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ProductForm } from "@/components/ProductForm";
import { PageHeader, EmptyState } from "@/components/shared";
import { formatZAR, formatDateTime, errMsg } from "@/lib/format";
import { StatusPill } from "./orders";
import type { Database } from "@/integrations/supabase/types";

type Product = Database["public"]["Tables"]["products"]["Row"];

export const Route = createFileRoute("/_authenticated/sell")({
  head: () => ({ meta: [{ title: "My shop – Community Store" }, { name: "description", content: "Manage your listings and sales." }] }),
  component: SellPage,
});

function SellPage() {
  const { user, profile, refreshProfile } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Product | "new" | null>(null);

  const { data: products = [] } = useQuery({
    queryKey: ["my-products", user?.id],
    queryFn: async () => (await supabase.from("products").select("*").eq("seller_id", user!.id).order("created_at", { ascending: false })).data ?? [],
  });
  const { data: sales = [] } = useQuery({
    queryKey: ["orders", "sales", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("order_items")
        .select("*, order:orders(id,status,payment_ref,payment_method,payment_status,created_at,delivery_method,delivery_address,phone,notes,buyer:profiles!orders_buyer_id_fkey(full_name))")
        .eq("seller_id", user!.id);
      return data ?? [];
    },
  });

  const grouped = Object.values(
    sales.reduce<Record<string, { order: NonNullable<(typeof sales)[number]["order"]>; items: typeof sales }>>((acc, s) => {
      if (!s.order) return acc;
      (acc[s.order.id] ??= { order: s.order, items: [] }).items.push(s);
      return acc;
    }, {}),
  ).sort((a, b) => b.order.created_at.localeCompare(a.order.created_at));
  const revenue = grouped.filter((g) => g.order.status !== "cancelled").reduce((s, g) => s + g.items.reduce((t, i) => t + i.price * i.quantity, 0), 0);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["my-products"] });
    qc.invalidateQueries({ queryKey: ["products"] });
  };
  const toggle = async (p: Product) => {
    const { error } = await supabase.from("products").update({ status: p.status === "active" ? "hidden" : "active" }).eq("id", p.id);
    if (error) toast.error(error.message);
    refresh();
  };
  const remove = async (p: Product) => {
    if (!confirm(`Delete "${p.title}"? This cannot be undone.`)) return;
    const { error } = await supabase.from("products").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Listing deleted");
    refresh();
  };
  const setStatus = async (orderId: string, status: string) => {
    const { error } = await supabase.rpc("update_order_status", { _order: orderId, _status: status as "paid" });
    if (error) return toast.error(errMsg(error));
    toast.success("Order updated — buyer notified");
    qc.invalidateQueries({ queryKey: ["orders"] });
  };
  const applyVendor = async () => {
    const { error } = await supabase.from("profiles").update({ vendor_status: "pending" }).eq("id", user!.id);
    if (error) return toast.error(error.message);
    toast.success("Application sent to admins");
    refreshProfile();
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <PageHeader title="My shop" subtitle="List items, manage stock and fulfil orders.">
        <Button onClick={() => setEditing("new")} disabled={profile?.suspended}><Plus /> New listing</Button>
      </PageHeader>

      {profile && !profile.verified && (
        <div className="mb-6 flex flex-col gap-3 rounded-2xl border bg-secondary/60 p-5 sm:flex-row sm:items-center">
          {profile.vendor_status === "pending" ? <Clock className="h-6 w-6 text-warning-foreground" /> : <BadgeCheck className="h-6 w-6 text-primary" />}
          <div className="flex-1">
            <div className="font-semibold">{profile.vendor_status === "pending" ? "Vendor verification pending" : "Become a verified vendor"}</div>
            <div className="text-sm text-muted-foreground">
              {profile.vendor_status === "pending" ? "An admin will review your application soon." : profile.vendor_status === "rejected" ? "Your last application was declined. Update your profile and try again." : "Verified vendors get a badge that builds buyer trust."}
            </div>
          </div>
          {profile.vendor_status !== "pending" && <Button variant="outline" onClick={applyVendor}>Apply for verification</Button>}
        </div>
      )}
      {profile?.suspended && <p className="mb-6 rounded-xl bg-destructive/10 p-4 text-sm text-destructive">Your account is suspended. Contact an admin.</p>}

      <div className="mb-6 grid grid-cols-3 gap-3">
        {[{ l: "Listings", v: products.length }, { l: "Orders", v: grouped.length }, { l: "Revenue", v: formatZAR(revenue) }].map((s) => (
          <div key={s.l} className="rounded-2xl border bg-card p-4"><div className="text-xs text-muted-foreground">{s.l}</div><div className="font-display text-xl font-bold sm:text-2xl">{s.v}</div></div>
        ))}
      </div>

      <Tabs defaultValue="listings">
        <TabsList><TabsTrigger value="listings">Listings</TabsTrigger><TabsTrigger value="sales">Sales</TabsTrigger></TabsList>
        <TabsContent value="listings" className="mt-4">
          {products.length === 0 ? <EmptyState icon={Package} title="No listings yet" text="Sell textbooks, food, crafts or offer tutoring." action={<Button onClick={() => setEditing("new")}><Plus /> Create listing</Button>} /> : (
            <div className="space-y-3">
              {products.map((p) => (
                <div key={p.id} className="flex items-center gap-4 rounded-2xl border bg-card p-3">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-muted">{p.image_url && <img src={p.image_url} alt="" className="h-full w-full object-cover" />}</div>
                  <div className="min-w-0 flex-1">
                    <Link to="/products/$id" params={{ id: p.id }} className="block truncate font-semibold hover:text-primary">{p.title}</Link>
                    <div className="text-sm text-muted-foreground">{formatZAR(p.price)} · {p.stock} in stock · <span className={p.status === "active" ? "text-success" : "text-destructive"}>{p.status}</span></div>
                  </div>
                  <div className="flex gap-1">
                    {p.status !== "removed" && <Button variant="ghost" size="icon" onClick={() => toggle(p)} title={p.status === "active" ? "Hide" : "Show"}>{p.status === "active" ? <EyeOff /> : <Eye />}</Button>}
                    <Button variant="ghost" size="icon" onClick={() => setEditing(p)} title="Edit"><Pencil /></Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(p)} title="Delete"><Trash2 /></Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="sales" className="mt-4">
          {grouped.length === 0 ? <EmptyState icon={Receipt} title="No sales yet" /> : (
            <div className="space-y-3">
              {grouped.map(({ order, items }) => (
                <div key={order.id} className="rounded-2xl border bg-card p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="font-mono text-sm font-semibold">{order.payment_ref}</div>
                      <div className="text-xs text-muted-foreground">{formatDateTime(order.created_at)} · {order.buyer?.full_name} · {order.phone} · payment {order.payment_status}</div>
                    </div>
                    <StatusPill status={order.status} />
                  </div>
                  <ul className="mt-2 text-sm">{items.map((i) => <li key={i.id}>{i.quantity} × {i.title} — {formatZAR(i.price * i.quantity)}</li>)}</ul>
                  <div className="mt-1 text-xs text-muted-foreground">{order.delivery_method === "delivery" ? `Deliver to: ${order.delivery_address}` : "Collection"}{order.notes && ` · Note: ${order.notes}`}</div>
                  {!["completed", "cancelled"].includes(order.status) && (
                    <div className="mt-3 flex items-center gap-2">
                      <Select onValueChange={(v) => setStatus(order.id, v)}>
                        <SelectTrigger className="w-56"><SelectValue placeholder="Update status" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="processing">Processing</SelectItem>
                          <SelectItem value="ready">Ready for collection</SelectItem>
                          <SelectItem value="completed">Completed{order.payment_method === "cash_on_collection" ? " (cash received)" : ""}</SelectItem>
                          <SelectItem value="cancelled">Cancel order</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing === "new" ? "New listing" : "Edit listing"}</DialogTitle></DialogHeader>
          {editing && <ProductForm product={editing === "new" ? undefined : editing} onDone={() => { setEditing(null); refresh(); }} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
