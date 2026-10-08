import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { ProductCard, PRODUCT_SELECT, Stars, VerifiedBadge, type ProductCardData } from "@/components/shared";
import { formatDate, userTypeLabel } from "@/lib/format";

export const Route = createFileRoute("/sellers/$id")({
  head: () => ({
    meta: [
      { title: "Seller profile – Community Store" },
      { name: "description", content: "Listings, ratings and reviews for this Community Store seller." },
      { property: "og:title", content: "Seller profile – Community Store" },
      { property: "og:description", content: "See this seller's listings and community reviews." },
    ],
  }),
  component: SellerPage,
});

function SellerPage() {
  const { id } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");

  const { data: seller } = useQuery({
    queryKey: ["seller", id],
    queryFn: async () => (await supabase.from("profiles").select("*").eq("id", id).maybeSingle()).data,
  });
  const { data: products = [] } = useQuery({
    queryKey: ["seller-products", id],
    queryFn: async () => ((await supabase.from("products").select(PRODUCT_SELECT).eq("seller_id", id).eq("status", "active").order("created_at", { ascending: false })).data ?? []) as unknown as ProductCardData[],
  });
  const { data: reviews = [] } = useQuery({
    queryKey: ["reviews", id],
    queryFn: async () => (await supabase.from("reviews").select("*, reviewer:profiles!reviews_reviewer_id_fkey(full_name)").eq("seller_id", id).order("created_at", { ascending: false })).data ?? [],
  });
  const { data: canReview } = useQuery({
    queryKey: ["can-review", id, user?.id],
    enabled: !!user && user.id !== id,
    queryFn: async () => {
      const { data } = await supabase.rpc("has_bought_from", { _seller: id, _user: user!.id });
      return !!data;
    },
  });

  if (!seller) return <div className="mx-auto max-w-6xl px-4 py-16 text-muted-foreground">Loading…</div>;
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  const mine = reviews.find((r) => r.reviewer_id === user?.id);

  const submit = async () => {
    const payload = { seller_id: id, reviewer_id: user!.id, rating, comment: comment.trim() || null };
    const { error } = mine
      ? await supabase.from("reviews").update({ rating, comment: payload.comment }).eq("id", mine.id)
      : await supabase.from("reviews").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Review saved");
    setComment("");
    qc.invalidateQueries({ queryKey: ["reviews", id] });
    qc.invalidateQueries({ queryKey: ["seller-rating"] });
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-col gap-6 rounded-3xl border bg-card p-6 shadow-card sm:flex-row sm:items-center">
        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-secondary text-2xl font-bold">
          {seller.avatar_url ? <img src={seller.avatar_url} alt="" className="h-full w-full object-cover" /> : seller.full_name[0]?.toUpperCase()}
        </div>
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold sm:text-3xl">{seller.business_name || seller.full_name}</h1>
            {seller.verified && <VerifiedBadge />}
          </div>
          <p className="text-sm text-muted-foreground">{userTypeLabel[seller.user_type]} · member since {formatDate(seller.created_at)}</p>
          {seller.bio && <p className="mt-2 max-w-2xl">{seller.bio}</p>}
        </div>
        <div className="text-center">
          <div className="font-display text-3xl font-bold">{avg ? avg.toFixed(1) : "–"}</div>
          <Stars value={avg} />
          <div className="text-xs text-muted-foreground">{reviews.length} review{reviews.length === 1 ? "" : "s"}</div>
        </div>
      </div>

      <h2 className="mt-10 text-2xl font-bold">Listings</h2>
      {products.length === 0 ? <p className="mt-3 text-muted-foreground">No active listings.</p> : (
        <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">{products.map((p) => <ProductCard key={p.id} p={p} />)}</div>
      )}

      <h2 className="mt-10 text-2xl font-bold">Reviews</h2>
      {canReview && (
        <div className="mt-4 rounded-2xl border bg-card p-5">
          <div className="font-semibold">{mine ? "Update your review" : "Rate this seller"}</div>
          <div className="mt-2"><Stars value={rating} size={24} onChange={setRating} /></div>
          <Textarea className="mt-3" placeholder="How was your experience?" value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} />
          <Button className="mt-3" onClick={submit}>Submit review</Button>
        </div>
      )}
      {user && !canReview && user.id !== id && <p className="mt-2 text-sm text-muted-foreground">You can review this seller after buying from them.</p>}
      <div className="mt-4 space-y-3">
        {reviews.length === 0 && <p className="text-muted-foreground">No reviews yet.</p>}
        {reviews.map((r) => (
          <div key={r.id} className="rounded-2xl border bg-card p-4">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{r.reviewer?.full_name}</span>
              <span className="text-xs text-muted-foreground">{formatDate(r.created_at)}</span>
            </div>
            <Stars value={r.rating} size={14} />
            {r.comment && <p className="mt-1 text-sm text-muted-foreground">{r.comment}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
