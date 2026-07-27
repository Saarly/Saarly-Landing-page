import { supabase } from "@/lib/supabase";
import type { PortalPayload, PortalRow } from "@/components/merchant/portal-utils";

async function accessToken() {
  if (!supabase) throw new Error("supabase_not_configured");
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) throw new Error("authentication_required");
  return data.session.access_token;
}

export async function portalGet(section: string): Promise<PortalPayload> {
  const token = await accessToken();
  const response = await fetch(`/api/merchant/portal?section=${encodeURIComponent(section)}`, {
    cache: "no-store",
    headers: { Authorization: `Bearer ${token}` },
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(String(payload.error ?? "portal_load_failed"));
  return payload as PortalPayload;
}

export async function portalPost(action: string, data: PortalRow = {}) {
  const token = await accessToken();
  const response = await fetch("/api/merchant/portal", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...data }),
  });
  const payload = await response.json();
  if (!response.ok) throw new Error(String(payload.error ?? "portal_action_failed"));
  return payload.data;
}

export async function portalUpload(kind: string, file: File, onProgress?: (value: number) => void) {
  const token = await accessToken();
  onProgress?.(15);
  const body = new FormData();
  body.set("kind", kind);
  body.set("file", file);
  const response = await fetch("/api/merchant/upload", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body });
  onProgress?.(90);
  const payload = await response.json();
  if (!response.ok) throw new Error(String(payload.error ?? "upload_failed"));
  onProgress?.(100);
  return payload.data as { bucket: string; path: string; url: string | null; mimeType: string; size: number };
}
