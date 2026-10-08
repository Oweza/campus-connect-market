export const formatZAR = (n: number | string) =>
  new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR" }).format(Number(n));

export const formatDate = (d: string) =>
  new Date(d).toLocaleDateString("en-ZA", { day: "numeric", month: "short", year: "numeric" });

export const formatDateTime = (d: string) =>
  new Date(d).toLocaleString("en-ZA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

export const timeAgo = (d: string) => {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

export const userTypeLabel: Record<string, string> = {
  student: "Student",
  faculty: "Faculty",
  vendor: "Vendor",
  resident: "Resident",
};

export const conditionLabel: Record<string, string> = {
  new: "New",
  like_new: "Like new",
  good: "Good",
  fair: "Fair",
  service: "Service",
};

export const statusLabel: Record<string, string> = {
  pending: "Awaiting payment",
  paid: "Paid",
  processing: "Processing",
  ready: "Ready for collection",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function errMsg(e: unknown) {
  if (e && typeof e === "object" && "message" in e) return String((e as { message: string }).message);
  return "Something went wrong";
}
