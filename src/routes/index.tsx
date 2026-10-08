import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import * as Icons from "lucide-react";
import { ArrowRight, ShieldCheck, Users, Wallet, CalendarDays, Megaphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { ProductCard, PRODUCT_SELECT, type ProductCardData } from "@/components/shared";
import { formatDate } from "@/lib/format";
import hero from "@/assets/hero-market.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Community Store – District 6 Campus & Local Marketplace" },
      { name: "description", content: "Buy, sell and trade textbooks, food, crafts and services with students, faculty, residents and verified vendors in District 6, Cape Town." },
      { property: "og:title", content: "Community Store – District 6 Campus & Local Marketplace" },
      { property: "og:description", content: "A trusted marketplace for the District 6 community, priced in Rands." },
    ],
  }),
  component: Index,
});

function Index() {
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await supabase.from("categories").select("*").order("sort")).data ?? [],
  });
  const { data: latest = [] } = useQuery({
    queryKey: ["products", "latest"],
    queryFn: async () =>
      ((await supabase.from("products").select(PRODUCT_SELECT).eq("status", "active").order("created_at", { ascending: false }).limit(8)).data ?? []) as unknown as ProductCardData[],
  });
  const { data: posts = [] } = useQuery({
    queryKey: ["posts", "home"],
    queryFn: async () => (await supabase.from("posts").select("*").order("pinned", { ascending: false }).order("created_at", { ascending: false }).limit(3)).data ?? [],
  });

  return (
    <div>
      <section className="relative overflow-hidden">
        <img src={hero} alt="Colourful District 6 community market" width={1600} height={912} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-hero" />
        <div className="relative mx-auto max-w-7xl px-4 py-24 sm:py-32">
          <span className="inline-flex rounded-full bg-primary-foreground/15 px-3 py-1 text-xs font-semibold text-primary-foreground backdrop-blur">
            District 6 · Cape Town
          </span>
          <h1 className="mt-5 max-w-2xl text-4xl font-extrabold leading-[1.05] text-primary-foreground sm:text-6xl">
            Your campus & neighbourhood marketplace.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-primary-foreground/85">
            Buy, sell and trade with students, faculty, residents and verified local vendors — in a space built on trust.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button variant="hero" size="lg" asChild><Link to="/marketplace">Browse listings <ArrowRight /></Link></Button>
            <Button variant="heroOutline" size="lg" asChild><Link to="/sell">Start selling</Link></Button>
          </div>
        </div>
      </section>

      <section className="mx-auto -mt-10 max-w-7xl px-4">
        <div className="relative grid gap-4 rounded-2xl border bg-card p-6 shadow-lift sm:grid-cols-3">
          {[
            { icon: ShieldCheck, t: "Verified vendors", d: "Admins approve local businesses" },
            { icon: Wallet, t: "Secure checkout", d: "Card, Instant EFT or cash on collection" },
            { icon: Users, t: "Community first", d: "Ratings, reviews and reporting" },
          ].map((f) => (
            <div key={f.t} className="flex items-center gap-3">
              <div className="rounded-xl bg-secondary p-3"><f.icon className="h-5 w-5 text-primary" /></div>
              <div><div className="font-semibold">{f.t}</div><div className="text-sm text-muted-foreground">{f.d}</div></div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-16">
        <h2 className="text-2xl font-bold sm:text-3xl">Shop by category</h2>
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {categories.map((c) => {
            const Icon = (Icons as unknown as Record<string, React.ElementType>)[c.icon] ?? Icons.Package;
            return (
              <Link key={c.id} to="/marketplace" search={{ category: c.slug }} className="flex flex-col items-center gap-2 rounded-2xl border bg-card p-4 text-center text-sm font-medium transition hover:-translate-y-0.5 hover:border-primary hover:shadow-card">
                <Icon className="h-6 w-6 text-accent" />
                {c.name}
              </Link>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-16">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-bold sm:text-3xl">Fresh listings</h2>
          <Link to="/marketplace" className="text-sm font-semibold text-primary">View all →</Link>
        </div>
        {latest.length === 0 ? (
          <p className="mt-6 rounded-2xl border border-dashed p-10 text-center text-muted-foreground">
            No listings yet — <Link to="/sell" className="font-semibold text-primary">be the first to sell</Link>.
          </p>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {latest.map((p) => <ProductCard key={p.id} p={p} />)}
          </div>
        )}
      </section>

      <section className="mx-auto max-w-7xl px-4 pt-16">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-bold sm:text-3xl">On the bulletin board</h2>
          <Link to="/bulletin" className="text-sm font-semibold text-primary">See all →</Link>
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {posts.length === 0 && <p className="text-muted-foreground">No announcements yet.</p>}
          {posts.map((p) => (
            <Link key={p.id} to="/bulletin" className="rounded-2xl border bg-card p-5 shadow-card hover:border-primary">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-accent">
                {p.kind === "event" ? <CalendarDays className="h-4 w-4" /> : <Megaphone className="h-4 w-4" />}
                {p.kind}{p.event_date && ` · ${formatDate(p.event_date)}`}
              </div>
              <h3 className="mt-2 text-lg font-semibold">{p.title}</h3>
              <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{p.body}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
