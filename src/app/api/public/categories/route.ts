import { NextResponse } from "next/server";
import { createServerAnonClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabase = createServerAnonClient();
    const { data, error } = await supabase
      .from("categories")
      .select("id, name_ar, name_en, slug, display_order")
      .is("parent_id", null)
      .eq("is_active", true)
      .order("display_order")
      .order("name_ar");
    if (error) throw error;
    return NextResponse.json({ data: data ?? [] }, { headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" } });
  } catch {
    return NextResponse.json({ data: [] }, { status: 200 });
  }
}
