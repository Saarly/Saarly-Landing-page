import { notFound } from "next/navigation";
import { BuyerPortal } from "@/components/buyer-portal";
import { buyerSections } from "@/lib/content";
export default async function Page({ params }: { params: Promise<{ section: string }> }) { const { section } = await params; if (!buyerSections.has(section)) notFound(); return <BuyerPortal section={section}/>; }
