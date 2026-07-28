import { NextRequest, NextResponse } from "next/server";
import { PortalError, requireMerchant } from "@/lib/merchant-auth";

export const dynamic = "force-dynamic";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const PROOF_TYPES = new Set(["image/jpeg", "image/png", "application/pdf"]);
const ID_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

function extension(file: File) {
  const byName = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  if (byName && byName.length <= 8) return byName;
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  if (file.type === "application/pdf") return "pdf";
  return "bin";
}

function responseError(error: unknown) {
  if (error instanceof PortalError) return NextResponse.json({ error: error.code }, { status: error.status });
  console.error("merchant upload error", error);
  return NextResponse.json({ error: error instanceof Error ? error.message : "upload_failed" }, { status: 500 });
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireMerchant(request);
    const form = await request.formData();
    const file = form.get("file");
    const kind = String(form.get("kind") ?? "").trim();
    if (!(file instanceof File) || file.size <= 0) throw new PortalError("file_required");

    let bucket = "";
    let pathPrefix = "";
    let allowed = IMAGE_TYPES;
    let maxBytes = 5 * 1024 * 1024;
    let publicUrl = false;

    if (kind === "product-image") {
      bucket = "product-images";
      pathPrefix = `${context.user.id}/portal-products`;
      publicUrl = true;
      maxBytes = 10 * 1024 * 1024;
    } else if (kind === "product-import") {
      if (!context.isOwner && !((context.staff?.permissions ?? {}) as Record<string, unknown>).imports) throw new PortalError("import_permission_required", 403);
      bucket = "product-imports";
      pathPrefix = `${context.user.id}/portal-imports`;
      allowed = new Set(["text/csv", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/octet-stream"]);
      maxBytes = 15 * 1024 * 1024;
    } else if (kind === "payment-proof") {
      if (!context.isOwner) throw new PortalError("merchant_owner_required", 403);
      bucket = "merchant-payment-proofs";
      pathPrefix = `${context.merchantId}/portal-payments`;
      allowed = PROOF_TYPES;
    } else if (kind === "branch-front") {
      if (!context.isOwner) throw new PortalError("merchant_owner_required", 403);
      bucket = "storefront-photos";
      pathPrefix = `${context.user.id}/portal-branches`;
      allowed = IMAGE_TYPES;
      maxBytes = 10 * 1024 * 1024;
    } else if (kind === "branch-manager-front" || kind === "branch-manager-back") {
      if (!context.isOwner) throw new PortalError("merchant_owner_required", 403);
      bucket = "merchant-ids";
      pathPrefix = `${context.user.id}/portal-branches`;
      allowed = ID_TYPES;
      maxBytes = 10 * 1024 * 1024;
    } else if (kind === "branch-commercial-register") {
      if (!context.isOwner) throw new PortalError("merchant_owner_required", 403);
      bucket = "commercial-registers";
      pathPrefix = `${context.user.id}/portal-branches`;
      allowed = ID_TYPES;
      maxBytes = 10 * 1024 * 1024;
    } else {
      throw new PortalError("unsupported_upload_kind");
    }

    if (!allowed.has(file.type)) throw new PortalError("unsupported_file_type");
    if (file.size > maxBytes) throw new PortalError("file_too_large");

    const suffix = crypto.randomUUID();
    const objectPath = `${pathPrefix}/${Date.now()}-${suffix}.${extension(file)}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const storageClient = context.isOwner ? context.userDb : context.service;
    const { error } = await storageClient.storage.from(bucket).upload(objectPath, bytes, {
      contentType: file.type,
      upsert: false,
      cacheControl: publicUrl ? "3600" : "no-store",
    });
    if (error) throw new PortalError(error.message, 400);

    const url = publicUrl ? storageClient.storage.from(bucket).getPublicUrl(objectPath).data.publicUrl : null;
    return NextResponse.json({ data: { bucket, path: objectPath, url, mimeType: file.type, size: file.size } });
  } catch (error) {
    return responseError(error);
  }
}
