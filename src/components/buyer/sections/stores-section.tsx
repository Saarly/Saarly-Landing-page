"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Icon } from "@/components/icons";
import { buyerPost, buyerUpload } from "@/components/buyer/portal-client";
import { EmptyState, PortalPanel, StatusBadge } from "@/components/merchant/portal-ui";
import { money, numberValue, row, rows, text, type PortalRow } from "@/components/merchant/portal-utils";
import type { BuyerSectionProps } from "@/components/buyer/section-props";

type BuyerTab = "browse" | "favorites" | "alerts" | "location";
type RequestItem = { name: string; quantity: number; unit: string; productId?: string; categoryId?: string; confidence?: number | null; needsReview?: boolean };
type DirectRequestMode = "manual" | "image" | "pdf" | "voice";

export function BuyerStoresSection({ payload, locale, refresh, notify }: BuyerSectionProps) {
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
  const [requestMode, setRequestMode] = useState<DirectRequestMode>("manual");
  const [requestFile, setRequestFile] = useState<File | null>(null);
  const [requestAnalysisQuoteId, setRequestAnalysisQuoteId] = useState("");
  const [requestAnalysisNote, setRequestAnalysisNote] = useState("");
  const [requestRecording, setRequestRecording] = useState(false);
  const [requestRecordingSeconds, setRequestRecordingSeconds] = useState(0);
  const requestRecorderRef = useRef<MediaRecorder | null>(null);
  const requestStreamRef = useRef<MediaStream | null>(null);
  const requestChunksRef = useRef<Blob[]>([]);
  const requestTimerRef = useRef<number | null>(null);
  const discardRequestRecordingRef = useRef(false);

  const currency = payload.account.currencyCode || text(savedLocation.currency_code, "EGP");
  const selectedMerchantId = text(selectedMerchant.merchant_id);
  const favorites = useMemo(() => initialFavorites.filter((item) => favoriteIds.has(text(item.merchant_id || item.product_id))), [initialFavorites, favoriteIds]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const productId = new URLSearchParams(window.location.search).get("product");
    if (!productId) return;
    let cancelled = false;
    setTab("browse"); setLoadingProducts(true);
    void buyerPost("load_product_target", { productId }).then((result) => {
      if (cancelled) return;
      const target = row(result);
      setSelectedMerchant(row(target.merchant));
      setProducts(rows(target.products));
      window.setTimeout(() => document.querySelector<HTMLElement>(`[data-record-id="${productId.replace(/[^a-zA-Z0-9_-]/g, "")}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 180);
    }).catch((error) => notify(error instanceof Error ? error.message : "buyer_product_not_available", "error")).finally(() => { if (!cancelled) setLoadingProducts(false); });
    return () => { cancelled = true; };
  }, [notify]);

  useEffect(() => () => {
    if (requestTimerRef.current !== null) window.clearInterval(requestTimerRef.current);
    requestStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  async function searchStores(event?: FormEvent) {
    event?.preventDefault();
    setLoadingStores(true);
    try {
      const result = await buyerPost("search_stores", { categoryId, query: merchantQuery });
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
      const result = await buyerPost("load_store_products", { merchantId: id, query });
      setProducts(rows(result));
    } catch (error) { notify(error instanceof Error ? error.message : "buyer_products_load_failed", "error"); }
    finally { setLoadingProducts(false); }
  }

  async function favorite(type: "merchant" | "product", id: string) {
    try {
      const result = row(await buyerPost("toggle_favorite", { favoriteType: type, targetId: id }));
      const active = result.active === true;
      setFavoriteIds((current) => { const next = new Set(current); active ? next.add(id) : next.delete(id); return next; });
      if (!active && type === "product") setAlertProductIds((current) => { const next = new Set(current); next.delete(id); return next; });
      notify(locale === "ar" ? (active ? "تمت الإضافة للمفضلة." : "تمت الإزالة من المفضلة.") : (active ? "Added to favorites." : "Removed from favorites."), "success");
    } catch (error) { notify(error instanceof Error ? error.message : "favorite_failed", "error"); }
  }

  async function toggleAlert(productId: string) {
    try {
      const result = row(await buyerPost("toggle_price_alert", { productId }));
      const active = result.active === true;
      setAlertProductIds((current) => { const next = new Set(current); active ? next.add(productId) : next.delete(productId); return next; });
      if (active) setFavoriteIds((current) => new Set(current).add(productId));
      notify(locale === "ar" ? (active ? "تم تفعيل تنبيه السعر." : "تم إيقاف تنبيه السعر.") : (active ? "Price alert enabled." : "Price alert disabled."), "success");
      await refresh();
    } catch (error) { notify(error instanceof Error ? error.message : "price_alert_failed", "error"); }
  }

  async function stopAlert(alertId: string, productId: string) {
    try {
      await buyerPost("stop_price_alert", { alertId });
      if (productId) setAlertProductIds((current) => { const next = new Set(current); next.delete(productId); return next; });
      notify(locale === "ar" ? "تم إيقاف تنبيه السعر." : "Price alert stopped.", "success");
      await refresh();
    } catch (error) { notify(error instanceof Error ? error.message : "price_alert_failed", "error"); }
  }

  function resetDirectRequestInput(mode: DirectRequestMode = "manual") {
    if (requestTimerRef.current !== null) { window.clearInterval(requestTimerRef.current); requestTimerRef.current = null; }
    discardRequestRecordingRef.current = true;
    if (requestRecorderRef.current?.state === "recording") requestRecorderRef.current.stop();
    else discardRequestRecordingRef.current = false;
    requestStreamRef.current?.getTracks().forEach((track) => track.stop());
    requestRecorderRef.current = null; requestStreamRef.current = null; requestChunksRef.current = [];
    setRequestRecording(false); setRequestRecordingSeconds(0); setRequestMode(mode); setRequestFile(null); setRequestAnalysisQuoteId(""); setRequestAnalysisNote("");
  }

  function startRequest(product?: PortalRow, merchant: PortalRow = selectedMerchant) {
    if (!text(merchant.merchant_id)) return;
    setSelectedMerchant(merchant); resetDirectRequestInput("manual");
    setRequestItems(product ? [{
      name: text(product.name), quantity: 1, unit: text(product.unit, locale === "ar" ? "قطعة" : "piece"),
      productId: text(product.product_id), categoryId: text(product.category_id),
    }] : [{ name: "", quantity: 1, unit: locale === "ar" ? "قطعة" : "piece" }]);
    setRequestOpen(true);
  }

  async function startDirectVoiceRecording() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      notify(locale === "ar" ? "المتصفح لا يدعم التسجيل الصوتي. ارفع ملف صوت بدلًا من ذلك." : "This browser cannot record audio. Upload an audio file instead.", "error"); return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const supported = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"].find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, supported ? { mimeType: supported } : undefined);
      discardRequestRecordingRef.current = false;
      requestStreamRef.current = stream; requestRecorderRef.current = recorder; requestChunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size > 0) requestChunksRef.current.push(event.data); };
      recorder.onstop = () => {
        const mimeType = recorder.mimeType || supported || "audio/webm"; const extension = mimeType.includes("ogg") ? "ogg" : "webm";
        const blob = new Blob(requestChunksRef.current, { type: mimeType });
        if (!discardRequestRecordingRef.current && blob.size > 0) setRequestFile(new File([blob], `saarly-direct-${Date.now()}.${extension}`, { type: mimeType }));
        discardRequestRecordingRef.current = false;
        stream.getTracks().forEach((track) => track.stop()); requestStreamRef.current = null; requestRecorderRef.current = null;
      };
      recorder.start(500); setRequestRecording(true); setRequestRecordingSeconds(0);
      requestTimerRef.current = window.setInterval(() => setRequestRecordingSeconds((value) => value + 1), 1000);
    } catch { notify(locale === "ar" ? "تعذر تشغيل الميكروفون. راجع إذن الميكروفون." : "Could not start the microphone. Check browser permission.", "error"); }
  }

  function stopDirectVoiceRecording() {
    if (requestTimerRef.current !== null) { window.clearInterval(requestTimerRef.current); requestTimerRef.current = null; }
    if (requestRecorderRef.current?.state === "recording") requestRecorderRef.current.stop();
    setRequestRecording(false);
  }

  function updateRequestItem(index: number, patch: Partial<RequestItem>) {
    setRequestItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));
  }

  function directSearchScope() {
    const location = locationOptions.find((item) => text(item.id) === cityId) ?? savedLocation;
    return { scope: "city", location: {
      city_id: cityId || null, city: text(location.name_ar || location.city_ar || location.city), city_en: text(location.name_en || location.city_en),
      governorate: text(location.governorate_ar || location.governorate), governorate_en: text(location.governorate_en),
      country: text(location.country_ar || location.country, "مصر"), country_en: text(location.country_en, "Egypt"),
      latitude: latitude ? Number(latitude) : null, longitude: longitude ? Number(longitude) : null,
    } };
  }

  async function submitDirectRequest(event: FormEvent) {
    event.preventDefault();
    const items = requestItems.filter((item) => item.name.trim() && item.quantity > 0);
    if (!selectedMerchantId) return;
    setSendingRequest(true);
    try {
      const searchScope = directSearchScope();
      if (requestAnalysisQuoteId) {
        if (!items.length) throw new Error("quote_items_required");
        await buyerPost("approve_analyzed_quote", { quoteRequestId: requestAnalysisQuoteId, merchantId: selectedMerchantId, items, searchScope });
        notify(locale === "ar" ? "تم اعتماد القائمة وإرسال الطلب للمتجر فقط." : "The list was approved and sent only to this store.", "success");
        setRequestOpen(false); setRequestItems([]); resetDirectRequestInput(); await refresh(); return;
      }
      if (requestMode === "manual") {
        if (!items.length) throw new Error("quote_items_required");
        await buyerPost("create_manual_quote", { merchantId: selectedMerchantId, items, searchScope });
        notify(locale === "ar" ? "تم إرسال الطلب للمتجر فقط، وهيوصله إشعار فورًا." : "The request was sent only to this store and it has been notified.", "success");
        setRequestOpen(false); setRequestItems([]); resetDirectRequestInput(); await refresh(); return;
      }
      if (!requestFile) throw new Error("file_required");
      const uploaded = await buyerUpload(requestMode, requestFile);
      const analyzed = row(await buyerPost("analyze_upload", { source: requestMode, file: uploaded, locale, searchScope, location: row(searchScope.location) }));
      const result = row(analyzed.result);
      const extracted = rows(result.items).map((item) => ({
        name: text(item.product_name), quantity: Math.max(0.0001, numberValue(item.quantity, 1)), unit: text(item.unit, locale === "ar" ? "قطعة" : "piece"),
        confidence: item.confidence === null || item.confidence === undefined ? null : numberValue(item.confidence), needsReview: item.needs_review === true,
      })).filter((item) => item.name);
      if (!extracted.length) throw new Error("analysis_failed");
      setRequestItems(extracted); setRequestAnalysisQuoteId(text(analyzed.quote_request_id));
      setRequestAnalysisNote(text(result.summary, locale === "ar" ? "راجع العناصر ثم اعتمد الطلب." : "Review the items, then approve the request."));
      notify(locale === "ar" ? "تم تحليل الملف. راجع العناصر قبل الإرسال." : "The file was analyzed. Review the items before sending.", "success");
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
      await buyerPost("save_location", { cityId, latitude, longitude });
      notify(locale === "ar" ? "تم حفظ موقع المشتري." : "Buyer location saved.", "success");
      await refresh();
    } catch (error) { notify(error instanceof Error ? error.message : "location_save_failed", "error"); }
    finally { setSavingLocation(false); }
  }

  return <div className="portal-section-stack buyer-web-stores">

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
          {merchants.length ? <div className="buyer-store-list">{merchants.map((merchant) => { const id = text(merchant.merchant_id); return <article className={selectedMerchantId === id ? "selected" : ""} key={id} data-record-id={id}>{text(merchant.storefront_signed_url) ? <img className="buyer-store-thumb" src={text(merchant.storefront_signed_url)} alt={text(merchant.store_name)}/> : <span className="avatar-placeholder"><Icon name="store"/></span>}<div className="buyer-store-copy"><strong>{text(merchant.store_name)}</strong><small>{text(locale === "ar" ? merchant.primary_category_ar : merchant.primary_category_en)} · {text(merchant.city_name)} · {numberValue(merchant.products_count)} {locale === "ar" ? "منتج" : "products"}</small></div><div className="inline-actions"><button className={`icon-button ${favoriteIds.has(id) ? "active" : ""}`} type="button" onClick={() => void favorite("merchant", id)} aria-label={locale === "ar" ? "المفضلة" : "Favorite"}><Icon name={favoriteIds.has(id) ? "check" : "target"} size={18}/></button><button className="button secondary compact" type="button" onClick={() => void openStore(merchant)}>{locale === "ar" ? "فتح" : "Open"}</button><button className="button primary compact" type="button" onClick={() => startRequest(undefined, merchant)}>{locale === "ar" ? "طلب مخصوص" : "Direct request"}</button></div></article>; })}</div> : <EmptyState icon="store" title={locale === "ar" ? "لا توجد متاجر مطابقة" : "No matching stores"} body={locale === "ar" ? "غيّر القسم أو كلمة البحث أو راجع موقع المشتري." : "Change the category or search term, or review your location."}/>} 
        </PortalPanel>

        <PortalPanel title={selectedMerchantId ? text(selectedMerchant.store_name) : (locale === "ar" ? "منتجات المتجر" : "Store products")} subtitle={selectedMerchantId ? (locale === "ar" ? "ابحث داخل المتجر، احفظ منتجًا أو فعّل تنبيه سعر أو أرسل طلبًا مخصوصًا." : "Search inside the store, favorite items, enable price alerts, or send a direct request.") : undefined}>
          {selectedMerchantId ? <form className="buyer-product-search" onSubmit={(event) => { event.preventDefault(); void openStore(selectedMerchant, productQuery); }}><input value={productQuery} onChange={(event) => setProductQuery(event.target.value)} placeholder={locale === "ar" ? "ابحث داخل المتجر" : "Search this store"}/><button className="button secondary compact"><Icon name="search"/>{locale === "ar" ? "بحث" : "Search"}</button></form> : null}
          {loadingProducts ? <p className="muted-copy">{locale === "ar" ? "جارٍ تحميل المنتجات..." : "Loading products..."}</p> : products.length ? <div className="buyer-product-grid">{products.map((product) => { const id = text(product.product_id); return <article className="buyer-product-card" key={id} data-record-id={id}>{text(product.image_signed_url) ? <img src={text(product.image_signed_url)} alt={text(product.name)}/> : <span className="buyer-product-placeholder"><Icon name="box"/></span>}<strong>{text(product.name)}</strong><span>{money(product.price, currency, locale)} / {text(product.unit)}</span><small>{locale === "ar" ? `المتاح: ${numberValue(product.quantity)}` : `Available: ${numberValue(product.quantity)}`}</small><div className="buyer-product-actions"><button className="button secondary compact" type="button" onClick={() => void favorite("product", id)}>{favoriteIds.has(id) ? (locale === "ar" ? "إزالة المفضلة" : "Unfavorite") : (locale === "ar" ? "مفضلة" : "Favorite")}</button><button className={`button secondary compact ${alertProductIds.has(id) ? "active" : ""}`} type="button" onClick={() => void toggleAlert(id)}><Icon name="bell" size={17}/>{alertProductIds.has(id) ? (locale === "ar" ? "إيقاف التنبيه" : "Stop alert") : (locale === "ar" ? "تنبيه سعر" : "Price alert")}</button><button className="button primary compact" type="button" onClick={() => startRequest(product)}>{locale === "ar" ? "طلب مخصوص" : "Direct request"}</button></div></article>; })}</div> : <EmptyState title={selectedMerchantId ? (locale === "ar" ? "لا توجد منتجات مطابقة" : "No matching products") : (locale === "ar" ? "اختار متجر" : "Choose a store")} body={selectedMerchantId ? (locale === "ar" ? "غيّر كلمة البحث داخل المتجر." : "Change the in-store search term.") : (locale === "ar" ? "اضغط فتح على أي متجر عشان تشوف منتجاته." : "Open a store to see its products.")}/>} 
        </PortalPanel>
      </div>
    </> : null}

    {tab === "favorites" ? <PortalPanel title={locale === "ar" ? `المفضلة (${favorites.length})` : `Favorites (${favorites.length})`} subtitle={locale === "ar" ? "نفس العناصر المحفوظة في التطبيق." : "The same items saved in the app."}>{favorites.length ? <div className="buyer-favorites-grid">{favorites.map((item) => <article key={text(item.id)}><span className="favorite-preview">{text(item.image_signed_url) ? <img src={text(item.image_signed_url)} alt=""/> : <Icon name={text(item.favorite_type) === "merchant" ? "store" : "box"}/>}</span><div><strong>{text(item.title)}</strong><small>{text(item.subtitle)}</small></div><StatusBadge value={text(item.favorite_type) === "merchant" ? "store" : "active"} locale={locale}/><button className="button danger-button compact" type="button" onClick={() => void favorite(text(item.favorite_type) === "merchant" ? "merchant" : "product", text(item.merchant_id || item.product_id))}>{locale === "ar" ? "إزالة" : "Remove"}</button></article>)}</div> : <EmptyState icon="target" title={locale === "ar" ? "المفضلة فاضية" : "No favorites yet"} body={locale === "ar" ? "احفظ متجر أو منتج من تبويب التصفح." : "Save a store or product from Browse."}/>}</PortalPanel> : null}

    {tab === "alerts" ? <PortalPanel title={locale === "ar" ? `تنبيهات الأسعار (${initialAlerts.length})` : `Price alerts (${initialAlerts.length})`} subtitle={locale === "ar" ? "تابع السعر الحالي وآخر حالة مسجلة." : "Track the current price and latest status."}>{initialAlerts.length ? <div className="buyer-alert-list">{initialAlerts.map((alert) => <article key={text(alert.id)}><div><strong>{text(alert.title || alert.watched_product_text)}</strong><small>{text(alert.subtitle)}</small></div><div><span>{locale === "ar" ? "السعر الحالي" : "Current"}</span><strong>{money(alert.current_price, currency, locale)}</strong></div><StatusBadge value={alert.last_price_status} locale={locale}/><button className="button secondary compact" type="button" onClick={() => void stopAlert(text(alert.id), text(alert.product_id))}>{locale === "ar" ? "إيقاف" : "Stop"}</button></article>)}</div> : <EmptyState icon="bell" title={locale === "ar" ? "لا توجد تنبيهات سعر" : "No price alerts"} body={locale === "ar" ? "فعّل تنبيه لأي منتج من تبويب التصفح." : "Enable an alert for any product from Browse."}/>}</PortalPanel> : null}

    {tab === "location" ? <PortalPanel title={locale === "ar" ? "موقع المشتري" : "Buyer location"} subtitle={locale === "ar" ? "الموقع ده بيحدد البلد والمنطقة والعملة ونتائج المتاجر، ويحدد العملة والنتائج المناسبة ليك." : "This controls country, area, currency, and relevant store results."}><form className="portal-form" onSubmit={saveLocation}><div className="form-grid two"><label>{locale === "ar" ? "الدولة والمحافظة والمدينة" : "Country, governorate, and city"}<select required value={cityId} onChange={(event) => setCityId(event.target.value)}><option value="">{locale === "ar" ? "اختر الموقع" : "Choose location"}</option>{locationOptions.map((location) => <option key={text(location.id)} value={text(location.id)}>{locale === "ar" ? `${text(location.country_ar)} - ${text(location.governorate_ar)} - ${text(location.name_ar)}` : `${text(location.country_en)} - ${text(location.governorate_en)} - ${text(location.name_en)}`}</option>)}</select></label><label>{locale === "ar" ? "الإحداثيات (اختياري)" : "Coordinates (optional)"}<div className="coordinate-inline"><input inputMode="decimal" value={latitude} onChange={(event) => setLatitude(event.target.value)} placeholder={locale === "ar" ? "خط العرض" : "Latitude"}/><input inputMode="decimal" value={longitude} onChange={(event) => setLongitude(event.target.value)} placeholder={locale === "ar" ? "خط الطول" : "Longitude"}/></div></label></div><div className="form-actions"><button className="button secondary" type="button" onClick={useCurrentLocation}><Icon name="location"/>{locale === "ar" ? "استخدام موقعي الحالي" : "Use current location"}</button><button className="button primary" disabled={savingLocation}>{savingLocation ? (locale === "ar" ? "جارٍ الحفظ" : "Saving") : (locale === "ar" ? "حفظ الموقع" : "Save location")}</button></div></form></PortalPanel> : null}

    {requestOpen ? <div className="portal-modal-backdrop" role="presentation"><section className="portal-modal buyer-request-modal" role="dialog" aria-modal="true">
      <header><div><span className="eyebrow"><Icon name="quote" size={17}/>{locale === "ar" ? "طلب مخصوص" : "Direct request"}</span><h2>{text(selectedMerchant.store_name)}</h2><p>{locale === "ar" ? "اكتب الطلب أو ارفع صورة أو PDF أو سجله بصوتك. الطلب هيوصل للمتجر ده فقط." : "Enter the request, upload an image or PDF, or record it. It is sent only to this store."}</p></div><button className="icon-button" type="button" onClick={() => { setRequestOpen(false); resetDirectRequestInput(); }}><Icon name="close"/></button></header>
      <form className="portal-form direct-request-form" onSubmit={submitDirectRequest}>
        <div className="portal-subtabs request-source-tabs">{(["manual", "image", "pdf", "voice"] as DirectRequestMode[]).map((source) => <button type="button" className={requestMode === source ? "active" : ""} key={source} onClick={() => { resetDirectRequestInput(source); setRequestItems(source === "manual" ? [{ name: "", quantity: 1, unit: locale === "ar" ? "قطعة" : "piece" }] : []); }}>{source === "manual" ? (locale === "ar" ? "يدوي" : "Manual") : source === "image" ? (locale === "ar" ? "صورة" : "Image") : source.toUpperCase()}</button>)}</div>
        {requestMode !== "manual" && !requestAnalysisQuoteId && requestMode !== "voice" ? <label className="file-drop-zone"><Icon name="upload" size={28}/><strong>{locale === "ar" ? "اختار الملف" : "Choose file"}</strong><small>{requestMode === "image" ? "JPG, PNG, WEBP — 4MB" : "PDF — 18MB"}</small><input required type="file" accept={requestMode === "image" ? "image/jpeg,image/png,image/webp" : "application/pdf"} capture={requestMode === "image" ? "environment" : undefined} onChange={(event) => setRequestFile(event.target.files?.[0] ?? null)}/>{requestFile ? <span>{requestFile.name}</span> : null}</label> : null}
        {requestMode === "voice" && !requestAnalysisQuoteId ? <section className="voice-recorder-panel"><span className={`voice-recorder-icon ${requestRecording ? "recording" : ""}`}><Icon name="microphone" size={30}/></span><div><strong>{requestRecording ? (locale === "ar" ? "جارٍ التسجيل" : "Recording") : requestFile ? (locale === "ar" ? "التسجيل جاهز" : "Recording ready") : (locale === "ar" ? "سجّل الطلب بصوتك" : "Record your request")}</strong><small>{requestRecording ? `${Math.floor(requestRecordingSeconds / 60)}:${String(requestRecordingSeconds % 60).padStart(2, "0")}` : requestFile ? requestFile.name : (locale === "ar" ? "أو ارفع ملف صوت موجود." : "Or upload an existing audio file.")}</small></div><div className="inline-actions">{!requestRecording ? <button className="button primary compact" type="button" onClick={() => void startDirectVoiceRecording()}><Icon name="microphone"/>{locale === "ar" ? "بدء التسجيل" : "Start recording"}</button> : <button className="button danger-button compact" type="button" onClick={stopDirectVoiceRecording}><Icon name="stop"/>{locale === "ar" ? "إيقاف" : "Stop"}</button>}{requestFile ? <button className="button secondary compact" type="button" onClick={() => { setRequestFile(null); setRequestRecordingSeconds(0); }}>{locale === "ar" ? "مسح" : "Clear"}</button> : null}</div><label className="button secondary compact voice-file-button"><Icon name="upload"/>{locale === "ar" ? "رفع ملف صوت" : "Upload audio"}<input type="file" accept="audio/mpeg,audio/wav,audio/x-m4a,audio/mp4,audio/webm,audio/ogg" onChange={(event) => setRequestFile(event.target.files?.[0] ?? null)}/></label></section> : null}
        {requestAnalysisNote ? <div className="form-notice">{requestAnalysisNote}</div> : null}
        {(requestMode === "manual" || requestAnalysisQuoteId) ? <><div className="request-items-editor">{requestItems.map((item, index) => <div className={`request-item-row ${item.needsReview ? "needs-review" : ""}`} key={index}><label className="grow">{locale === "ar" ? "اسم المنتج" : "Item name"}<input required value={item.name} onChange={(event) => updateRequestItem(index, { name: event.target.value })}/></label><label>{locale === "ar" ? "الكمية" : "Quantity"}<input required type="number" min="0.0001" step="any" value={item.quantity} onChange={(event) => updateRequestItem(index, { quantity: Number(event.target.value) })}/></label><label>{locale === "ar" ? "الوحدة" : "Unit"}<input required value={item.unit} onChange={(event) => updateRequestItem(index, { unit: event.target.value })}/></label>{requestItems.length > 1 ? <button className="icon-button danger" type="button" onClick={() => setRequestItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Icon name="trash"/></button> : null}{item.confidence !== undefined && item.confidence !== null ? <small className="confidence-note">{locale === "ar" ? `ثقة التحليل: ${Math.round(item.confidence * 100)}%` : `Analysis confidence: ${Math.round(item.confidence * 100)}%`}</small> : null}</div>)}</div><button className="button secondary" type="button" onClick={() => setRequestItems((current) => [...current, { name: "", quantity: 1, unit: locale === "ar" ? "قطعة" : "piece" }])}><Icon name="plus"/>{locale === "ar" ? "إضافة منتج" : "Add item"}</button></> : null}
        <div className="modal-actions"><button className="button secondary" type="button" onClick={() => { setRequestOpen(false); resetDirectRequestInput(); }}>{locale === "ar" ? "إلغاء" : "Cancel"}</button><button className="button primary" disabled={sendingRequest}>{sendingRequest ? (locale === "ar" ? "جارٍ التنفيذ" : "Working") : requestAnalysisQuoteId ? (locale === "ar" ? "اعتماد وإرسال" : "Approve & send") : requestMode === "manual" ? (locale === "ar" ? "إرسال الطلب" : "Send request") : (locale === "ar" ? "رفع وتحليل" : "Upload & analyze")}</button></div>
      </form>
    </section></div> : null}
  </div>;
}
