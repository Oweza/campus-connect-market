import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ShieldAlert, Users, Package, Receipt, Flag, BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PageHeader, EmptyState, VerifiedBadge } from "@/components/shared";
import { formatZAR, formatDateTime, userTypeLabel, errMsg } from "@/lib/format";
import { StatusPill } from "./orders";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin dashboard – Community Store" }, { name: "description", content: "Moderate users, vendors, listings, orders and reports." }] }),
  component: Admin,
});

function Admin() {
  const { isAdmin, loading, user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const inv = () => qc.invalidateQueries();

  const users = useQuery({ queryKey: ["admin", "users"], enabled: isAdmin, queryFn: async () => (await supabase.from("profiles").select("*").order("created_at", { ascending: false })).data ?? [] });
  const roles = useQuery({ queryKey: ["admin", "roles"], enabled: isAdmin, queryFn: async () => (await supabase.from("user_roles").select("user_id,role")).data ?? [] });
  const products = useQuery({ queryKey: ["admin", "products"], enabled: isAdmin, queryFn: async () => (await supabase.from("products").select("*, seller:profiles!products_seller_id_fkey(full_name)").order("created_at", { ascending: false })).data ?? [] });
  const orders = useQuery({ queryKey: ["admin", "orders"], enabled: isAdmin, queryFn: async () => (await supabase.from("orders").select("*, buyer:profiles!orders_buyer_id_fkey(full_name), items:order_items(quantity,title)").order("created_at", { ascending: false })).data ?? [] });
  const reports = useQuery({ queryKey: ["admin", "reports"], enabled: isAdmin, queryFn: async () => (await supabase.from("reports").select("*, reporter:profiles!reports_reporter_id_fkey(full_name), product:products(id,title,status)").order("created_at", { ascending: false })).data ?? [] });

  if (loading) return <div className="mx-auto max-w-6xl px-4 py-10 text-muted-foreground">Loading…</div>;
  if (!isAdmin) return <div className="mx-auto max-w-6xl px-4 py-10"><EmptyState icon={ShieldAlert} title="Admins only" text="You don't have access to this page." /></div>;

  const rolesOf = (id: string) => (roles.data ?? []).filter((r) => r.user_id === id).map((r) => r.role);
  const pendingVendors = (users.data ?? []).filter((u) => u.vendor_status === "pending");
  const openReports = (reports.data ?? []).filter((r) => r.status === "open");
  const revenue = (orders.data ?? []).filter((o) => o.payment_status === "paid").reduce((s, o) => s + Number(o.total), 0);
  const q = search.toLowerCase();

  const rpc = async (p: PromiseLike<{ error: unknown }>, msg: string) => {
    const { error } = await p;
    if (error) return toast.error(errMsg(error));
    toast.success(msg);
    inv();
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <PageHeader title="Admin dashboard" subtitle="Keep the community safe and trusted." />
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          { l: "Users", v: users.data?.length ?? 0, i: Users },
          { l: "Pending vendors", v: pendingVendors.length, i: BadgeCheck },
          { l: "Listings", v: products.data?.length ?? 0, i: Package },
          { l: "Paid revenue", v: formatZAR(revenue), i: Receipt },
          { l: "Open reports", v: openReports.length, i: Flag },
        ].map((s) => (
          <div key={s.l} className="rounded-2xl border bg-card p-4">
            <s.i className="h-5 w-5 text-accent" />
            <div className="mt-2 font-display text-2xl font-bold">{s.v}</div>
            <div className="text-xs text-muted-foreground">{s.l}</div>
          </div>
        ))}
      </div>

      <Tabs defaultValue={pendingVendors.length ? "vendors" : openReports.length ? "reports" : "users"}>
        <TabsList className="flex h-auto flex-wrap">
          <TabsTrigger value="vendors">Vendors ({pendingVendors.length})</TabsTrigger>
          <TabsTrigger value="reports">Reports ({openReports.length})</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="orders">Orders</TabsTrigger>
        </TabsList>

        <TabsContent value="vendors" className="mt-4 space-y-3">
          {pendingVendors.length === 0 ? <EmptyState icon={BadgeCheck} title="No pending applications" /> : pendingVendors.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-4">
              <div className="flex-1">
                <div className="font-semibold">{u.business_name || u.full_name}</div>
                <div className="text-sm text-muted-foreground">{u.full_name} · {userTypeLabel[u.user_type]} · {u.phone ?? "no phone"} · joined {formatDateTime(u.created_at)}</div>
                {u.bio && <p className="mt-1 text-sm">{u.bio}</p>}
              </div>
              <Button variant="success" onClick={() => rpc(supabase.rpc("review_vendor", { _user: u.id, _approve: true }), "Vendor approved")}>Approve</Button>
              <Button variant="outline" onClick={() => rpc(supabase.rpc("review_vendor", { _user: u.id, _approve: false }), "Application declined")}>Decline</Button>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="reports" className="mt-4 space-y-3">
          {(reports.data ?? []).length === 0 ? <EmptyState icon={Flag} title="No reports" /> : reports.data!.map((r) => (
            <div key={r.id} className={`rounded-2xl border bg-card p-4 ${r.status === "open" ? "border-destructive/40" : "opacity-70"}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-semibold">{r.reason} <span className="ml-2 text-xs font-normal capitalize text-muted-foreground">{r.status}</span></div>
                  <div className="text-sm text-muted-foreground">
                    {r.product ? <Link to="/products/$id" params={{ id: r.product.id }} className="text-primary">{r.product.title}</Link> : "Deleted listing"} ({r.product?.status}) · by {r.reporter?.full_name} · {formatDateTime(r.created_at)}
                  </div>
                  {r.details && <p className="mt-1 text-sm">{r.details}</p>}
                </div>
                {r.status === "open" && (
                  <div className="flex flex-wrap gap-2">
                    {r.product && r.product.status !== "removed" && (
                      <Button size="sm" variant="destructive" onClick={async () => {
                        await supabase.from("products").update({ status: "removed" }).eq("id", r.product!.id);
                        rpc(supabase.from("reports").update({ status: "resolved", admin_note: "Listing removed" }).eq("id", r.id), "Listing removed & report resolved");
                      }}>Remove listing</Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => rpc(supabase.from("reports").update({ status: "resolved" }).eq("id", r.id), "Report resolved")}>Resolve</Button>
                    <Button size="sm" variant="ghost" onClick={() => rpc(supabase.from("reports").update({ status: "dismissed" }).eq("id", r.id), "Report dismissed")}>Dismiss</Button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </TabsContent>

        <TabsContent value="users" className="mt-4">
          <Input placeholder="Search users…" value={search} onChange={(e) => setSearch(e.target.value)} className="mb-3 max-w-sm" />
          <div className="overflow-x-auto rounded-2xl border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-left"><tr><th className="p-3">Name</th><th className="p-3">Type</th><th className="p-3">Roles</th><th className="p-3">Vendor</th><th className="p-3 text-right">Actions</th></tr></thead>
              <tbody>
                {(users.data ?? []).filter((u) => !q || u.full_name.toLowerCase().includes(q) || (u.business_name ?? "").toLowerCase().includes(q)).map((u) => {
                  const r = rolesOf(u.id);
                  const admin = r.includes("admin");
                  return (
                    <tr key={u.id} className="border-t">
                      <td className="p-3"><div className="flex items-center gap-2 font-medium">{u.full_name}{u.verified && <VerifiedBadge />}{u.suspended && <span className="rounded-full bg-destructive/15 px-2 text-xs text-destructive">Suspended</span>}</div></td>
                      <td className="p-3">{userTypeLabel[u.user_type]}</td>
                      <td className="p-3 capitalize">{r.join(", ")}</td>
                      <td className="p-3 capitalize">{u.vendor_status}</td>
                      <td className="space-x-1 whitespace-nowrap p-3 text-right">
                        {u.verified ? (
                          <Button size="sm" variant="ghost" onClick={() => rpc(supabase.rpc("review_vendor", { _user: u.id, _approve: false }), "Verification revoked")}>Unverify</Button>
                        ) : (
                          <Button size="sm" variant="ghost" onClick={() => rpc(supabase.rpc("review_vendor", { _user: u.id, _approve: true }), "Vendor verified")}>Verify</Button>
                        )}
                        {u.id !== user?.id && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => rpc(supabase.rpc("set_admin", { _user: u.id, _make: !admin }), admin ? "Admin removed" : "Admin granted")}>{admin ? "Remove admin" : "Make admin"}</Button>
                            <Button size="sm" variant={u.suspended ? "outline" : "destructive"} onClick={() => rpc(supabase.from("profiles").update({ suspended: !u.suspended }).eq("id", u.id), u.suspended ? "User reinstated" : "User suspended")}>{u.suspended ? "Reinstate" : "Suspend"}</Button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="products" className="mt-4">
          <div className="overflow-x-auto rounded-2xl border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-left"><tr><th className="p-3">Listing</th><th className="p-3">Seller</th><th className="p-3">Price</th><th className="p-3">Stock</th><th className="p-3">Status</th><th className="p-3 text-right">Actions</th></tr></thead>
              <tbody>
                {(products.data ?? []).map((p) => (
                  <tr key={p.id} className="border-t">
                    <td className="p-3"><Link to="/products/$id" params={{ id: p.id }} className="font-medium hover:text-primary">{p.title}</Link></td>
                    <td className="p-3">{p.seller?.full_name}</td>
                    <td className="p-3">{formatZAR(p.price)}</td>
                    <td className="p-3">{p.stock}</td>
                    <td className="p-3 capitalize">{p.status}</td>
                    <td className="space-x-1 whitespace-nowrap p-3 text-right">
                      <Select value={p.status} onValueChange={(v) => rpc(supabase.from("products").update({ status: v }).eq("id", p.id), "Listing updated")}>
                        <SelectTrigger className="inline-flex h-8 w-28"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="active">Active</SelectItem><SelectItem value="hidden">Hidden</SelectItem><SelectItem value="removed">Removed</SelectItem></SelectContent>
                      </Select>
                      <Button size="sm" variant="ghost" onClick={() => confirm("Permanently delete this listing?") && rpc(supabase.from("products").delete().eq("id", p.id), "Listing deleted")}>Delete</Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="orders" className="mt-4">
          <div className="overflow-x-auto rounded-2xl border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-left"><tr><th className="p-3">Ref</th><th className="p-3">Buyer</th><th className="p-3">Items</th><th className="p-3">Total</th><th className="p-3">Payment</th><th className="p-3">Status</th><th className="p-3 text-right">Update</th></tr></thead>
              <tbody>
                {(orders.data ?? []).map((o) => (
                  <tr key={o.id} className="border-t">
                    <td className="p-3 font-mono text-xs">{o.payment_ref}<div className="font-sans text-muted-foreground">{formatDateTime(o.created_at)}</div></td>
                    <td className="p-3">{o.buyer?.full_name}</td>
                    <td className="p-3">{o.items.map((i) => `${i.quantity}× ${i.title}`).join(", ")}</td>
                    <td className="p-3">{formatZAR(o.total)}</td>
                    <td className="p-3 capitalize">{o.payment_method.replace(/_/g, " ")} · {o.payment_status}</td>
                    <td className="p-3"><StatusPill status={o.status} /></td>
                    <td className="p-3 text-right">
                      {!["completed", "cancelled"].includes(o.status) && (
                        <Select onValueChange={(v) => rpc(supabase.rpc("update_order_status", { _order: o.id, _status: v as "paid" }), "Order updated")}>
                          <SelectTrigger className="ml-auto h-8 w-32"><SelectValue placeholder="Set…" /></SelectTrigger>
                          <SelectContent>{["processing", "ready", "completed", "cancelled"].map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
                        </Select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
