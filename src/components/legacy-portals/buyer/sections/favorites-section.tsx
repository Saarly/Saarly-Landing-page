"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/icons";
import { buyerPost } from "@/components/buyer/portal-client";
import { EmptyState, PortalPanel, StatusBadge } from "@/components/merchant/portal-ui";
import { rows, text } from "@/components/merchant/portal-utils";
import type { BuyerSectionProps } from "@/components/buyer/section-props";

export function BuyerFavoritesSection({ payload, locale, refresh, notify }: BuyerSectionProps) {
  const favorites = rows(payload.data.favorites);
  const [busy, setBusy] = useState("");
  async function remove(item: Record<string, unknown>) {
    const type = text(item.favorite_type); const targetId = text(type === "merchant" ? item.merchant_id : item.product_id);
    setBusy(text(item.id));
    try { await buyerPost("toggle_favorite", { favoriteType: type, targetId, searchText: text(item.search_text) }); notify(locale === "ar" ? "تمت الإزالة من المفضلة." : "Removed from favorites.", "success"); await refresh(); }
    catch (error) { notify(error instanceof Error ? error.message : "favorite_failed", "error"); } finally { setBusy(""); }
  }
  return <PortalPanel title={locale === "ar" ? `المفضلة (${favorites.length})` : `Favorites (${favorites.length})`} subtitle={locale === "ar" ? "كل المتاجر والمنتجات وعمليات البحث المحفوظة متزامنة مع التطبيق." : "All saved stores, products, and searches are synced with the app."}>
    {favorites.length ? <div className="buyer-favorites-grid expanded">{favorites.map((item) => <article key={text(item.id)} data-record-id={text(item.id)}><span className="favorite-preview">{text(item.image_signed_url) ? <img src={text(item.image_signed_url)} alt=""/> : <Icon name={text(item.favorite_type) === "merchant" ? "store" : text(item.favorite_type) === "search" ? "search" : "box"}/>}</span><div><strong>{text(item.title, text(item.search_text))}</strong><small>{text(item.subtitle)}</small></div><StatusBadge value={item.favorite_type} locale={locale}/><div className="inline-actions">{text(item.favorite_type) === "merchant" ? <Link className="button secondary compact" href={`/buyer/stores?focus=${encodeURIComponent(text(item.merchant_id))}`}>{locale === "ar" ? "فتح المتجر" : "Open store"}</Link> : text(item.favorite_type) === "product" ? <Link className="button secondary compact" href={`/buyer/stores?product=${encodeURIComponent(text(item.product_id))}`}>{locale === "ar" ? "عرض المنتج" : "View product"}</Link> : <Link className="button secondary compact" href={`/buyer/stores?q=${encodeURIComponent(text(item.search_text))}`}>{locale === "ar" ? "إعادة البحث" : "Search again"}</Link>}<button className="button danger-button compact" disabled={busy === text(item.id)} onClick={() => void remove(item)}>{locale === "ar" ? "إزالة" : "Remove"}</button></div></article>)}</div> : <EmptyState icon="target" title={locale === "ar" ? "المفضلة فاضية" : "No favorites yet"} body={locale === "ar" ? "افتح صفحة المتاجر واحفظ المنتجات أو المتاجر المهمة." : "Open Stores and save the products or stores you care about."}/>} 
  </PortalPanel>;
}
