import { NextRequest, NextResponse } from "next/server";
import { PortalError, requireAuthenticatedUser } from "@/lib/merchant-auth";

export const dynamic = "force-dynamic";
const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "application/pdf"]);

function extension(file: File) {
  const byName = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (byName && byName.length <= 8) return byName;
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  if (file.type === "application/pdf") return "pdf";
  return "bin";
}

function errorResponse(error: unknown) {
  if (error instanceof PortalError) return NextResponse.json({ error: error.code }, { status: error.status });
  console.error("merchant registration upload", error);
  return NextResponse.json({ error: error instanceof Error ? error.message : "upload_failed" }, { status: 500 });
}

export async function POST(request: NextRequest) {
  try {
    const { user, userDb, service } = await requireAuthenticatedUser(request);
    const { data: profile, error: profileError } = await service.from("users").select("role,is_blocked").eq("id", user.id).maybeSingle();
    if (profileError) throw new PortalError("profile_load_failed", 500);
    if (!profile || profile.role !== "merchant") throw new PortalError("merchant_role_required", 403);
    if (profile.is_blocked) throw new PortalError("account_blocked", 403);

    const form = await request.formData();
    const file = form.get("file");
    const kind = String(form.get("kind") ?? "");
    if (!(file instanceof File) || file.size <= 0) throw new PortalError("file_required");
    if (!ALLOWED.has(file.type)) throw new PortalError("unsupported_file_type");
    if (file.size > MAX_DOCUMENT_BYTES) throw new PortalError("file_too_large");

    const config: Record<string, { bucket: string; label: string; imageOnly?: boolean }> = {
      "owner-id-front": { bucket: "merchant-ids", label: "owner-id-front" },
      "owner-id-back": { bucket: "merchant-ids", label: "owner-id-back" },
      "storefront": { bucket: "storefront-photos", label: "storefront", imageOnly: true },
      "commercial-register": { bucket: "commercial-registers", label: "commercial-register" },
    };
    const selected = config[kind];
    if (!selected) throw new PortalError("unsupported_upload_kind");
    if (selected.imageOnly && !file.type.startsWith("image/")) throw new PortalError("unsupported_file_type");

    const path = `${user.id}/merchant-registration/${Date.now()}-${selected.label}-${crypto.randomUUID()}.${extension(file)}`;
    const { error } = await userDb.storage.from(selected.bucket).upload(path, new Uint8Array(await file.arrayBuffer()), {
      upsert: false,
      contentType: file.type,
      cacheControl: "no-store",
    });
    if (error) throw new PortalError(error.message, 400);
    return NextResponse.json({ data: { bucket: selected.bucket, path, mimeType: file.type, size: file.size } });
  } catch (error) { return errorResponse(error); }
}
