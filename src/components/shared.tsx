import { Link } from "@tanstack/react-router";
import { BadgeCheck, Star, ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatZAR, conditionLabel } from "@/lib/format";

export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <span
      title="Verified vendor"
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary",
        className,
      )}
    >
      <BadgeCheck className="h-3.5 w-3.5" /> Verified
    </span>
  );
}

export function Stars({ value, size = 16, onChange }: { value: number; size?: number; onChange?: (v: number) => void }) {
  return (
    <div className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          disabled={!onChange}
          onClick={() => onChange?.(i)}
          className={cn(onChange ? "cursor-pointer" : "cursor-default")}
          aria-label={`${i} star`}
        >
          <Star
            style={{ width: size, height: size }}
            className={i <= Math.round(value) ? "fill-warning text-warning" : "text-border"}
          />
        </button>
      ))}
    </div>
  );
}

export type ProductCardData = {
  id: string;
  title: string;
  price: number;
  image_url: string | null;
  condition: string;
  stock: number;
  seller?: { full_name: string; verified: boolean } | null;
  category?: { name: string } | null;
};

export function ProductCard({ p }: { p: ProductCardData }) {
  return (
    <Link
      to="/products/$id"
      params={{ id: p.id }}
      className="group overflow-hidden rounded-2xl border bg-card shadow-card transition hover:-translate-y-0.5 hover:shadow-lift"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {p.image_url ? (
          <img
            src={p.image_url}
            alt={p.title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted-foreground">
            <ImageIcon className="h-10 w-10" />
          </div>
        )}
        {p.category && (
          <span className="absolute left-3 top-3 rounded-full bg-background/90 px-2.5 py-1 text-xs font-medium">
            {p.category.name}
          </span>
        )}
        {p.stock === 0 && (
          <span className="absolute right-3 top-3 rounded-full bg-destructive px-2.5 py-1 text-xs font-semibold text-destructive-foreground">
            Sold out
          </span>
        )}
      </div>
      <div className="space-y-1.5 p-4">
        <h3 className="line-clamp-1 font-sans text-base font-semibold">{p.title}</h3>
        <div className="flex items-center justify-between">
          <span className="font-display text-lg font-bold text-primary">{formatZAR(p.price)}</span>
          <span className="text-xs text-muted-foreground">{conditionLabel[p.condition] ?? p.condition}</span>
        </div>
        {p.seller && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="truncate">{p.seller.full_name}</span>
            {p.seller.verified && <VerifiedBadge className="px-1.5 py-0 text-[10px]" />}
          </div>
        )}
      </div>
    </Link>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-3xl font-bold sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 text-muted-foreground">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, text, action }: { icon: React.ElementType; title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed bg-card/50 px-6 py-16 text-center">
      <div className="mb-4 rounded-full bg-secondary p-4">
        <Icon className="h-7 w-7 text-primary" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      {text && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export const PRODUCT_SELECT = "id,title,price,image_url,condition,stock,status,created_at,seller_id,category_id,seller:profiles!products_seller_id_fkey(full_name,verified),category:categories(name,slug)";
