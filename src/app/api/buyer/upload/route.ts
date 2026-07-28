import { NextRequest, NextResponse } from "next/server";
import { requireBuyer } from "@/lib/buyer-auth";
import { PortalError } from "@/lib/merchant-auth";

export const dynamic = "force-dynamic";

const limits = {
  image: 4 * 1024 * 1024,
  pdf: 18 * 1024 * 1024,
  voice: 12 * 1024 * 1024,
} as const;

const allowed: Record<keyof typeof limits, Set<string>> = {
  image: new Set(["image/jpeg", "image/png", "image/webp"]),
  pdf: new Set(["application/pdf"]),
  voice: new Set(["audio/mpeg", "audio/wav", "audio/x-m4a", "audio/mp4", "audio/webm", "audio/ogg"]),
};

function cleanFileName(name: string) {
  const normalized = name.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
  return normalized.replace(/^[-.]+|[-.]+$/g, "").slice(-120) || "upload.bin";
}

function errorResponse(error: unknown) {
  if (error instanceof PortalError) return NextResponse.json({ error: error.code }, { status: error.status });
  console.error("buyer upload error", error);
  return NextResponse.json({ error: error instanceof Error ? error.message : "upload_failed" }, { status: 500 });
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireBuyer(request);
    const form = await request.formData();
    const source = String(form.get("source") ?? "").trim() as keyof typeof limits;
    const file = form.get("file");
    if (!(source in limits)) throw new PortalError("unsupported_file_type", 415);
    if (!(file instanceof File)) throw new PortalError("file_required", 400);
    if (!allowed[source].has(file.type)) throw new PortalError("unsupported_file_type", 415);
    if (file.size <= 0) throw new PortalError("file_required", 400);
    if (file.size > limits[source]) throw new PortalError("file_too_large", 413);

    const bucket = source === "voice" ? "voice-recordings" : "invoices";
    const safeName = cleanFileName(file.name);
    const random = crypto.randomUUID();
    const path = `${context.user.id}/buyer-web/${Date.now()}-${random}-${safeName}`;
    const bytes = new Uint8Array(await file.arrayBuffer());
    const upload = await context.service.storage.from(bucket).upload(path, bytes, {
      contentType: file.type,
      cacheControl: "3600",
      upsert: false,
    });
    if (upload.error) throw new PortalError(upload.error.message || "upload_failed", 400);

    return NextResponse.json({
      data: {
        bucket,
        path: upload.data.path,
        mimeType: file.type,
        sizeBytes: file.size,
        name: safeName,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
