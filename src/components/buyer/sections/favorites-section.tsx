"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Icon } from "@/components/icons";
import { buyerPost } from "@/components/buyer/portal-client";
import { EmptyState, PortalPanel, StatusBadge } from "@/components/merchant/portal-ui";
import { usePortalConfirm } from "@/components/portal-v2/portal-dialogs";
import { rows, text } from "@/components/merchant/portal-utils";
import type { BuyerSectionProps } from "@/components/buyer/section-props";

export function BuyerFavoritesSection({ payload, locale, refresh, notify }: BuyerSectionProps) {
  const { confirm, confirmDialog } = usePortalConfirm(locale);
  const favorites = rows(payload.data.favorites);
  const [busy, setBusy] = useState("");
  const [savedSearch, setSavedSearch] = useState("");

  async function addSearch(event: FormEvent) {
    event.preventDefault();
    const query = savedSearch.replace(/\s+/g, " ").trim();
    if (query.length < 2) {
      notify(locale === "ar" ? "اكتب كلمة بحث من حرفين على الأقل." : "Enter at least two characters.", "error");
      return;
    }
    setBusy("add-search");
    try {
      await buyerPost("add_search_favorite", { searchText: query });
      setSavedSearch("");
      notify(locale === "ar" ? "تم حفظ البحث في المفضلة." : "Saved search added to favorites.", "success");
      await refresh();
    } catch (error) { notify(error instanceof Error ? error.message : "favorite_failed", "error"); }
    finally { setBusy(""); }
  }

  async function setFavoriteAlert(item: Record<string, unknown>, enabled: boolean) {
    const id = text(item.id);
    if (!id) return;
    setBusy(`alert:${id}`);
    try {
      await buyerPost("set_favorite_price_alert", { favoriteId: id, enabled });
      notify(locale === "ar" ? "تم حفظ اختيار تنبيه السعر." : "Price alert preference saved.", "success");
      await refresh();
    } catch (error) { notify(error instanceof Error ? error.message : "favorite_alert_failed", "error"); }
    finally { setBusy(""); }
  }

  async function remove(item: Record<string, unknown>) {
    if (!(await confirm({
      title: locale === "ar" ? "إزالة من المفضلة" : "Remove favorite",
      body: locale === "ar" ? "العنصر هيتشال من قائمة المفضلة فقط." : "This item will only be removed from your favorites.",
      confirmLabel: locale === "ar" ? "إزالة" : "Remove",
      tone: "danger",
    }))) return;
    const type = text(item.favorite_type);
    const targetId = text(type === "merchant" ? item.merchant_id : item.product_id);
    setBusy(text(item.id));
    try {
      await buyerPost("toggle_favorite", { favoriteType: type, targetId, searchText: text(item.search_text) });
      notify(locale === "ar" ? "تمت الإزالة من المفضلة." : "Removed from favorites.", "success");
      await refresh();
    } catch (error) { notify(error instanceof Error ? error.message : "favorite_failed", "error"); }
    finally { setBusy(""); }
  }

  return <>
    <PortalPanel
      title={locale === "ar" ? `المفضلة (${favorites.length})` : `Favorites (${favorites.length})`}
      subtitle={locale === "ar" ? "احفظ متجرًا أو منتجًا أو حتى عبارة بحث، واضبط خيار تنبيه السعر لكل عنصر مثل التطبيق." : "Save stores, products, or search terms, and keep the same per-favorite price-alert preference as the app."}
      action={<Link className="button secondary compact" href="/buyer/alerts"><Icon name="bell" size={16}/>{locale === "ar" ? "قائمة تنبيهات الأسعار" : "Price alerts"}</Link>}
    >
      <form className="favorite-search-save" onSubmit={addSearch}>
        <label className="grow"><span>{locale === "ar" ? "بحث محفوظ" : "Saved search"}</span><input value={savedSearch} onChange={(event) => setSavedSearch(event.target.value)} placeholder={locale === "ar" ? "مثال: دهان أبيض مط" : "Example: matte white paint"}/></label>
        <button className="button primary" disabled={busy === "add-search" || savedSearch.trim().length < 2}><Icon name="plus" size={17}/>{busy === "add-search" ? (locale === "ar" ? "جارٍ الحفظ" : "Saving") : (locale === "ar" ? "حفظ البحث" : "Save search")}</button>
      </form>
      {favorites.length ? <div className="buyer-favorites-grid expanded">{favorites.map((item) => {
        const type = text(item.favorite_type);
        const id = text(item.id);
        const alertEnabled = item.is_price_alert_enabled === true;
        return <article key={id} data-record-id={id}>
          <span className="favorite-preview">{text(item.image_signed_url) ? <img src={text(item.image_signed_url)} alt=""/> : <Icon name={type === "merchant" ? "store" : type === "search" ? "search" : "box"}/>}</span>
          <div className="favorite-copy"><strong>{text(item.title, text(item.search_text))}</strong><small>{text(item.subtitle) || (type === "search" ? (locale === "ar" ? "بحث محفوظ" : "Saved search") : "")}</small></div>
          <StatusBadge value={type} locale={locale}/>
          <label className="favorite-alert-control"><input type="checkbox" checked={alertEnabled} disabled={busy === `alert:${id}`} onChange={(event) => void setFavoriteAlert(item, event.target.checked)}/><span><Icon name="bell" size={16}/><span><strong>{locale === "ar" ? "تنبيه السعر لاحقًا" : "Price alert later"}</strong><small>{locale === "ar" ? "يحفظ اختيارك للتنبيه عند توفر تسعير أو تغيّر السعر." : "Keeps your preference for future pricing changes."}</small></span></span></label>
          <div className="inline-actions">{type === "merchant" ? <Link className="button secondary compact" href={`/buyer/stores?focus=${encodeURIComponent(text(item.merchant_id))}`}>{locale === "ar" ? "فتح المتجر" : "Open store"}</Link> : type === "product" ? <Link className="button secondary compact" href={`/buyer/stores?product=${encodeURIComponent(text(item.product_id))}`}>{locale === "ar" ? "عرض المنتج" : "View product"}</Link> : <Link className="button secondary compact" href={`/buyer/stores?q=${encodeURIComponent(text(item.search_text))}`}>{locale === "ar" ? "إعادة البحث" : "Search again"}</Link>}<button className="button danger-button compact" disabled={busy === id} onClick={() => void remove(item)}>{locale === "ar" ? "إزالة" : "Remove"}</button></div>
        </article>;
      })}</div> : <EmptyState icon="target" title={locale === "ar" ? "المفضلة فاضية" : "No favorites yet"} body={locale === "ar" ? "احفظ عملية بحث من الحقل فوق أو افتح صفحة المتاجر واحفظ المنتجات أو المتاجر المهمة." : "Save a search above, or open Stores and save products or stores you care about."}/>} 
    </PortalPanel>
    {confirmDialog}
  </>;
}
