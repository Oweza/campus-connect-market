import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CreditCard, Landmark, Banknote, Lock, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { formatZAR, errMsg } from "@/lib/format";
import { cartQuery } from "./cart";

export const Route = createFileRoute("/_authenticated/checkout")({
  head: () => ({ meta: [{ title: "Checkout – Community Store" }, { name: "description", content: "Securely complete your order." }] }),
  component: Checkout,
});

const luhn = (n: string) => {
  let sum = 0;
  let dbl = false;
  for (let i = n.length - 1; i >= 0; i--) {
    let d = Number(n[i]);
    if (dbl) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
    dbl = !dbl;
  }
  return n.length >= 13 && sum % 10 === 0;
};

const BANKS = ["FNB", "Standard Bank", "Absa", "Capitec", "Nedbank", "TymeBank"];

function Checkout() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: items = [] } = useQuery(cartQuery);
  const [method, setMethod] = useState("card");
  const [delivery, setDelivery] = useState("collection");
  const [stage, setStage] = useState<"form" | "processing" | "done">("form");
  const [bank, setBank] = useState(BANKS[0]);
  const [card, setCard] = useState({ number: "", name: "", exp: "", cvv: "" });
  const total = items.reduce((s, i) => s + (i.product?.price ?? 0) * i.quantity, 0);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const phone = String(f.get("phone") ?? "").trim();
    const address = String(f.get("address") ?? "").trim();
    if (!/^(\+27|0)\d{9}$/.test(phone.replace(/\s/g, ""))) return toast.error("Enter a valid SA phone number, e.g. 082 123 4567");
    if (delivery === "delivery" && address.length < 5) return toast.error("Enter a delivery address");
    let last4: string | null = null;
    if (method === "card") {
      const num = card.number.replace(/\s/g, "");
      if (!luhn(num)) return toast.error("Card number is invalid");
      const m = card.exp.match(/^(\d{2})\/(\d{2})$/);
      if (!m || Number(m[1]) < 1 || Number(m[1]) > 12 || new Date(2000 + Number(m[2]), Number(m[1])) < new Date()) return toast.error("Card expiry is invalid or expired");
      if (!/^\d{3,4}$/.test(card.cvv)) return toast.error("CVV is invalid");
      if (card.name.trim().length < 2) return toast.error("Enter the cardholder name");
      last4 = num.slice(-4);
    }
    setStage("processing");
    await new Promise((r) => setTimeout(r, 1800)); // simulated bank authorisation
    const { data, error } = await supabase.rpc("place_order", {
      _payment_method: method,
      _card_last4: last4 ?? "",
      _delivery_method: delivery,
      _address: delivery === "delivery" ? address : "Collection – District 6",
      _phone: phone,
      _notes: String(f.get("notes") ?? ""),
    });
    if (error) {
      setStage("form");
      return toast.error(errMsg(error));
    }
    setStage("done");
    qc.invalidateQueries({ queryKey: ["cart"] });
    qc.invalidateQueries({ queryKey: ["cart-count"] });
    qc.invalidateQueries({ queryKey: ["orders"] });
    setTimeout(() => navigate({ to: "/orders", search: { placed: data as string } }), 1400);
  };

  if (stage !== "form") {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center">
        {stage === "processing" ? (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <h1 className="mt-6 text-2xl font-bold">{method === "instant_eft" ? `Connecting to ${bank}…` : method === "card" ? "Authorising payment…" : "Placing order…"}</h1>
            <p className="mt-2 text-muted-foreground">Please don't close this page.</p>
          </>
        ) : (
          <>
            <CheckCircle2 className="h-14 w-14 text-success" />
            <h1 className="mt-6 text-2xl font-bold">{method === "cash_on_collection" ? "Order placed!" : "Payment successful!"}</h1>
            <p className="mt-2 text-muted-foreground">Redirecting to your orders…</p>
          </>
        )}
      </div>
    );
  }

  if (items.length === 0) {
    return <div className="mx-auto max-w-md px-4 py-24 text-center"><h1 className="text-2xl font-bold">Your cart is empty</h1><Button asChild className="mt-4"><Link to="/marketplace">Browse marketplace</Link></Button></div>;
  }

  return (
    <form onSubmit={submit} className="mx-auto grid max-w-5xl gap-6 px-4 py-10 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Checkout</h1>
        <section className="space-y-4 rounded-2xl border bg-card p-5">
          <h2 className="text-lg font-semibold">1. Delivery</h2>
          <RadioGroup value={delivery} onValueChange={setDelivery} className="grid gap-3 sm:grid-cols-2">
            {[{ v: "collection", t: "Collect / meet up", d: "Arrange a safe campus meet-up" }, { v: "delivery", t: "Local delivery", d: "Within District 6 & surrounds" }].map((o) => (
              <Label key={o.v} className={`flex cursor-pointer gap-3 rounded-xl border p-4 ${delivery === o.v ? "border-primary bg-primary/5" : ""}`}>
                <RadioGroupItem value={o.v} /><div><div className="font-semibold">{o.t}</div><div className="text-xs font-normal text-muted-foreground">{o.d}</div></div>
              </Label>
            ))}
          </RadioGroup>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label>Phone number</Label><Input name="phone" defaultValue={profile?.phone ?? ""} placeholder="082 123 4567" required /></div>
            {delivery === "delivery" && <div className="space-y-1.5 sm:col-span-2"><Label>Delivery address</Label><Input name="address" placeholder="Street, suburb" required /></div>}
          </div>
          <div className="space-y-1.5"><Label>Note to seller (optional)</Label><Textarea name="notes" maxLength={500} /></div>
        </section>

        <section className="space-y-4 rounded-2xl border bg-card p-5">
          <h2 className="text-lg font-semibold">2. Payment</h2>
          <RadioGroup value={method} onValueChange={setMethod} className="grid gap-3 sm:grid-cols-3">
            {[{ v: "card", t: "Card", i: CreditCard }, { v: "instant_eft", t: "Instant EFT", i: Landmark }, { v: "cash_on_collection", t: "Cash on collection", i: Banknote }].map((o) => (
              <Label key={o.v} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 ${method === o.v ? "border-primary bg-primary/5" : ""}`}>
                <RadioGroupItem value={o.v} /><o.i className="h-5 w-5 text-primary" /><span className="font-semibold">{o.t}</span>
              </Label>
            ))}
          </RadioGroup>
          {method === "card" && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2"><Label>Card number</Label><Input inputMode="numeric" placeholder="4242 4242 4242 4242" value={card.number} onChange={(e) => setCard({ ...card, number: e.target.value.replace(/[^\d]/g, "").slice(0, 19).replace(/(\d{4})(?=\d)/g, "$1 ") })} /></div>
              <div className="space-y-1.5 sm:col-span-2"><Label>Name on card</Label><Input value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value })} /></div>
              <div className="space-y-1.5"><Label>Expiry (MM/YY)</Label><Input placeholder="12/28" value={card.exp} onChange={(e) => { const v = e.target.value.replace(/[^\d]/g, "").slice(0, 4); setCard({ ...card, exp: v.length > 2 ? `${v.slice(0, 2)}/${v.slice(2)}` : v }); }} /></div>
              <div className="space-y-1.5"><Label>CVV</Label><Input inputMode="numeric" maxLength={4} value={card.cvv} onChange={(e) => setCard({ ...card, cvv: e.target.value.replace(/[^\d]/g, "") })} /></div>
              <p className="text-xs text-muted-foreground sm:col-span-2">Test mode: use 4242 4242 4242 4242 for success, or 4000 0000 0002 0000 (any card ending 0000) to simulate a decline. No real money is charged.</p>
            </div>
          )}
          {method === "instant_eft" && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {BANKS.map((b) => (
                <button type="button" key={b} onClick={() => setBank(b)} className={`rounded-xl border p-3 text-sm font-semibold ${bank === b ? "border-primary bg-primary/5" : ""}`}>{b}</button>
              ))}
              <p className="col-span-full text-xs text-muted-foreground">Simulated Instant EFT — you'll be "redirected" to {bank} and payment is confirmed instantly.</p>
            </div>
          )}
          {method === "cash_on_collection" && <p className="text-sm text-muted-foreground">Pay the seller in cash when you collect. The seller marks the order as completed once paid.</p>}
        </section>
      </div>
      <aside className="h-fit space-y-3 rounded-2xl border bg-card p-5 shadow-card lg:sticky lg:top-24">
        <h2 className="text-lg font-semibold">Order summary</h2>
        {items.map((i) => i.product && (
          <div key={i.id} className="flex justify-between gap-2 text-sm"><span className="truncate">{i.quantity} × {i.product.title}</span><span>{formatZAR(i.product.price * i.quantity)}</span></div>
        ))}
        <div className="flex justify-between border-t pt-3 font-display text-xl font-bold"><span>Total</span><span>{formatZAR(total)}</span></div>
        <Button size="lg" className="w-full"><Lock /> {method === "cash_on_collection" ? "Place order" : `Pay ${formatZAR(total)}`}</Button>
        <p className="text-center text-xs text-muted-foreground">Simulated payments — for demonstration only.</p>
      </aside>
    </form>
  );
}
