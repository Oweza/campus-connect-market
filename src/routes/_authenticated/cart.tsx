import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Minus, Plus, ShoppingBag, Trash2, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, EmptyState } from "@/components/shared";
import { formatZAR } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/cart")({
  head: () => ({ meta: [{ title: "Your cart – Community Store" }, { name: "description", content: "Review the items in your cart." }] }),
  component: CartPage,
});

export const cartQuery = {
  queryKey: ["cart"],
  queryFn: async () => {
    const { data } = await supabase
      .from("cart_items")
      .select("id, quantity, product:products(id,title,price,image_url,stock,status,seller:profiles!products_seller_id_fkey(full_name))")
      .order("created_at");
    return data ?? [];
  },
};

function CartPage() {
  const qc = useQueryClient();
  const { data: items = [], isLoading } = useQuery(cartQuery);
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["cart"] });
    qc.invalidateQueries({ queryKey: ["cart-count"] });
  };
  const setQty = async (id: string, q: number) => {
    const { error } = await supabase.from("cart_items").update({ quantity: q }).eq("id", id);
    if (error) toast.error(error.message);
    refresh();
  };
  const remove = async (id: string) => {
    await supabase.from("cart_items").delete().eq("id", id);
    refresh();
  };
  const total = items.reduce((s, i) => s + (i.product?.price ?? 0) * i.quantity, 0);
  const problems = items.filter((i) => !i.product || i.product.status !== "active" || i.product.stock < i.quantity);

  if (isLoading) return <div className="mx-auto max-w-5xl px-4 py-10 text-muted-foreground">Loading…</div>;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <PageHeader title="Your cart" />
      {items.length === 0 ? (
        <EmptyState icon={ShoppingBag} title="Your cart is empty" text="Find something great from the community." action={<Button asChild><Link to="/marketplace">Browse marketplace</Link></Button>} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-3">
            {items.map((i) => i.product && (
              <div key={i.id} className="flex gap-4 rounded-2xl border bg-card p-4">
                <Link to="/products/$id" params={{ id: i.product.id }} className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-muted">
                  {i.product.image_url ? <img src={i.product.image_url} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="m-auto mt-6 text-muted-foreground" />}
                </Link>
                <div className="flex flex-1 flex-col">
                  <div className="flex justify-between gap-2">
                    <div>
                      <div className="font-semibold">{i.product.title}</div>
                      <div className="text-xs text-muted-foreground">Sold by {i.product.seller?.full_name}</div>
                    </div>
                    <div className="font-semibold">{formatZAR(i.product.price * i.quantity)}</div>
                  </div>
                  {(i.product.status !== "active" || i.product.stock < i.quantity) && (
                    <div className="mt-1 text-xs font-medium text-destructive">{i.product.status !== "active" ? "No longer available" : `Only ${i.product.stock} left`}</div>
                  )}
                  <div className="mt-auto flex items-center justify-between pt-2">
                    <div className="flex items-center rounded-lg border">
                      <Button variant="ghost" size="icon" className="h-8 w-8" disabled={i.quantity <= 1} onClick={() => setQty(i.id, i.quantity - 1)}><Minus /></Button>
                      <span className="w-8 text-center text-sm font-semibold">{i.quantity}</span>
                      <Button variant="ghost" size="icon" className="h-8 w-8" disabled={i.quantity >= i.product.stock} onClick={() => setQty(i.id, i.quantity + 1)}><Plus /></Button>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => remove(i.id)}><Trash2 /> Remove</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="h-fit rounded-2xl border bg-card p-5 shadow-card">
            <div className="flex justify-between text-sm"><span>Subtotal</span><span>{formatZAR(total)}</span></div>
            <div className="mt-1 flex justify-between text-sm text-muted-foreground"><span>Service fee</span><span>R0.00</span></div>
            <div className="mt-3 flex justify-between border-t pt-3 font-display text-xl font-bold"><span>Total</span><span>{formatZAR(total)}</span></div>
            <Button asChild className="mt-4 w-full" size="lg" disabled={problems.length > 0}>
              {problems.length > 0 ? <span>Fix cart items to continue</span> : <Link to="/checkout">Proceed to checkout</Link>}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
