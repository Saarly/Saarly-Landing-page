"use client";

import { useMemo, useState, type FormEvent } from "react";
import { Icon } from "@/components/icons";
import { portalPost } from "@/components/merchant/portal-client";
import { EmptyState, Notice, PortalPanel, StatusBadge } from "@/components/merchant/portal-ui";
import { money, numberValue, row, rows, text, type PortalRow } from "@/components/merchant/portal-utils";
import type { SectionProps } from "@/components/merchant/section-props";

type BuyerTab = "browse" | "favorites" | "alerts" | "location";
type RequestItem = { name: string; quantity: number; unit: string; productId?: string; categoryId?: string };

export function BuyerModeSection({ payload, locale, refresh, notify }: SectionProps) {
  const data = payload.data;
  const categories = rows(data.categories);
  const initialFavorites = rows(data.favorites);
  const locationOptions = rows(data.locationOptions).filter((item) => item.is_country_marker !== true);
  const savedLocation = row(data.location);
  const initialAlerts = rows(data.priceAlerts).filter((item) => item.is_active === true);
  const [tab, setTab] = useState<BuyerTab>("browse");
  const [merchants, setMerchants] = useState<PortalRow[]>(rows(data.merchants));
  const [products, setProducts] = useState<PortalRow[]>([]);
  const [selectedMerchant, setSelectedMerchant] = useState<PortalRow>({});
  const [merchantQuery, setMerchantQuery] = useState("");
  const [productQuery, setProductQuery] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [loadingStores, setLoadingStores] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState(() => new Set(initialFavorites.map((item) => text(item.merchant_id || item.product_id)).filter(Boolean)));
  const [alertProductIds, setAlertProductIds] = useState(() => new Set(initialAlerts.map((item) => text(item.product_id)).filter(Boolean)));
  const [cityId, setCityId] = useState(text(savedLocation.city_id || savedLocation.cityId));
  const [latitude, setLatitude] = useState(text(savedLocation.latitude));
  const [longitude, setLongitude] = useState(text(savedLocation.longitude));
  const [savingLocation, setSavingLocation] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestItems, setRequestItems] = useState<RequestItem[]>([]);
  const [sendingRequest, setSendingRequest] = useState(false);

  const currency = payload.account.currencyCode || text(savedLocation.currency_code, "EGP");
  const selectedMerchantId = text(selectedMerchant.merchant_id);
  const favorites = useMemo(() => initialFavorites.filter((item) => favoriteIds.has(text(item.merchant_id || item.product_id))), [initialFavorites, favoriteIds]);

  async function searchStores(event?: FormEvent) {
    event?.preventDefault();
    setLoadingStores(true);
    try {
      const result = await portalPost("search_buyer_merchants", { categoryId, query: merchantQuery });
      setMerchants(rows(result));
      if (selectedMerchantId && !rows(result).some((item) => text(item.merchant_id) === selectedMerchantId)) {
        setSelectedMerchant({}); setProducts([]);
      }
    } catch (error) { notify(error instanceof Error ? error.message : "buyer_search_failed", "error"); }
    finally { setLoadingStores(false); }
  }

  async function openStore(merchant: PortalRow, query = "") {
    const id = text(merchant.merchant_id);
    setSelectedMerchant(merchant); setProductQuery(query); setLoadingProducts(true);
    try {
      const result = await portalPost("load_buyer_products", { merchantId: id, query });
      setProducts(rows(result));
    } catch (error) { notify(error instanceof Error ? error.message : "buyer_products_load_failed", "error"); }
    finally { setLoadingProducts(false); }
  }

  async function favorite(type: "merchant" | "product", id: string) {
    try {
      const result = row(await portalPost("toggle_buyer_favorite", { favoriteType: type, targetId: id }));
      const active = result.active === true;
      setFavoriteIds((current) => { const next = new Set(current); active ? next.add(id) : next.delete(id); return next; });
      if (!active && type === "product") setAlertProductIds((current) => { const next = new Set(current); next.delete(id); return next; });
      notify(locale === "ar" ? (active ? "تمت الإضافة للمفضلة." : "تمت الإزالة من المفضلة.") : (active ? "Added to favorites." : "Removed from favorites."), "success");
    } catch (error) { notify(error instanceof Error ? error.message : "favorite_failed", "error"); }
  }

  async function toggleAlert(productId: string) {
    try {
      const result = row(await portalPost("toggle_buyer_price_alert", { productId }));
      const active = result.active === true;
      setAlertProductIds((current) => { const next = new Set(current); active ? next.add(productId) : next.delete(productId); return next; });
      if (active) setFavoriteIds((current) => new Set(current).add(productId));
      notify(locale === "ar" ? (active ? "تم تفعيل تنبيه السعر." : "تم إيقاف تنبيه السعر.") : (active ? "Price alert enabled." : "Price alert disabled."), "success");
      await refresh();
    } catch (error) { notify(error instanceof Error ? error.message : "price_alert_failed", "error"); }
  }

  function startRequest(product?: PortalRow, merchant: PortalRow = selectedMerchant) {
    if (!text(merchant.merchant_id)) return;
    setSelectedMerchant(merchant);
    setRequestItems(product ? [{
      name: text(product.name), quantity: 1, unit: text(product.unit, locale === "ar" ? "قطعة" : "piece"),
      productId: text(product.product_id), categoryId: text(product.category_id),
    }] : [{ name: "", quantity: 1, unit: locale === "ar" ? "قطعة" : "piece" }]);
    setRequestOpen(true);
  }

  function updateRequestItem(index: number, patch: Partial<RequestItem>) {
    setRequestItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  async function submitDirectRequest(event: FormEvent) {
    event.preventDefault();
    const items = requestItems.filter((item) => item.name.trim() && item.quantity > 0);
    if (!selectedMerchantId || items.length === 0) {
      notify(locale === "ar" ? "اكتب منتجًا واحدًا على الأقل." : "Add at least one item.", "error"); return;
    }
    setSendingRequest(true);
    try {
      const location = locationOptions.find((item) => text(item.id) === cityId) ?? savedLocation;
      await portalPost("create_buyer_direct_request", {
        merchantId: selectedMerchantId,
        items,
        location: {
          city_id: cityId || null,
          city: text(location.name_ar || location.city_ar || location.city),
          city_en: text(location.name_en || location.city_en),
          governorate: text(location.governorate_ar || location.governorate),
          governorate_en: text(location.governorate_en),
          country: text(location.country_ar || location.country, "مصر"),
          country_en: text(location.country_en, "Egypt"),
          latitude: latitude ? Number(latitude) : null,
          longitude: longitude ? Number(longitude) : null,
        },
      });
      notify(locale === "ar" ? "تم إرسال الطلب للمتجر فقط، وهيوصله إشعار فورًا." : "The request was sent only to this store and it has been notified.", "success");
      setRequestOpen(false); setRequestItems([]);
    } catch (error) { notify(error instanceof Error ? error.message : "direct_request_failed", "error"); }
    finally { setSendingRequest(false); }
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) { notify(locale === "ar" ? "المتصفح لا يدعم تحديد الموقع." : "Geolocation is not supported.", "error"); return; }
    navigator.geolocation.getCurrentPosition(
      (position) => { setLatitude(String(position.coords.latitude)); setLongitude(String(position.coords.longitude)); },
      () => notify(locale === "ar" ? "تعذر الوصول لموقعك. راجع إذن الموقع في المتصفح." : "Could not access your location. Check browser permission.", "error"),
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }

  async function saveLocation(event: FormEvent) {
    event.preventDefault();
    if (!cityId) { notify(locale === "ar" ? "اختر المدينة." : "Choose a city.", "error"); return; }
    setSavingLocation(true);
    try {
      await portalPost("save_buyer_location", { cityId, latitude, longitude });
      notify(locale === "ar" ? "تم حفظ موقع وضع المشتري." : "Buyer-mode location saved.", "success");
      await refresh();
    } catch (error) { notify(error instanceof Error ? error.message : "location_save_failed", "error"); }
    finally { setSavingLocation(false); }
  }

  return <div className="portal-section-stack buyer-mode-v2">
    <Notice tone="info" title={locale === "ar" ? "وضع المشتري من حساب المتجر" : "Buyer mode from a merchant account"}>
      {locale === "ar" ? "متجرك وأي متجر بتديره كموظف مش بيظهروا هنا. المفضلة وتنبيهات الأسعار والموقع متزامنين مع تطبيق الموبايل." : "Your own store and stores you manage are excluded. Favorites, price alerts, and location stay synced with the mobile app."}
    </Notice>

    <nav className="portal-subtabs" aria-label={locale === "ar" ? "أقسام وضع المشتري" : "Buyer mode sections"}>
      {([
        ["browse", "store", "التصفح والطلب", "Browse & request"],
        ["favorites", "target", "المفضلة", "Favorites"],
        ["alerts", "bell", "تنبيهات الأسعار", "Price alerts"],
        ["location", "location", "موقعي", "My location"],
      ] as const).map(([key, icon, ar, en]) => <button key={key} type="button" className={tab === key ? "active" : ""} onClick={() => setTab(key)}><Icon name={icon}/>{locale === "ar" ? ar : en}</button>)}
    </nav>

    {tab === "browse" ? <>
      <PortalPanel title={locale === "ar" ? "ابحث عن متجر أو منتج" : "Find a store or product"} subtitle={locale === "ar" ? "النتائج بتتفلتر حسب بلد وموقع الحساب، ومتجرك نفسه مستبعد." : "Results follow the account country and location, excluding your own store."}>
        <form className="buyer-search-bar" onSubmit={searchStores}>
          <label><span>{locale === "ar" ? "القسم" : "Category"}</span><select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}><option value="">{locale === "ar" ? "كل الأقسام" : "All categories"}</option>{categories.map((category) => <option key={text(category.category_id)} value={text(category.category_id)}>{text(locale === "ar" ? category.name_ar : category.name_en)}</option>)}</select></label>
          <label className="grow"><span>{locale === "ar" ? "بحث" : "Search"}</span><input value={merchantQuery} onChange={(event) => setMerchantQuery(event.target.value)} placeholder={locale === "ar" ? "اسم متجر أو منتج" : "Store or product name"}/></label>
          <button className="button primary" disabled={loadingStores}><Icon name="search"/>{loadingStores ? (locale === "ar" ? "جارٍ البحث" : "Searching") : (locale === "ar" ? "بحث" : "Search")}</button>
        </form>
      </PortalPanel>

      <div className="portal-two-columns buyer-mode-layout">
        <PortalPanel title={locale === "ar" ? `المتاجر المتاحة (${merchants.length})` : `Available stores (${merchants.length})`}>
          {merchants.length ? <div className="buyer-store-list">{merchants.map((merchant) => { const id = text(merchant.merchant_id); return <article className={selectedMerchantId === id ? "selected" : ""} key={id} data-record-id={id}>{text(merchant.storefront_signed_url) ? <img className="buyer-store-thumb" src={text(merchant.storefront_signed_url)} alt={text(merchant.store_name)}/> : <span className="avatar-placeholder"><Icon name="store"/></span>}<div className="buyer-store-copy"><strong>{text(merchant.store_name)}</strong><small>{text(locale === "ar" ? merchant.primary_category_ar : merchant.primary_category_en)} · {text(merchant.city_name)} · {numberValue(merchant.products_count)} {locale === "ar" ? "منتج" : "products"}</small></div><div className="inline-actions"><button className={`icon-button ${favoriteIds.has(id) ? "active" : ""}`} type="button" onClick={() => void favorite("merchant", id)} aria-label={locale === "ar" ? "المفضلة" : "Favorite"}><Icon name={favoriteIds.has(id) ? "check" : "target"} size={18}/></button><button className="button secondary compact" type="button" onClick={() => void openStore(merchant)}>{locale === "ar" ? "فتح" : "Open"}</button><button className="button primary compact" type="button" onClick={() => startRequest(undefined, merchant)}>{locale === "ar" ? "طلب مخصوص" : "Direct request"}</button></div></article>; })}</div> : <EmptyState icon="store" title={locale === "ar" ? "لا توجد متاجر مطابقة" : "No matching stores"} body={locale === "ar" ? "غيّر القسم أو كلمة البحث أو راجع موقع وضع المشتري." : "Change the category or search term, or review buyer-mode location."}/>} 
        </PortalPanel>

        <PortalPanel title={selectedMerchantId ? text(selectedMerchant.store_name) : (locale === "ar" ? "منتجات المتجر" : "Store products")} subtitle={selectedMerchantId ? (locale === "ar" ? "ابحث داخل المتجر، احفظ منتجًا أو فعّل تنبيه سعر أو أرسل طلبًا مخصوصًا." : "Search inside the store, favorite items, enable price alerts, or send a direct request.") : undefined}>
          {selectedMerchantId ? <form className="buyer-product-search" onSubmit={(event) => { event.preventDefault(); void openStore(selectedMerchant, productQuery); }}><input value={productQuery} onChange={(event) => setProductQuery(event.target.value)} placeholder={locale === "ar" ? "ابحث داخل المتجر" : "Search this store"}/><button className="button secondary compact"><Icon name="search"/>{locale === "ar" ? "بحث" : "Search"}</button></form> : null}
          {loadingProducts ? <p className="muted-copy">{locale === "ar" ? "جارٍ تحميل المنتجات..." : "Loading products..."}</p> : products.length ? <div className="buyer-product-grid">{products.map((product) => { const id = text(product.product_id); return <article className="buyer-product-card" key={id} data-record-id={id}>{text(product.image_signed_url) ? <img src={text(product.image_signed_url)} alt={text(product.name)}/> : <span className="buyer-product-placeholder"><Icon name="box"/></span>}<strong>{text(product.name)}</strong><span>{money(product.price, currency, locale)} / {text(product.unit)}</span><small>{locale === "ar" ? `المتاح: ${numberValue(product.quantity)}` : `Available: ${numberValue(product.quantity)}`}</small><div className="buyer-product-actions"><button className="button secondary compact" type="button" onClick={() => void favorite("product", id)}>{favoriteIds.has(id) ? (locale === "ar" ? "إزالة المفضلة" : "Unfavorite") : (locale === "ar" ? "مفضلة" : "Favorite")}</button><button className={`button secondary compact ${alertProductIds.has(id) ? "active" : ""}`} type="button" onClick={() => void toggleAlert(id)}><Icon name="bell" size={17}/>{alertProductIds.has(id) ? (locale === "ar" ? "إيقاف التنبيه" : "Stop alert") : (locale === "ar" ? "تنبيه سعر" : "Price alert")}</button><button className="button primary compact" type="button" onClick={() => startRequest(product)}>{locale === "ar" ? "طلب مخصوص" : "Direct request"}</button></div></article>; })}</div> : <EmptyState title={selectedMerchantId ? (locale === "ar" ? "لا توجد منتجات مطابقة" : "No matching products") : (locale === "ar" ? "اختار متجر" : "Choose a store")} body={selectedMerchantId ? (locale === "ar" ? "غيّر كلمة البحث داخل المتجر." : "Change the in-store search term.") : (locale === "ar" ? "اضغط فتح على أي متجر عشان تشوف منتجاته." : "Open a store to see its products.")}/>} 
        </PortalPanel>
      </div>
    </> : null}

    {tab === "favorites" ? <PortalPanel title={locale === "ar" ? `المفضلة (${favorites.length})` : `Favorites (${favorites.length})`} subtitle={locale === "ar" ? "نفس العناصر المحفوظة في التطبيق." : "The same items saved in the app."}>{favorites.length ? <div className="buyer-favorites-grid">{favorites.map((item) => <article key={text(item.id)}><span className="favorite-preview">{text(item.image_signed_url) ? <img src={text(item.image_signed_url)} alt=""/> : <Icon name={text(item.favorite_type) === "merchant" ? "store" : "box"}/>}</span><div><strong>{text(item.title)}</strong><small>{text(item.subtitle)}</small></div><StatusBadge value={text(item.favorite_type) === "merchant" ? "store" : "active"} locale={locale}/><button className="button danger-button compact" type="button" onClick={() => void favorite(text(item.favorite_type) === "merchant" ? "merchant" : "product", text(item.merchant_id || item.product_id))}>{locale === "ar" ? "إزالة" : "Remove"}</button></article>)}</div> : <EmptyState icon="target" title={locale === "ar" ? "المفضلة فاضية" : "No favorites yet"} body={locale === "ar" ? "احفظ متجر أو منتج من تبويب التصفح." : "Save a store or product from Browse."}/>}</PortalPanel> : null}

    {tab === "alerts" ? <PortalPanel title={locale === "ar" ? `تنبيهات الأسعار (${initialAlerts.length})` : `Price alerts (${initialAlerts.length})`} subtitle={locale === "ar" ? "تابع السعر الحالي وآخر حالة مسجلة." : "Track the current price and latest status."}>{initialAlerts.length ? <div className="buyer-alert-list">{initialAlerts.map((alert) => <article key={text(alert.id)}><div><strong>{text(alert.title || alert.watched_product_text)}</strong><small>{text(alert.subtitle)}</small></div><div><span>{locale === "ar" ? "السعر الحالي" : "Current"}</span><strong>{money(alert.current_price, currency, locale)}</strong></div><StatusBadge value={alert.last_price_status} locale={locale}/><button className="button secondary compact" type="button" onClick={() => void toggleAlert(text(alert.product_id))}>{locale === "ar" ? "إيقاف" : "Stop"}</button></article>)}</div> : <EmptyState icon="bell" title={locale === "ar" ? "لا توجد تنبيهات سعر" : "No price alerts"} body={locale === "ar" ? "فعّل تنبيه لأي منتج من تبويب التصفح." : "Enable an alert for any product from Browse."}/>}</PortalPanel> : null}

    {tab === "location" ? <PortalPanel title={locale === "ar" ? "موقع وضع المشتري" : "Buyer-mode location"} subtitle={locale === "ar" ? "الموقع ده بيحدد البلد والمنطقة والعملة ونتائج المتاجر، من غير ما يغيّر موقع فروع متجرك." : "This controls country, area, currency, and store results without changing your store branches."}><form className="portal-form" onSubmit={saveLocation}><div className="form-grid two"><label>{locale === "ar" ? "الدولة والمحافظة والمدينة" : "Country, governorate, and city"}<select required value={cityId} onChange={(event) => setCityId(event.target.value)}><option value="">{locale === "ar" ? "اختر الموقع" : "Choose location"}</option>{locationOptions.map((location) => <option key={text(location.id)} value={text(location.id)}>{locale === "ar" ? `${text(location.country_ar)} - ${text(location.governorate_ar)} - ${text(location.name_ar)}` : `${text(location.country_en)} - ${text(location.governorate_en)} - ${text(location.name_en)}`}</option>)}</select></label><label>{locale === "ar" ? "الإحداثيات (اختياري)" : "Coordinates (optional)"}<div className="coordinate-inline"><input inputMode="decimal" value={latitude} onChange={(event) => setLatitude(event.target.value)} placeholder={locale === "ar" ? "خط العرض" : "Latitude"}/><input inputMode="decimal" value={longitude} onChange={(event) => setLongitude(event.target.value)} placeholder={locale === "ar" ? "خط الطول" : "Longitude"}/></div></label></div><div className="form-actions"><button className="button secondary" type="button" onClick={useCurrentLocation}><Icon name="location"/>{locale === "ar" ? "استخدام موقعي الحالي" : "Use current location"}</button><button className="button primary" disabled={savingLocation}>{savingLocation ? (locale === "ar" ? "جارٍ الحفظ" : "Saving") : (locale === "ar" ? "حفظ الموقع" : "Save location")}</button></div></form></PortalPanel> : null}

    {requestOpen ? <div className="portal-modal-backdrop" role="presentation"><section className="portal-modal" role="dialog" aria-modal="true"><header><div><span className="eyebrow"><Icon name="quote" size={17}/>{locale === "ar" ? "طلب مخصوص" : "Direct request"}</span><h2>{text(selectedMerchant.store_name)}</h2><p>{locale === "ar" ? "الطلب هيوصل للمتجر ده فقط، مش لكل المتاجر." : "This request is sent only to this store."}</p></div><button className="icon-button" type="button" onClick={() => setRequestOpen(false)}><Icon name="close"/></button></header><form className="portal-form direct-request-form" onSubmit={submitDirectRequest}><div className="request-items-editor">{requestItems.map((item, index) => <div className="request-item-row" key={index}><label className="grow">{locale === "ar" ? "اسم المنتج" : "Item name"}<input required value={item.name} onChange={(event) => updateRequestItem(index, { name: event.target.value })}/></label><label>{locale === "ar" ? "الكمية" : "Quantity"}<input required type="number" min="0.0001" step="any" value={item.quantity} onChange={(event) => updateRequestItem(index, { quantity: Number(event.target.value) })}/></label><label>{locale === "ar" ? "الوحدة" : "Unit"}<input required value={item.unit} onChange={(event) => updateRequestItem(index, { unit: event.target.value })}/></label>{requestItems.length > 1 ? <button className="icon-button danger" type="button" onClick={() => setRequestItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Icon name="trash"/></button> : null}</div>)}</div><button className="button secondary" type="button" onClick={() => setRequestItems((current) => [...current, { name: "", quantity: 1, unit: locale === "ar" ? "قطعة" : "piece" }])}><Icon name="plus"/>{locale === "ar" ? "إضافة منتج" : "Add item"}</button><div className="modal-actions"><button className="button secondary" type="button" onClick={() => setRequestOpen(false)}>{locale === "ar" ? "إلغاء" : "Cancel"}</button><button className="button primary" disabled={sendingRequest}>{sendingRequest ? (locale === "ar" ? "جارٍ الإرسال" : "Sending") : (locale === "ar" ? "إرسال الطلب" : "Send request")}</button></div></form></section></div> : null}
  </div>;
}
