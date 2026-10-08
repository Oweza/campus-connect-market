import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { uploadImage } from "@/components/ProductForm";
import { PageHeader, VerifiedBadge } from "@/components/shared";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "My profile – Community Store" }, { name: "description", content: "Edit your Community Store profile." }] }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, profile, roles, refreshProfile } = useAuth();
  const [saving, setSaving] = useState(false);
  const [type, setType] = useState<string | undefined>(undefined);
  if (!profile) return <div className="mx-auto max-w-2xl px-4 py-10 text-muted-foreground">Loading…</div>;
  const userType = type ?? profile.user_type;

  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const full_name = String(f.get("full_name")).trim();
    if (full_name.length < 2) return toast.error("Name is too short");
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      full_name,
      user_type: userType as "student",
      phone: String(f.get("phone")).trim() || null,
      bio: String(f.get("bio")).trim() || null,
      business_name: String(f.get("business_name") ?? "").trim() || null,
    }).eq("id", profile.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profile saved");
    refreshProfile();
  };

  const onAvatar = async (file?: File) => {
    if (!file || !user) return;
    try {
      const url = await uploadImage(user.id, file);
      await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
      refreshProfile();
      toast.success("Photo updated");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <PageHeader title="My profile">
        <Button variant="outline" asChild><Link to="/sellers/$id" params={{ id: profile.id }}>View public profile</Link></Button>
      </PageHeader>
      <div className="rounded-2xl border bg-card p-6 shadow-card">
        <div className="mb-6 flex items-center gap-4">
          <label className="relative flex h-20 w-20 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-secondary text-2xl font-bold">
            {profile.avatar_url ? <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" /> : profile.full_name[0]?.toUpperCase()}
            <span className="absolute bottom-0 right-0 rounded-full bg-primary p-1.5 text-primary-foreground"><Camera className="h-3.5 w-3.5" /></span>
            <input type="file" accept="image/*" className="hidden" onChange={(e) => onAvatar(e.target.files?.[0])} />
          </label>
          <div>
            <div className="flex items-center gap-2 text-lg font-semibold">{profile.full_name}{profile.verified && <VerifiedBadge />}</div>
            <div className="text-sm text-muted-foreground">{user?.email}</div>
            <div className="mt-1 flex flex-wrap gap-1">{roles.map((r) => <span key={r} className="rounded-full bg-secondary px-2 py-0.5 text-xs capitalize">{r}</span>)}</div>
          </div>
        </div>
        <form onSubmit={save} className="space-y-4">
          <div className="space-y-1.5"><Label>Full name</Label><Input name="full_name" defaultValue={profile.full_name} required /></div>
          <div className="space-y-1.5">
            <Label>Account type</Label>
            <Select value={userType} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="student">Student</SelectItem>
                <SelectItem value="faculty">Faculty / Staff</SelectItem>
                <SelectItem value="resident">Local resident</SelectItem>
                <SelectItem value="vendor">Vendor / Business</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {userType === "vendor" && <div className="space-y-1.5"><Label>Business name</Label><Input name="business_name" defaultValue={profile.business_name ?? ""} /></div>}
          <div className="space-y-1.5"><Label>Phone</Label><Input name="phone" defaultValue={profile.phone ?? ""} placeholder="082 123 4567" /></div>
          <div className="space-y-1.5"><Label>Bio</Label><Textarea name="bio" defaultValue={profile.bio ?? ""} maxLength={500} placeholder="Tell the community about yourself or your business" /></div>
          <Button disabled={saving}>{saving ? "Saving…" : "Save profile"}</Button>
        </form>
        <p className="mt-6 text-sm text-muted-foreground">Vendor verification status: <span className="font-semibold capitalize">{profile.vendor_status}</span>. {!profile.verified && <Link to="/sell" className="text-primary">Apply from My shop →</Link>}</p>
      </div>
    </div>
  );
}
