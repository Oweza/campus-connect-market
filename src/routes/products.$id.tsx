import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Flag, ImageIcon, MapPin, ShoppingBag, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatZAR, conditionLabel, formatDate, userTypeLabel } from "@/lib/format";
import { Stars, VerifiedBadge } from "@/components/shared";

export const Route = createFileRoute("/products/$id")({
  head: () => ({
    meta: [
      { title: "Listing – Community Store" },
      { name: "description", content: "View this listing on the District 6 Community Store marketplace." },
      { property: "og:title", content: "Listing – Community Store" },
      { property: "og:description", content: "A listing from the District 6 community marketplace." },
    ],
  }),
  component: ProductPage,
});

function ProductPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [qty, setQty] = useState(1);
  const [adding, setAdding] = useState(false);

  const { data: p, isLoading } = useQuery({
    queryKey: ["product", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("*, seller:profiles!products_seller_id_fkey(id,full_name,verified,user_type,business_name,avatar_url,created_at), category:categories(name,slug)")
        .eq("id", id)
        .maybeSingle();
      return data;
    },
  });
  const { data: rating } = useQuery({
    queryKey: ["seller-rating", p?.seller_id],
    enabled: !!p,
    queryFn: async () => {
      const { data } = await supabase.from("reviews").select("rating").eq("seller_id", p!.seller_id);
      const n = data?.length ?? 0;
      return { n, avg: n ? data!.reduce((s, r) => s + r.rating, 0) / n : 0 };
    },
  });

  if (isLoading) return <div className="mx-auto max-w-6xl px-4 py-16 text-muted-foreground">Loading…</div>;
  if (!p) return <div className="mx-auto max-w-6xl px-4 py-16 text-center"><h1 className="text-2xl font-bold">Listing not found</h1><Link to="/marketplace" className="mt-4 inline-block text-primary">Back to marketplace</Link></div>;

  const own = user?.id === p.seller_id;

  const addToCart = async (buyNow = false) => {
    if (!user) return navigate({ to: "/auth", search: { redirect: `/products/${id}` } });
    setAdding(true);
    const { data: existing } = await supabase.from("cart_items").select("id,quantity").eq("product_id", id).maybeSingle();
    const newQty = Math.min((existing?.quantity ?? 0) + qty, p.stock);
    const { error } = existing
      ? await supabase.from("cart_items").update({ quantity: newQty }).eq("id", existing.id)
      : await supabase.from("cart_items").insert({ user_id: user.id, product_id: id, quantity: qty });
    setAdding(false);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["cart-count"] });
    qc.invalidateQueries({ queryKey: ["cart"] });
    if (buyNow) navigate({ to: "/checkout" });
    else toast.success("Added to cart");
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <Link to="/marketplace" className="text-sm text-muted-foreground hover:text-foreground">← Marketplace</Link>
      <div className="mt-4 grid gap-8 md:grid-cols-2">
        <div className="overflow-hidden rounded-3xl border bg-muted">
          {p.image_url ? <img src={p.image_url} alt={p.title} className="aspect-square w-full object-cover" /> : <div className="flex aspect-square items-center justify-center text-muted-foreground"><ImageIcon className="h-16 w-16" /></div>}
        </div>
        <div>
          {p.category && <Link to="/marketplace" search={{ category: p.category.slug }} className="text-sm font-semibold text-accent">{p.category.name}</Link>}
          <h1 className="mt-1 text-3xl font-bold sm:text-4xl">{p.title}</h1>
          <div className="mt-3 font-display text-3xl font-bold text-primary">{formatZAR(p.price)}</div>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <span className="rounded-full bg-secondary px-3 py-1">{conditionLabel[p.condition] ?? p.condition}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1"><MapPin className="h-3.5 w-3.5" />{p.location}</span>
            <span className={`rounded-full px-3 py-1 ${p.stock > 0 ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>{p.stock > 0 ? `${p.stock} available` : "Sold out"}</span>
          </div>
          <p className="mt-6 whitespace-pre-line text-muted-foreground">{p.description || "No description provided."}</p>

          {p.status !== "active" && <p className="mt-4 rounded-lg bg-warning/20 p-3 text-sm">This listing is {p.status} and not visible to buyers.</p>}

          {own ? (
            <Button className="mt-6" variant="outline" asChild><Link to="/sell">Manage in my shop</Link></Button>
          ) : p.stock > 0 && p.status === "active" ? (
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <div className="flex items-center rounded-lg border">
                <Button variant="ghost" size="icon" onClick={() => setQty(Math.max(1, qty - 1))}><Minus /></Button>
                <span className="w-8 text-center font-semibold">{qty}</span>
                <Button variant="ghost" size="icon" onClick={() => setQty(Math.min(p.stock, qty + 1))}><Plus /></Button>
              </div>
              <Button size="lg" onClick={() => addToCart()} disabled={adding}><ShoppingBag /> Add to cart</Button>
              <Button size="lg" variant="accent" onClick={() => addToCart(true)} disabled={adding}>Buy now</Button>
            </div>
          ) : null}

          {p.seller && (
            <Link to="/sellers/$id" params={{ id: p.seller.id }} className="mt-8 flex items-center gap-4 rounded-2xl border bg-card p-4 hover:border-primary">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-secondary font-bold">
                {p.seller.avatar_url ? <img src={p.seller.avatar_url} alt="" className="h-full w-full object-cover" /> : p.seller.full_name[0]?.toUpperCase()}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 font-semibold">{p.seller.business_name || p.seller.full_name}{p.seller.verified && <VerifiedBadge />}</div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {userTypeLabel[p.seller.user_type]} · member since {formatDate(p.seller.created_at)}
                </div>
                {rating && rating.n > 0 && <div className="mt-1 flex items-center gap-1 text-sm"><Stars value={rating.avg} size={14} /> {rating.avg.toFixed(1)} ({rating.n})</div>}
              </div>
              <span className="text-sm font-semibold text-primary">View seller →</span>
            </Link>
          )}
          {!own && user && <ReportButton productId={p.id} />}
        </div>
      </div>
    </div>
  );
}

function ReportButton({ productId }: { productId: string }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("Scam or fraud");
  const [details, setDetails] = useState("");
  const submit = async () => {
    const { error } = await supabase.from("reports").insert({ reporter_id: user!.id, product_id: productId, reason, details });
    if (error) return toast.error(error.message);
    toast.success("Thanks — our admins will review this listing.");
    setOpen(false);
    setDetails("");
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="mt-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-destructive"><Flag className="h-4 w-4" /> Report this listing</button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Report suspicious listing</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Scam or fraud", "Prohibited item", "Misleading description", "Counterfeit", "Offensive content", "Other"].map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5"><Label>Details (optional)</Label><Textarea value={details} onChange={(e) => setDetails(e.target.value)} maxLength={1000} /></div>
        </div>
        <DialogFooter><Button variant="destructive" onClick={submit}>Submit report</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
