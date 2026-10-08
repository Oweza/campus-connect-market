import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Search, SlidersHorizontal, PackageSearch } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { ProductCard, PRODUCT_SELECT, EmptyState, type ProductCardData } from "@/components/shared";
import { Skeleton } from "@/components/ui/skeleton";

type Search = { q?: string; category?: string; min?: number; max?: number; condition?: string; sort?: string; verified?: boolean };

export const Route = createFileRoute("/marketplace")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    q: typeof s.q === "string" ? s.q : undefined,
    category: typeof s.category === "string" ? s.category : undefined,
    min: s.min ? Number(s.min) : undefined,
    max: s.max ? Number(s.max) : undefined,
    condition: typeof s.condition === "string" ? s.condition : undefined,
    sort: typeof s.sort === "string" ? s.sort : undefined,
    verified: s.verified === true || s.verified === "true" ? true : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Marketplace – Community Store" },
      { name: "description", content: "Search textbooks, electronics, food, fashion and services from the District 6 community." },
      { property: "og:title", content: "Marketplace – Community Store" },
      { property: "og:description", content: "Browse local listings priced in Rands." },
    ],
  }),
  component: Marketplace,
});

function Marketplace() {
  const s = Route.useSearch();
  const navigate = useNavigate({ from: "/marketplace" });
  const [q, setQ] = useState(s.q ?? "");
  const [showFilters, setShowFilters] = useState(false);
  const set = (patch: Partial<Search>) => navigate({ search: (prev) => ({ ...prev, ...patch }) });

  useEffect(() => setQ(s.q ?? ""), [s.q]);

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await supabase.from("categories").select("*").order("sort")).data ?? [],
  });

  const { data: products, isLoading } = useQuery({
    queryKey: ["products", "search", s, categories.length],
    queryFn: async () => {
      const select = s.verified ? PRODUCT_SELECT.replace("seller:profiles!products_seller_id_fkey(", "seller:profiles!products_seller_id_fkey!inner(") : PRODUCT_SELECT;
      let query = supabase.from("products").select(select).eq("status", "active");
      if (s.q) query = query.or(`title.ilike.%${s.q.replace(/[%,()]/g, "")}%,description.ilike.%${s.q.replace(/[%,()]/g, "")}%`);
      if (s.category) {
        const cat = categories.find((c) => c.slug === s.category);
        if (cat) query = query.eq("category_id", cat.id);
      }
      if (s.min != null) query = query.gte("price", s.min);
      if (s.max != null) query = query.lte("price", s.max);
      if (s.condition) query = query.eq("condition", s.condition);
      if (s.verified) query = query.eq("seller.verified", true);
      if (s.sort === "price_asc") query = query.order("price", { ascending: true });
      else if (s.sort === "price_desc") query = query.order("price", { ascending: false });
      else query = query.order("created_at", { ascending: false });
      const { data, error } = await query.limit(60);
      if (error) throw error;
      return data as unknown as ProductCardData[];
    },
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-10">
      <h1 className="text-3xl font-bold sm:text-4xl">Marketplace</h1>
      <form
        className="mt-6 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          set({ q: q || undefined });
        }}
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search textbooks, laptops, koeksisters…" className="h-11 pl-9" />
        </div>
        <Button type="submit" className="h-11">Search</Button>
        <Button type="button" variant="outline" className="h-11 lg:hidden" onClick={() => setShowFilters(!showFilters)} aria-label="Filters">
          <SlidersHorizontal />
        </Button>
      </form>

      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={() => set({ category: undefined })} className={`rounded-full border px-3 py-1.5 text-sm ${!s.category ? "border-primary bg-primary text-primary-foreground" : "bg-card"}`}>All</button>
        {categories.map((c) => (
          <button key={c.id} onClick={() => set({ category: c.slug })} className={`rounded-full border px-3 py-1.5 text-sm ${s.category === c.slug ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:border-primary"}`}>
            {c.name}
          </button>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className={`${showFilters ? "block" : "hidden"} space-y-5 rounded-2xl border bg-card p-5 lg:block lg:self-start`}>
          <div className="space-y-2">
            <Label>Price range (R)</Label>
            <div className="flex gap-2">
              <Input type="number" min={0} placeholder="Min" defaultValue={s.min} onBlur={(e) => set({ min: e.target.value ? Number(e.target.value) : undefined })} />
              <Input type="number" min={0} placeholder="Max" defaultValue={s.max} onBlur={(e) => set({ max: e.target.value ? Number(e.target.value) : undefined })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Condition</Label>
            <Select value={s.condition ?? "any"} onValueChange={(v) => set({ condition: v === "any" ? undefined : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="like_new">Like new</SelectItem>
                <SelectItem value="good">Good</SelectItem>
                <SelectItem value="fair">Fair</SelectItem>
                <SelectItem value="service">Service</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Sort by</Label>
            <Select value={s.sort ?? "newest"} onValueChange={(v) => set({ sort: v === "newest" ? undefined : v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="price_asc">Price: low to high</SelectItem>
                <SelectItem value="price_desc">Price: high to low</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="verified">Verified vendors only</Label>
            <Switch id="verified" checked={!!s.verified} onCheckedChange={(v) => set({ verified: v || undefined })} />
          </div>
          <Button variant="outline" className="w-full" onClick={() => navigate({ search: {} })}>Clear filters</Button>
        </aside>
        <div>
          {isLoading ? (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-[4/5] rounded-2xl" />)}</div>
          ) : !products?.length ? (
            <EmptyState icon={PackageSearch} title="No listings found" text="Try a different search or clear your filters." />
          ) : (
            <>
              <p className="mb-3 text-sm text-muted-foreground">{products.length} listing{products.length === 1 ? "" : "s"}</p>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">{products.map((p) => <ProductCard key={p.id} p={p} />)}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
