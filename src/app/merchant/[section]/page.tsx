import { notFound } from "next/navigation";
import { merchantSections } from "@/lib/content";
import { MerchantPortal } from "@/components/merchant-portal";

export default async function Page({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!merchantSections.has(section)) notFound();
  return <MerchantPortal section={section} />;
}
