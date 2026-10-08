import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ImagePlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import type { Database } from "@/integrations/supabase/types";

type Product = Database["public"]["Tables"]["products"]["Row"];

export async function uploadImage(userId: string, file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Please choose an image file");
  if (file.size > 5 * 1024 * 1024) throw new Error("Image must be under 5MB");
  const path = `${userId}/${crypto.randomUUID()}.${file.name.split(".").pop() ?? "jpg"}`;
  const { error } = await supabase.storage.from("product-images").upload(path, file, { contentType: file.type });
  if (error) throw error;
  const { data, error: e2 } = await supabase.storage.from("product-images").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
  if (e2 || !data) throw e2 ?? new Error("Could not create image link");
  return data.signedUrl;
}

export function ProductForm({ product, onDone }: { product?: Product; onDone: () => void }) {
  const { user } = useAuth();
  const [image, setImage] = useState<string | null>(product?.image_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [category, setCategory] = useState(product?.category_id ?? "");
  const [condition, setCondition] = useState(product?.condition ?? "new");
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await supabase.from("categories").select("*").order("sort")).data ?? [],
  });

  const onFile = async (f?: File) => {
    if (!f || !user) return;
    setUploading(true);
    try {
      setImage(await uploadImage(user.id, f));
    } catch (e) {
      toast.error((e as Error).message);
    }
    setUploading(false);
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const title = String(f.get("title")).trim();
    const price = Number(f.get("price"));
    const stock = Number(f.get("stock"));
    if (title.length < 3) return toast.error("Title must be at least 3 characters");
    if (!(price >= 0)) return toast.error("Enter a valid price");
    if (!Number.isInteger(stock) || stock < 0) return toast.error("Enter a valid quantity");
    if (!category) return toast.error("Choose a category");
    const payload = {
      title,
      description: String(f.get("description")).trim(),
      price,
      stock,
      condition,
      category_id: category,
      location: String(f.get("location")).trim() || "District 6",
      image_url: image,
    };
    setSaving(true);
    const { error } = product
      ? await supabase.from("products").update(payload).eq("id", product.id)
      : await supabase.from("products").insert({ ...payload, seller_id: user!.id });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(product ? "Listing updated" : "Listing published");
    onDone();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="flex aspect-video cursor-pointer items-center justify-center overflow-hidden rounded-xl border-2 border-dashed bg-muted hover:border-primary">
        {uploading ? <Loader2 className="animate-spin" /> : image ? <img src={image} alt="" className="h-full w-full object-cover" /> : (
          <span className="flex flex-col items-center gap-1 text-sm text-muted-foreground"><ImagePlus className="h-7 w-7" /> Upload a photo</span>
        )}
        <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      </label>
      <div className="space-y-1.5"><Label>Title</Label><Input name="title" defaultValue={product?.title} maxLength={120} required /></div>
      <div className="space-y-1.5"><Label>Description</Label><Textarea name="description" rows={3} defaultValue={product?.description} maxLength={2000} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5"><Label>Price (R)</Label><Input name="price" type="number" step="0.01" min={0} defaultValue={product?.price} required /></div>
        <div className="space-y-1.5"><Label>Quantity</Label><Input name="stock" type="number" min={0} defaultValue={product?.stock ?? 1} required /></div>
        <div className="space-y-1.5">
          <Label>Category</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
            <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>Condition</Label>
          <Select value={condition} onValueChange={setCondition}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="new">New</SelectItem>
              <SelectItem value="like_new">Like new</SelectItem>
              <SelectItem value="good">Good</SelectItem>
              <SelectItem value="fair">Fair</SelectItem>
              <SelectItem value="service">Service</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5"><Label>Pickup location</Label><Input name="location" defaultValue={product?.location ?? "District 6"} /></div>
      <Button className="w-full" disabled={saving || uploading}>{saving ? "Saving…" : product ? "Save changes" : "Publish listing"}</Button>
    </form>
  );
}
