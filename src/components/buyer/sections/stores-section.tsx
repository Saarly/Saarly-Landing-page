"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Icon } from "@/components/icons";
import { buyerPost, buyerUpload } from "@/components/buyer/portal-client";
import { EmptyState, Notice, PortalPanel, StatusBadge } from "@/components/merchant/portal-ui";
import { usePortalConfirm } from "@/components/portal-v2/portal-dialogs";
import { MerchantTrustBadges } from "@/components/portal-v2/merchant-trust-badges";
import { CoordinateMapPicker } from "@/components/portal-v2/coordinate-map-picker";
import { money, numberValue, row, rows, text, unitLabel, type PortalRow } from "@/components/merchant/portal-utils";
import type { BuyerSectionProps } from "@/components/buyer/section-props";

type BuyerTab = "browse" | "favorites" | "alerts" | "location";
type RequestItem = { name: string; quantity: number; unit: string; productId?: string; categoryId?: string; confidence?: number | null; needsReview?: boolean };
type CartItem = { productId: string; merchantId: string; merchantName: string; productName: string; unit: string; unitPrice: number; quantity: number; availableQuantity: number; imageUrl: string };
type DirectRequestMode = "manual" | "image" | "pdf" | "voice";

function normalizePlace(input: unknown) {
  return String(input ?? "").trim().toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/\s+/g, " ");
}


export function BuyerStoresSection({ payload, locale, refresh, notify }: BuyerSectionProps) {
  const { confirm, confirmDialog } = usePortalConfirm(locale);
  const data = payload.data;
  const categories = rows(data.categories);
  const initialFavorites = rows(data.favorites);
  const locationOptions = rows(data.locationOptions).filter((item) => item.is_country_marker !== true);
  const locationLabel = (cityValue: unknown, governorateValue: unknown) => {
    const cityKey = normalizePlace(cityValue);
    const governorateKey = normalizePlace(governorateValue);
    const match = locationOptions.find((option) => {
      const cityNames = [option.name_ar, option.name_en].map(normalizePlace).filter(Boolean);
      const governorateNames = [option.governorate_ar, option.governorate_en].map(normalizePlace).filter(Boolean);
      return (!cityKey || cityNames.includes(cityKey)) && (!governorateKey || governorateNames.includes(governorateKey));
    });
    if (!match) return locale === "ar" ? "الموقع غير محدد" : "Location not set";
    const cityName = text(locale === "ar" ? match.name_ar : match.name_en);
    const governorateName = text(locale === "ar" ? match.governorate_ar : match.governorate_en);
    return [cityName, governorateName].filter(Boolean).join(" - ") || (locale === "ar" ? "الموقع غير محدد" : "Location not set");
  };
  const savedLocation = row(data.location);
  const initialAlerts = rows(data.priceAlerts).filter((item) => item.is_active === true);
  const [tab, setTab] = useState<BuyerTab>("browse");
  const [merchants, setMerchants] = useState<PortalRow[]>(rows(data.merchants));
  const [products, setProducts] = useState<PortalRow[]>([]);
  const [selectedMerchant, setSelectedMerchant] = useState<PortalRow>({});
  const [productDetails, setProductDetails] = useState<PortalRow | null>(null);
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
  const [requestScope, setRequestScope] = useState("city");
  const [requestFile, setRequestFile] = useState<File | null>(null);
  const [requestAnalysisQuoteId, setRequestAnalysisQuoteId] = useState("");
  const [requestAnalysisNote, setRequestAnalysisNote] = useState("");
  const [requestRecording, setRequestRecording] = useState(false);
  const [requestRecordingSeconds, setRequestRecordingSeconds] = useState(0);
  const [cartItems, setCartItems] = useState<Record<string, CartItem>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [cartMerchantId, setCartMerchantId] = useState("");
  const [cartPreview, setCartPreview] = useState<PortalRow | null>(null);
  const [cartBusy, setCartBusy] = useState(false);
  const [cartLoaded, setCartLoaded] = useState(false);
  const [cartLoadedKey, setCartLoadedKey] = useState("");
  const requestRecorderRef = useRef<MediaRecorder | null>(null);
  const requestStreamRef = useRef<MediaStream | null>(null);
  const requestChunksRef = useRef<Blob[]>([]);
  const requestTimerRef = useRef<number | null>(null);
  const discardRequestRecordingRef = useRef(false);

  const currency = payload.account.currencyCode || text(savedLocation.currency_code, "EGP");
  const selectedMerchantId = text(selectedMerchant.merchant_id);
  const favorites = useMemo(() => initialFavorites.filter((item) => text(item.favorite_type) === "search" || favoriteIds.has(text(item.merchant_id || item.product_id))), [initialFavorites, favoriteIds]);
  const cartStorageKey = `buyer.catalog_cart.${payload.account.userId || "guest"}`;
  const cartRows = useMemo(() => Object.values(cartItems), [cartItems]);
  const selectedMerchantCart = cartRows.filter((item) => item.merchantId === selectedMerchantId);
  const openCartRows = cartRows.filter((item) => item.merchantId === cartMerchantId);
  const openCartSubtotal = openCartRows.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const openCartMerchantName = text(openCartRows[0]?.merchantName, text(selectedMerchant.store_name, locale === "ar" ? "سلة المتجر" : "Store cart"));
  const totalCartQuantity = cartRows.reduce((sum, item) => sum + item.quantity, 0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const savedScope = window.localStorage.getItem("saarly_buyer_search_scope_v1");
      if (savedScope && ["city", "governorate", "country"].includes(savedScope)) setRequestScope(savedScope);
    } catch { /* browser storage is optional */ }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const timer = window.setTimeout(() => {
      setCartLoaded(false);
      try {
        const raw = window.localStorage.getItem(cartStorageKey);
        const parsed = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(parsed)) return;
        const next: Record<string, CartItem> = {};
        parsed.forEach((item) => {
          const row = item && typeof item === "object" ? item as Record<string, unknown> : {};
          const productId = text(row.productId || row.product_id);
          const merchantId = text(row.merchantId || row.merchant_id);
          const quantity = Math.max(0, numberValue(row.quantity));
          if (!productId || !merchantId || quantity <= 0) return;
          next[productId] = {
            productId,
            merchantId,
            merchantName: text(row.merchantName || row.merchant_name),
            productName: text(row.productName || row.product_name),
            unit: text(row.unit),
            unitPrice: numberValue(row.unitPrice || row.unit_price),
            quantity,
            availableQuantity: numberValue(row.availableQuantity || row.available_quantity),
            imageUrl: text(row.imageUrl || row.image_url),
          };
        });
        setCartItems(next);
      } catch {
        setCartItems({});
      } finally {
        setCartLoadedKey(cartStorageKey);
        setCartLoaded(true);
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, [cartStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!cartLoaded || cartLoadedKey !== cartStorageKey) return;
    window.localStorage.setItem(cartStorageKey, JSON.stringify(Object.values(cartItems)));
  }, [cartItems, cartLoaded, cartLoadedKey, cartStorageKey]);

  useEffect(() => {
    if (!cartOpen || !cartMerchantId) return;
    const items = Object.values(cartItems).filter((item) => item.merchantId === cartMerchantId);
    if (!items.length) {
      const emptyTimer = window.setTimeout(() => setCartPreview(null), 0);
      return () => window.clearTimeout(emptyTimer);
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setCartBusy(true);
      void buyerPost("preview_catalog_cart", { merchantId: cartMerchantId, items })
        .then((result) => { if (!cancelled) setCartPreview(row(result)); })
        .catch((error) => { if (!cancelled) notify(error instanceof Error ? error.message : "catalog_cart_preview_failed", "error"); })
        .finally(() => { if (!cancelled) setCartBusy(false); });
    }, 180);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [cartItems, cartMerchantId, cartOpen, notify]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const initialQuery = text(params.get("q"));
    const focusMerchantId = text(params.get("focus"));
    if (!initialQuery && !focusMerchantId) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setTab("browse");
      if (initialQuery) {
        setMerchantQuery(initialQuery);
        setLoadingStores(true);
        void buyerPost("search_stores", { categoryId: "", query: initialQuery })
          .then((result) => { if (!cancelled) setMerchants(rows(result)); })
          .catch((error) => { if (!cancelled) notify(error instanceof Error ? error.message : "buyer_search_failed", "error"); })
          .finally(() => { if (!cancelled) setLoadingStores(false); });
      }
      if (focusMerchantId) {
        const merchant = rows(data.merchants).find((item) => text(item.merchant_id) === focusMerchantId);
        if (merchant) void openStore(merchant);
      }
    }, 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
  // Initial deep-link/search bootstrap intentionally runs for the loaded storefront payload.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const productId = new URLSearchParams(window.location.search).get("product");
    if (!productId) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setTab("browse"); setLoadingProducts(true);
      void buyerPost("load_product_target", { productId }).then((result) => {
        if (cancelled) return;
        const target = row(result);
        setSelectedMerchant(row(target.merchant));
        const targetProducts = rows(target.products);
        setProducts(targetProducts);
        const focusedProduct = targetProducts.find((item) => text(item.product_id) === productId);
        if (focusedProduct) setProductDetails(focusedProduct);
        window.setTimeout(() => document.querySelector<HTMLElement>(`[data-record-id="${productId.replace(/[^a-zA-Z0-9_-]/g, "")}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 180);
      }).catch((error) => notify(error instanceof Error ? error.message : "buyer_product_not_available", "error")).finally(() => { if (!cancelled) setLoadingProducts(false); });
    }, 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
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
      setFavoriteIds((current) => {
        const next = new Set(current);
        if (active) next.add(id);
        else next.delete(id);
        return next;
      });
      if (!active && type === "product") setAlertProductIds((current) => { const next = new Set(current); next.delete(id); return next; });
      notify(locale === "ar" ? (active ? "تمت الإضافة للمفضلة." : "تمت الإزالة من المفضلة.") : (active ? "Added to favorites." : "Removed from favorites."), "success");
    } catch (error) { notify(error instanceof Error ? error.message : "favorite_failed", "error"); }
  }

  async function removeFavoriteItem(item: PortalRow) {
    const type = text(item.favorite_type);
    const targetId = type === "merchant" ? text(item.merchant_id) : type === "product" ? text(item.product_id) : "";
    try {
      await buyerPost("toggle_favorite", { favoriteType: type, targetId, searchText: text(item.search_text) });
      notify(locale === "ar" ? "تمت الإزالة من المفضلة." : "Removed from favorites.", "success");
      await refresh();
    } catch (error) { notify(error instanceof Error ? error.message : "favorite_failed", "error"); }
  }

  async function toggleAlert(productId: string) {
    try {
      const result = row(await buyerPost("toggle_price_alert", { productId }));
      const active = result.active === true;
      setAlertProductIds((current) => {
        const next = new Set(current);
        if (active) next.add(productId);
        else next.delete(productId);
        return next;
      });
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

  function addToCart(product: PortalRow) {
    const productId = text(product.product_id);
    const merchantId = text(product.merchant_id || selectedMerchantId);
    if (!productId || !merchantId) return;
    if (selectedMerchant.can_receive_orders === false) {
      notify(locale === "ar" ? "المتجر لا يستقبل طلبات شراء جديدة حاليًا." : "This store is not accepting new purchase orders right now.", "error");
      return;
    }
    const availableQuantity = Math.max(0, numberValue(product.quantity));
    setCartItems((current) => {
      const currentItem = current[productId];
      const nextQuantity = (currentItem?.quantity ?? 0) + 1;
      if (availableQuantity > 0 && nextQuantity > availableQuantity) {
        notify(locale === "ar" ? "الكمية المطلوبة أكبر من المتاح." : "Requested quantity exceeds available stock.", "error");
        return current;
      }
      return {
        ...current,
        [productId]: {
          productId,
          merchantId,
          merchantName: text(selectedMerchant.store_name),
          productName: text(product.name),
          unit: unitLabel(product.unit, locale, locale === "ar" ? "قطعة" : "piece"),
          unitPrice: numberValue(product.price),
          quantity: nextQuantity,
          availableQuantity,
          imageUrl: text(product.image_signed_url),
        },
      };
    });
    notify(locale === "ar" ? "تمت إضافة المنتج إلى سلة المتجر." : "Product added to this store cart.", "success");
  }

  function updateCartQuantity(productId: string, quantity: number) {
    setCartItems((current) => {
      const currentItem = current[productId];
      if (!currentItem) return current;
      const next = { ...current };
      if (quantity <= 0) delete next[productId];
      else next[productId] = { ...currentItem, quantity: currentItem.availableQuantity > 0 ? Math.min(quantity, currentItem.availableQuantity) : quantity };
      return next;
    });
  }

  async function openCart(merchantId = selectedMerchantId) {
    if (!merchantId) return;
    setCartMerchantId(merchantId); setCartPreview(null); setCartOpen(true);
  }

  async function clearStoreCart() {
    if (!(await confirm({ title: locale === "ar" ? "تفريغ سلة المتجر" : "Clear store cart", body: locale === "ar" ? "سيتم إزالة كل منتجات المتجر من السلة الحالية." : "All products from this store will be removed from the current cart.", confirmLabel: locale === "ar" ? "تفريغ السلة" : "Clear cart", tone: "danger" }))) return;
    setCartItems((current) => { const next = { ...current }; openCartRows.forEach((item) => delete next[item.productId]); return next; });
    setCartPreview(null);
  }

  async function submitCart() {
    if (!cartMerchantId || !openCartRows.length) return;
    setCartBusy(true);
    try {
      const result = row(await buyerPost("create_catalog_cart_order", { merchantId: cartMerchantId, items: openCartRows }));
      setCartItems((current) => {
        const next = { ...current };
        openCartRows.forEach((item) => delete next[item.productId]);
        return next;
      });
      setCartOpen(false); setCartPreview(null);
      notify(locale === "ar" ? "تم إرسال طلب الشراء إلى المتجر، وهو الآن في انتظار تأكيد المتجر." : "The purchase order was sent to the store and is waiting for confirmation.", "success");
      if (text(result.order_id || result.orderId)) window.history.replaceState(null, "", `/buyer/orders?focus=${encodeURIComponent(text(result.order_id || result.orderId))}`);
      await refresh();
    } catch (error) { notify(error instanceof Error ? error.message : "catalog_cart_submit_failed", "error"); }
    finally { setCartBusy(false); }
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
    if (merchant.can_receive_orders === false) {
      notify(locale === "ar" ? "المتجر لا يستقبل طلبات جديدة حاليًا." : "This store is not receiving new requests right now.", "error");
      return;
    }
    setSelectedMerchant(merchant); resetDirectRequestInput("manual");
    setRequestItems(product ? [{
      name: text(product.name), quantity: 1, unit: unitLabel(product.unit, locale, locale === "ar" ? "قطعة" : "piece"),
      productId: text(product.product_id), categoryId: text(product.category_id),
    }] : [{ name: "", quantity: 1, unit: locale === "ar" ? "قطعة" : "piece" }]);
    setRequestOpen(true);
  }

  async function startDirectVoiceRecording() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      notify(locale === "ar" ? "التسجيل الصوتي غير متاح هنا. ارفع ملفًا صوتيًا بدلًا من ذلك." : "Audio recording is unavailable here. Upload an audio file instead.", "error"); return;
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
    } catch { notify(locale === "ar" ? "تعذر تشغيل الميكروفون. اسمح باستخدامه من إعدادات الجهاز." : "Could not start the microphone. Allow microphone access in your device settings.", "error"); }
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
    return { scope: requestScope, location: {
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
        name: text(item.product_name), quantity: Math.max(0.0001, numberValue(item.quantity, 1)), unit: unitLabel(item.unit, locale, locale === "ar" ? "قطعة" : "piece"),
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
    if (!navigator.geolocation) { notify(locale === "ar" ? "تحديد الموقع غير مدعوم على هذا الجهاز." : "Location access is not supported on this device.", "error"); return; }
    navigator.geolocation.getCurrentPosition(
      (position) => { setLatitude(String(position.coords.latitude)); setLongitude(String(position.coords.longitude)); },
      () => notify(locale === "ar" ? "تعذر الوصول لموقعك. اسمح للموقع بالوصول إلى مكانك من إعدادات الجهاز." : "Could not access your location. Allow location access in your device settings.", "error"),
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }

  function updateMapLocation(nextLatitude: string, nextLongitude: string, resolved?: { city?: string; governorate?: string; country?: string }) {
    setLatitude(nextLatitude); setLongitude(nextLongitude);
    if (!resolved) return;
    const city = normalizePlace(resolved.city);
    const governorate = normalizePlace(resolved.governorate);
    const country = normalizePlace(resolved.country);
    const matched = locationOptions.find((item) => {
      const cityNames = [item.name_ar, item.name_en].map(normalizePlace);
      const govNames = [item.governorate_ar, item.governorate_en].map(normalizePlace);
      const countryNames = [item.country_ar, item.country_en].map(normalizePlace);
      const cityMatch = !city || cityNames.some((name) => name && (name === city || name.includes(city) || city.includes(name)));
      const govMatch = !governorate || govNames.some((name) => name && (name === governorate || name.includes(governorate) || governorate.includes(name)));
      const countryMatch = !country || countryNames.some((name) => name && (name === country || name.includes(country) || country.includes(name)));
      return cityMatch && govMatch && countryMatch;
    });
    if (matched) setCityId(text(matched.id));
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

    {totalCartQuantity > 0 ? <PortalPanel title={locale === "ar" ? `سلة المشتريات (${totalCartQuantity})` : `Shopping cart (${totalCartQuantity})`} subtitle={locale === "ar" ? "كل متجر له طلب منفصل. إرسال سلة متجر لا يغير سلات المتاجر الأخرى." : "Each store has a separate order. Sending one store cart does not affect the others."} action={<button className="button primary compact" type="button" onClick={() => void openCart(cartRows[0]?.merchantId)}><Icon name="receipt" size={17}/>{locale === "ar" ? "فتح السلة" : "Open cart"}</button>}>
      <div className="cart-store-list">{[...new Map(cartRows.map((item) => [item.merchantId, item])).values()].map((item) => { const items = cartRows.filter((row) => row.merchantId === item.merchantId); const count = items.reduce((sum, row) => sum + row.quantity, 0); const subtotal = items.reduce((sum, row) => sum + row.unitPrice * row.quantity, 0); return <button className="cart-store-chip" type="button" key={item.merchantId} onClick={() => void openCart(item.merchantId)}><Icon name="store" size={17}/><span>{item.merchantName}</span><strong>{count}</strong><small>{money(subtotal, currency, locale)}</small></button>; })}</div>
    </PortalPanel> : null}

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
          {merchants.length ? <div className="buyer-store-list">{merchants.map((merchant) => { const id = text(merchant.merchant_id); return <article className={selectedMerchantId === id ? "selected" : ""} key={id} data-record-id={id}>{text(merchant.storefront_signed_url) ? <img className="buyer-store-thumb" src={text(merchant.storefront_signed_url)} alt={text(merchant.store_name)}/> : <span className="avatar-placeholder"><Icon name="store"/></span>}<div className="buyer-store-copy"><strong>{text(merchant.store_name)}</strong><MerchantTrustBadges founderEnabled={merchant.founder_badge_enabled === true} trustedEnabled={merchant.trusted_badge_enabled === true} founderNumber={merchant.founder_number} locale={locale} compact/><small>{text(locale === "ar" ? merchant.primary_category_ar : merchant.primary_category_en)} · {locationLabel(merchant.city_name, merchant.governorate_name)}</small><span className="storefront-facts"><span><Icon name="box" size={14}/>{numberValue(merchant.products_count)} {locale === "ar" ? "منتج" : "products"}</span><span><Icon name="star" size={14}/>{numberValue(merchant.reviews_count) > 0 ? `${numberValue(merchant.average_rating).toFixed(1)} (${numberValue(merchant.reviews_count)})` : (locale === "ar" ? "بدون تقييمات" : "No reviews")}</span>{merchant.craftsman_available === true ? <span><Icon name="settings" size={14}/>{locale === "ar" ? "فني متاح" : "Craftsperson available"}</span> : null}</span></div><div className="inline-actions"><button className={`icon-button ${favoriteIds.has(id) ? "active" : ""}`} type="button" onClick={() => void favorite("merchant", id)} aria-label={locale === "ar" ? "المفضلة" : "Favorite"} title={favoriteIds.has(id) ? (locale === "ar" ? "إزالة من المفضلة" : "Remove favorite") : (locale === "ar" ? "إضافة للمفضلة" : "Add favorite")}><Icon name={favoriteIds.has(id) ? "check" : "target"} size={18}/></button><button className="button secondary compact" type="button" onClick={() => void openStore(merchant)}>{numberValue(merchant.products_count) > 0 ? (locale === "ar" ? "عرض المنتجات" : "View products") : (locale === "ar" ? "فتح المتجر" : "Open store")}</button><button className="button primary compact" type="button" disabled={merchant.can_receive_orders === false} onClick={() => startRequest(undefined, merchant)}>{locale === "ar" ? "طلب مخصوص" : "Direct request"}</button></div></article>; })}</div> : <EmptyState icon="store" title={locale === "ar" ? "لا توجد متاجر مطابقة" : "No matching stores"} body={locale === "ar" ? "غيّر القسم أو كلمة البحث أو راجع موقع المشتري." : "Change the category or search term, or review your location."}/>} 
        </PortalPanel>

        <PortalPanel title={selectedMerchantId ? text(selectedMerchant.store_name) : (locale === "ar" ? "منتجات المتجر" : "Store products")} subtitle={selectedMerchantId ? (locale === "ar" ? "ابحث داخل المتجر، احفظ منتجًا أو فعّل تنبيه سعر أو أرسل طلبًا مخصوصًا." : "Search inside the store, favorite items, enable price alerts, or send a direct request.") : undefined} action={selectedMerchantCart.length ? <button className="button primary compact" type="button" onClick={() => void openCart(selectedMerchantId)}><Icon name="receipt" size={17}/>{locale === "ar" ? `سلة المتجر (${selectedMerchantCart.reduce((sum, item) => sum + item.quantity, 0)})` : `Store cart (${selectedMerchantCart.reduce((sum, item) => sum + item.quantity, 0)})`}</button> : undefined}>
          {selectedMerchantId ? <MerchantTrustBadges founderEnabled={selectedMerchant.founder_badge_enabled === true} trustedEnabled={selectedMerchant.trusted_badge_enabled === true} founderNumber={selectedMerchant.founder_number} locale={locale}/> : null}
          {selectedMerchantId ? <div className="storefront-selected-summary">
            <div className="storefront-facts"><span><Icon name="star" size={14}/>{numberValue(selectedMerchant.reviews_count) > 0 ? `${numberValue(selectedMerchant.average_rating).toFixed(1)} (${numberValue(selectedMerchant.reviews_count)})` : (locale === "ar" ? "بدون تقييمات" : "No reviews")}</span>{selectedMerchant.craftsman_available === true ? <span><Icon name="settings" size={14}/>{locale === "ar" ? "خدمة فني متاحة" : "Craftsperson service available"}</span> : null}</div>
            {rows(selectedMerchant.categories).length ? <div className="storefront-category-chips"><strong>{locale === "ar" ? "الأقسام" : "Categories"}</strong><div>{rows(selectedMerchant.categories).map((category) => <span className={category.is_primary === true ? "primary" : ""} key={text(category.id || category.category_id)}>{category.is_primary === true ? <Icon name="check" size={13}/> : null}{text(locale === "ar" ? category.name_ar : category.name_en)}</span>)}</div></div> : null}
            {rows(selectedMerchant.branches).length ? <div className="storefront-branch-list"><strong>{locale === "ar" ? "الفروع" : "Branches"}</strong>{rows(selectedMerchant.branches).map((branch) => <article key={text(branch.id)}><Icon name="location" size={17}/><div><b>{text(branch.name)}</b><small>{locationLabel(branch.city_name, branch.governorate_name)}</small></div>{branch.craftsman_available === true ? <span title={locale === "ar" ? "خدمة فني متاحة" : "Craftsperson available"}><Icon name="settings" size={16}/></span> : null}</article>)}</div> : null}
            <div className="storefront-contact-privacy"><Icon name="shield" size={17}/><span>{locale === "ar" ? "رقم التواصل محمي ويظهر لصاحب الطلب داخل تفاصيل الطلب المخصوص الناجح فقط." : "Contact details stay protected and appear only to the requester inside a successful direct request."}</span></div>
            {selectedMerchant.can_receive_orders === false ? <Notice tone="warning">{locale === "ar" ? "المتجر غير متاح لاستقبال طلبات جديدة حاليًا، لكن تقدر تتصفح المنتجات والمعلومات." : "This store is not receiving new requests right now, but you can still browse its products and details."}</Notice> : null}
          </div> : null}
          {selectedMerchantId ? <form className="buyer-product-search" onSubmit={(event) => { event.preventDefault(); void openStore(selectedMerchant, productQuery); }}><input value={productQuery} onChange={(event) => setProductQuery(event.target.value)} placeholder={locale === "ar" ? "ابحث داخل المتجر" : "Search this store"}/><button className="button secondary compact"><Icon name="search"/>{locale === "ar" ? "بحث" : "Search"}</button></form> : null}
          {loadingProducts ? <p className="muted-copy">{locale === "ar" ? "جارٍ تحميل المنتجات..." : "Loading products..."}</p> : products.length ? <div className="buyer-product-grid">{products.map((product) => { const id = text(product.product_id); const cartQuantity = cartItems[id]?.quantity ?? 0; return <article className="buyer-product-card" key={id} data-record-id={id}>{text(product.image_signed_url) ? <img src={text(product.image_signed_url)} alt={text(product.name)}/> : <span className="buyer-product-placeholder"><Icon name="box"/></span>}<strong>{text(product.name)}</strong><span>{money(product.price, currency, locale)} / {unitLabel(product.unit, locale)}</span><small>{locale === "ar" ? `المتاح: ${numberValue(product.quantity)}` : `Available: ${numberValue(product.quantity)}`}</small>{[text(product.brand), text(product.size), text(product.color)].filter(Boolean).length ? <small className="product-meta-line">{[text(product.brand), text(product.size), text(product.color)].filter(Boolean).join(" - ")}</small> : null}<div className="buyer-product-actions"><button className="button secondary compact" type="button" onClick={() => setProductDetails(product)}><Icon name="info" size={17}/>{locale === "ar" ? "تفاصيل" : "Details"}</button><button className="button secondary compact" type="button" onClick={() => void favorite("product", id)}>{favoriteIds.has(id) ? (locale === "ar" ? "إزالة المفضلة" : "Unfavorite") : (locale === "ar" ? "مفضلة" : "Favorite")}</button><button className={`button secondary compact ${alertProductIds.has(id) ? "active" : ""}`} type="button" onClick={() => void toggleAlert(id)}><Icon name="bell" size={17}/>{alertProductIds.has(id) ? (locale === "ar" ? "إيقاف التنبيه" : "Stop alert") : (locale === "ar" ? "تنبيه سعر" : "Price alert")}</button><button className="button secondary compact" type="button" disabled={selectedMerchant.can_receive_orders === false || numberValue(product.quantity) <= 0 || product.is_available === false} onClick={() => addToCart(product)}><Icon name="receipt" size={17}/>{cartQuantity > 0 ? (locale === "ar" ? `في السلة (${cartQuantity})` : `In cart (${cartQuantity})`) : (locale === "ar" ? "إضافة للسلة" : "Add to cart")}</button><button className="button primary compact" type="button" disabled={selectedMerchant.can_receive_orders === false} onClick={() => startRequest(product)}>{locale === "ar" ? "طلب مخصوص" : "Direct request"}</button></div></article>; })}</div> : <EmptyState title={selectedMerchantId ? (locale === "ar" ? "لا توجد منتجات مطابقة" : "No matching products") : (locale === "ar" ? "اختار متجر" : "Choose a store")} body={selectedMerchantId ? (locale === "ar" ? "غيّر كلمة البحث داخل المتجر." : "Change the in-store search term.") : (locale === "ar" ? "اضغط فتح على أي متجر عشان تشوف منتجاته." : "Open a store to see its products.")}/>} 
        </PortalPanel>
      </div>
    </> : null}

    {tab === "favorites" ? <PortalPanel title={locale === "ar" ? `المفضلة (${favorites.length})` : `Favorites (${favorites.length})`} subtitle={locale === "ar" ? "المتاجر والمنتجات وعمليات البحث المحفوظة، بنفس أنواع المفضلة في التطبيق." : "Saved stores, products, and search terms, matching the app favorite types."} action={<a className="button secondary compact" href="/buyer/favorites"><Icon name="target" size={16}/>{locale === "ar" ? "إدارة المفضلة" : "Manage favorites"}</a>}>{favorites.length ? <div className="buyer-favorites-grid">{favorites.map((item) => { const type = text(item.favorite_type); return <article key={text(item.id)}><span className="favorite-preview">{text(item.image_signed_url) ? <img src={text(item.image_signed_url)} alt=""/> : <Icon name={type === "merchant" ? "store" : type === "search" ? "search" : "box"}/>}</span><div><strong>{text(item.title, text(item.search_text))}</strong><small>{text(item.subtitle) || (type === "search" ? (locale === "ar" ? "بحث محفوظ" : "Saved search") : "")}</small></div><StatusBadge value={type} locale={locale}/><div className="inline-actions">{type === "search" ? <a className="button secondary compact" href={`/buyer/stores?q=${encodeURIComponent(text(item.search_text))}`}>{locale === "ar" ? "إعادة البحث" : "Search again"}</a> : null}<button className="button danger-button compact" type="button" onClick={() => void removeFavoriteItem(item)}>{locale === "ar" ? "إزالة" : "Remove"}</button></div></article>; })}</div> : <EmptyState icon="target" title={locale === "ar" ? "المفضلة فاضية" : "No favorites yet"} body={locale === "ar" ? "احفظ متجرًا أو منتجًا أو عبارة بحث من صفحة المفضلة." : "Save a store, product, or search term from Favorites."}/>}</PortalPanel> : null}

    {tab === "alerts" ? <PortalPanel title={locale === "ar" ? `تنبيهات الأسعار (${initialAlerts.length})` : `Price alerts (${initialAlerts.length})`} subtitle={locale === "ar" ? "تابع السعر الحالي وآخر حالة مسجلة." : "Track the current price and latest status."}>{initialAlerts.length ? <div className="buyer-alert-list">{initialAlerts.map((alert) => <article key={text(alert.id)}><div><strong>{text(alert.title || alert.watched_product_text)}</strong><small>{text(alert.subtitle)}</small></div><div><span>{locale === "ar" ? "السعر الحالي" : "Current"}</span><strong>{money(alert.current_price, currency, locale)}</strong></div><StatusBadge value={alert.last_price_status} locale={locale}/><button className="button secondary compact" type="button" onClick={() => void stopAlert(text(alert.id), text(alert.product_id))}>{locale === "ar" ? "إيقاف" : "Stop"}</button></article>)}</div> : <EmptyState icon="bell" title={locale === "ar" ? "لا توجد تنبيهات سعر" : "No price alerts"} body={locale === "ar" ? "فعّل تنبيه لأي منتج من تبويب التصفح." : "Enable an alert for any product from Browse."}/>}</PortalPanel> : null}

    {tab === "location" ? <PortalPanel title={locale === "ar" ? "موقع المشتري" : "Buyer location"} subtitle={locale === "ar" ? "الموقع ده بيحدد البلد والمنطقة والعملة ونتائج المتاجر، ويحدد العملة والنتائج المناسبة ليك." : "This controls country, area, currency, and relevant store results."}><form className="portal-form" onSubmit={saveLocation}><div className="form-grid two"><label>{locale === "ar" ? "الدولة والمحافظة والمدينة" : "Country, governorate, and city"}<select required value={cityId} onChange={(event) => setCityId(event.target.value)}><option value="">{locale === "ar" ? "اختر الموقع" : "Choose location"}</option>{locationOptions.map((location) => <option key={text(location.id)} value={text(location.id)}>{locale === "ar" ? `${text(location.country_ar)} - ${text(location.governorate_ar)} - ${text(location.name_ar)}` : `${text(location.country_en)} - ${text(location.governorate_en)} - ${text(location.name_en)}`}</option>)}</select></label><label>{locale === "ar" ? "الإحداثيات (اختياري)" : "Coordinates (optional)"}<div className="coordinate-inline"><input inputMode="decimal" value={latitude} onChange={(event) => setLatitude(event.target.value)} placeholder={locale === "ar" ? "خط العرض" : "Latitude"}/><input inputMode="decimal" value={longitude} onChange={(event) => setLongitude(event.target.value)} placeholder={locale === "ar" ? "خط الطول" : "Longitude"}/></div></label></div><CoordinateMapPicker latitude={latitude} longitude={longitude} locale={locale} onChange={updateMapLocation}/><div className="buyer-location-map-link">{latitude && longitude ? <a className="button text-button" target="_blank" rel="noreferrer" href={`https://www.google.com/maps?q=${encodeURIComponent(`${latitude},${longitude}`)}`}><Icon name="location" size={17}/>{locale === "ar" ? "فتح الموقع خارجيًا" : "Open externally"}</a> : null}</div><div className="form-actions"><button className="button secondary" type="button" onClick={useCurrentLocation}><Icon name="location"/>{locale === "ar" ? "استخدام موقعي الحالي" : "Use current location"}</button><button className="button primary" disabled={savingLocation}>{savingLocation ? (locale === "ar" ? "جارٍ الحفظ" : "Saving") : (locale === "ar" ? "حفظ الموقع" : "Save location")}</button></div></form></PortalPanel> : null}

    {productDetails ? (() => {
      const product = productDetails;
      const id = text(product.product_id);
      const available = Math.max(0, numberValue(product.quantity));
      const image = text(product.image_signed_url);
      const detailRows = [
        [locale === "ar" ? "القسم" : "Category", text(locale === "ar" ? product.category_ar : product.category_en)],
        [locale === "ar" ? "الماركة" : "Brand", text(product.brand)],
        [locale === "ar" ? "المقاس" : "Size", text(product.size)],
        [locale === "ar" ? "اللون" : "Color", text(product.color)],
        [locale === "ar" ? "الوحدة" : "Unit", unitLabel(product.unit, locale)],
      ].filter((entry) => entry[1]);
      return <div className="portal-modal-backdrop" role="presentation"><section className="portal-modal product-details-modal" role="dialog" aria-modal="true" aria-labelledby="buyer-product-details-title">
        <header><div><span className="eyebrow"><Icon name="box" size={17}/>{locale === "ar" ? "تفاصيل المنتج" : "Product details"}</span><h2 id="buyer-product-details-title">{text(product.name, locale === "ar" ? "منتج" : "Product")}</h2><p>{text(selectedMerchant.store_name)}</p></div><button className="icon-button" data-modal-close type="button" aria-label={locale === "ar" ? "إغلاق التفاصيل" : "Close details"} onClick={() => setProductDetails(null)}><Icon name="close"/></button></header>
        <div className="product-details-layout">{image ? <img className="product-details-image" src={image} alt={text(product.name)}/> : <span className="product-details-placeholder"><Icon name="box" size={34}/></span>}<div className="product-details-copy"><div className="product-details-price"><strong>{money(product.price, currency, locale)}</strong><span>/ {unitLabel(product.unit, locale)}</span></div><div className="detail-list"><div><span>{locale === "ar" ? "الكمية المتاحة" : "Available quantity"}</span><strong>{available} {unitLabel(product.unit, locale)}</strong></div>{detailRows.map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div></div></div>
        <div className="modal-actions"><button className="button secondary" type="button" onClick={() => setProductDetails(null)}>{locale === "ar" ? "إغلاق" : "Close"}</button><button className="button secondary" type="button" onClick={() => void favorite("product", id)}>{favoriteIds.has(id) ? (locale === "ar" ? "إزالة من المفضلة" : "Remove favorite") : (locale === "ar" ? "إضافة للمفضلة" : "Add favorite")}</button><button className="button secondary" type="button" onClick={() => void toggleAlert(id)}><Icon name="bell" size={17}/>{alertProductIds.has(id) ? (locale === "ar" ? "إيقاف تنبيه السعر" : "Stop price alert") : (locale === "ar" ? "تنبيه سعر" : "Price alert")}</button><button className="button secondary" type="button" disabled={available <= 0 || selectedMerchant.can_receive_orders === false} onClick={() => addToCart(product)}><Icon name="receipt" size={17}/>{locale === "ar" ? "إضافة للسلة" : "Add to cart"}</button><button className="button primary" type="button" disabled={selectedMerchant.can_receive_orders === false} onClick={() => { setProductDetails(null); startRequest(product); }}>{locale === "ar" ? "طلب مخصوص" : "Direct request"}</button></div>
      </section></div>;
    })() : null}

    {cartOpen ? <div className="portal-modal-backdrop" role="presentation"><section className="portal-modal buyer-request-modal" role="dialog" aria-modal="true">
      <header><div><span className="eyebrow"><Icon name="receipt" size={17}/>{locale === "ar" ? "سلة المتجر" : "Store cart"}</span><h2>{openCartMerchantName}</h2><p>{locale === "ar" ? "راجع المنتجات والكمية والتوصيل قبل إرسال طلب الشراء للمتجر." : "Review items, quantities, and delivery before sending the purchase order to the store."}</p></div><button className="icon-button" data-modal-close type="button" aria-label={locale === "ar" ? "إغلاق السلة" : "Close cart"} onClick={() => setCartOpen(false)}><Icon name="close"/></button></header>
      {openCartRows.length ? <div className="cart-modal-body"><div className="cart-item-list">{openCartRows.map((item) => <article className="cart-item-row" key={item.productId}>{item.imageUrl ? <img src={item.imageUrl} alt={item.productName}/> : <span className="buyer-product-placeholder"><Icon name="box"/></span>}<div><strong>{item.productName}</strong><small>{money(item.unitPrice, currency, locale)} / {unitLabel(item.unit, locale)}</small></div><input type="number" min="0" step="1" value={item.quantity} onChange={(event) => updateCartQuantity(item.productId, Number(event.target.value))}/><span>{money(item.unitPrice * item.quantity, currency, locale)}</span><button className="icon-button danger" type="button" aria-label={locale === "ar" ? `إزالة ${item.productName} من السلة` : `Remove ${item.productName} from cart`} title={locale === "ar" ? "إزالة من السلة" : "Remove from cart"} onClick={() => updateCartQuantity(item.productId, 0)}><Icon name="trash" size={17}/></button></article>)}</div><div className="detail-list"><div><span>{locale === "ar" ? "إجمالي المنتجات" : "Products subtotal"}</span><strong>{money(openCartSubtotal, currency, locale)}</strong></div>{cartBusy ? <div><span>{locale === "ar" ? "التوصيل" : "Delivery"}</span><strong>{locale === "ar" ? "جارٍ الحساب..." : "Calculating..."}</strong></div> : cartPreview ? <><div><span>{locale === "ar" ? "التوصيل متاح" : "Delivery available"}</span><StatusBadge value={cartPreview.delivery_available === true ? "active" : "suspended"} locale={locale}/></div><div><span>{locale === "ar" ? "تكلفة التوصيل" : "Delivery cost"}</span><strong>{cartPreview.delivery_cost_pending === true ? (locale === "ar" ? "تحدد لاحقًا" : "Pending") : money(cartPreview.delivery_cost, currency, locale)}</strong></div><div><span>{locale === "ar" ? "الإجمالي النهائي" : "Final total"}</span><strong>{money(cartPreview.grand_total || openCartSubtotal, currency, locale)}</strong></div></> : <div><span>{locale === "ar" ? "التوصيل" : "Delivery"}</span><strong>{locale === "ar" ? "تعذرت المعاينة الآن، وسيعيد النظام التحقق عند الإرسال." : "Preview unavailable now; the system will recheck on submit."}</strong></div>}</div><p className="muted-copy">{locale === "ar" ? "قبل الإرسال يعيد النظام التحقق من السعر والكمية المتاحة وتكلفة التوصيل. بعد الإرسال ينتظر الطلب تأكيد المتجر." : "Before sending, Saarly rechecks price, stock, and delivery cost. The order then waits for store confirmation."}</p></div> : <EmptyState icon="receipt" title={locale === "ar" ? "السلة فارغة" : "Your cart is empty"} body={locale === "ar" ? "أضف منتجات من كتالوج المتجر أولًا." : "Add products from a store catalog first."}/>}
      <div className="modal-actions"><button className="button secondary" type="button" onClick={() => setCartOpen(false)}>{locale === "ar" ? "إغلاق" : "Close"}</button>{openCartRows.length ? <button className="button danger-button" type="button" disabled={cartBusy} onClick={() => void clearStoreCart()}>{locale === "ar" ? "تفريغ سلة المتجر" : "Clear store cart"}</button> : null}{openCartRows.length ? <button className="button primary" type="button" disabled={cartBusy} onClick={() => void submitCart()}><Icon name="receipt"/>{cartBusy ? (locale === "ar" ? "جارٍ الإرسال" : "Sending") : (locale === "ar" ? "إرسال طلب الشراء" : "Send purchase order")}</button> : null}</div>
    </section></div> : null}

    {requestOpen ? <div className="portal-modal-backdrop" role="presentation"><section className="portal-modal buyer-request-modal" role="dialog" aria-modal="true">
      <header><div><span className="eyebrow"><Icon name="quote" size={17}/>{locale === "ar" ? "طلب مخصوص" : "Direct request"}</span><h2>{text(selectedMerchant.store_name)}</h2><p>{locale === "ar" ? "اكتب الطلب أو ارفع صورة أو مستندًا أو سجله بصوتك. الطلب هيوصل للمتجر ده فقط." : "Enter the request, upload an image or document, or record it. It is sent only to this store."}</p></div><button className="icon-button" data-modal-close type="button" aria-label={locale === "ar" ? "إغلاق الطلب" : "Close request"} onClick={() => { setRequestOpen(false); resetDirectRequestInput(); }}><Icon name="close"/></button></header>
      <form className="portal-form direct-request-form" onSubmit={submitDirectRequest}>
        <div className="portal-subtabs request-source-tabs">{(["manual", "image", "pdf", "voice"] as DirectRequestMode[]).map((source) => <button type="button" className={requestMode === source ? "active" : ""} key={source} onClick={() => { resetDirectRequestInput(source); setRequestItems(source === "manual" ? [{ name: "", quantity: 1, unit: locale === "ar" ? "قطعة" : "piece" }] : []); }}>{source === "manual" ? (locale === "ar" ? "يدوي" : "Manual") : source === "image" ? (locale === "ar" ? "صورة" : "Image") : source === "pdf" ? (locale === "ar" ? "مستند" : "Document") : (locale === "ar" ? "صوت" : "Voice")}</button>)}</div>
        <div className="direct-request-scope-row"><label>{locale === "ar" ? "نطاق البحث الافتراضي" : "Default search scope"}<select value={requestScope} onChange={(event) => { const next = event.target.value; setRequestScope(next); try { window.localStorage.setItem("saarly_buyer_search_scope_v1", next); } catch { /* optional */ } }}><option value="city">{locale === "ar" ? "مدينتي" : "My city"}</option><option value="governorate">{locale === "ar" ? "محافظتي" : "My governorate"}</option><option value="country">{locale === "ar" ? "كل الدولة" : "Whole country"}</option></select><small>{locale === "ar" ? "نفس اختيار التطبيق، ويُحفظ كاختيار افتراضي لباقي الطلبات." : "Matches the app and is saved as the default for future requests."}</small></label></div>
        {requestMode !== "manual" && !requestAnalysisQuoteId && requestMode !== "voice" ? <label className="file-drop-zone"><Icon name="upload" size={28}/><strong>{locale === "ar" ? "اختار الملف" : "Choose file"}</strong><small>{requestMode === "image" ? (locale === "ar" ? "ملف صورة — حتى 4 ميجابايت" : "Image file — up to 4 megabytes") : (locale === "ar" ? "ملف مستند — حتى 18 ميجابايت" : "Document file — up to 18 megabytes")}</small><input required type="file" accept={requestMode === "image" ? "image/jpeg,image/png,image/webp" : "application/pdf"} capture={requestMode === "image" ? "environment" : undefined} onChange={(event) => setRequestFile(event.target.files?.[0] ?? null)}/>{requestFile ? <span>{requestFile.name}</span> : null}</label> : null}
        {requestMode === "voice" && !requestAnalysisQuoteId ? <section className="voice-recorder-panel"><span className={`voice-recorder-icon ${requestRecording ? "recording" : ""}`}><Icon name="microphone" size={30}/></span><div><strong>{requestRecording ? (locale === "ar" ? "جارٍ التسجيل" : "Recording") : requestFile ? (locale === "ar" ? "التسجيل جاهز" : "Recording ready") : (locale === "ar" ? "سجّل الطلب بصوتك" : "Record your request")}</strong><small>{requestRecording ? `${Math.floor(requestRecordingSeconds / 60)}:${String(requestRecordingSeconds % 60).padStart(2, "0")}` : requestFile ? requestFile.name : (locale === "ar" ? "أو ارفع ملف صوت موجود." : "Or upload an existing audio file.")}</small></div><div className="inline-actions">{!requestRecording ? <button className="button primary compact" type="button" onClick={() => void startDirectVoiceRecording()}><Icon name="microphone"/>{locale === "ar" ? "بدء التسجيل" : "Start recording"}</button> : <button className="button danger-button compact" type="button" onClick={stopDirectVoiceRecording}><Icon name="stop"/>{locale === "ar" ? "إيقاف" : "Stop"}</button>}{requestFile ? <button className="button secondary compact" type="button" onClick={() => { setRequestFile(null); setRequestRecordingSeconds(0); }}>{locale === "ar" ? "مسح" : "Clear"}</button> : null}</div><label className="button secondary compact voice-file-button"><Icon name="upload"/>{locale === "ar" ? "رفع ملف صوت" : "Upload audio"}<input type="file" accept="audio/mpeg,audio/wav,audio/x-m4a,audio/mp4,audio/webm,audio/ogg" onChange={(event) => setRequestFile(event.target.files?.[0] ?? null)}/></label></section> : null}
        {requestAnalysisNote ? <div className="form-notice">{requestAnalysisNote}</div> : null}
        {(requestMode === "manual" || requestAnalysisQuoteId) ? <><div className="request-items-editor">{requestItems.map((item, index) => <div className={`request-item-row ${item.needsReview ? "needs-review" : ""}`} key={index}><label className="grow">{locale === "ar" ? "اسم المنتج" : "Item name"}<input required value={item.name} onChange={(event) => updateRequestItem(index, { name: event.target.value })}/></label><label>{locale === "ar" ? "الكمية" : "Quantity"}<input required type="number" min="0.0001" step="any" value={item.quantity} onChange={(event) => updateRequestItem(index, { quantity: Number(event.target.value) })}/></label><label>{locale === "ar" ? "الوحدة" : "Unit"}<input required value={item.unit} onChange={(event) => updateRequestItem(index, { unit: event.target.value })}/></label>{requestItems.length > 1 ? <button className="icon-button danger" type="button" aria-label={locale === "ar" ? "حذف البند" : "Remove item"} title={locale === "ar" ? "حذف البند" : "Remove item"} onClick={() => setRequestItems((current) => current.filter((_, itemIndex) => itemIndex !== index))}><Icon name="trash"/></button> : null}{item.confidence !== undefined && item.confidence !== null ? <small className="confidence-note">{locale === "ar" ? `ثقة التحليل: ${Math.round(item.confidence * 100)}%` : `Analysis confidence: ${Math.round(item.confidence * 100)}%`}</small> : null}</div>)}</div><button className="button secondary" type="button" onClick={() => setRequestItems((current) => [...current, { name: "", quantity: 1, unit: locale === "ar" ? "قطعة" : "piece" }])}><Icon name="plus"/>{locale === "ar" ? "إضافة منتج" : "Add item"}</button></> : null}
        <div className="modal-actions"><button className="button secondary" type="button" onClick={() => { setRequestOpen(false); resetDirectRequestInput(); }}>{locale === "ar" ? "إلغاء" : "Cancel"}</button><button className="button primary" disabled={sendingRequest}>{sendingRequest ? (locale === "ar" ? "جارٍ التنفيذ" : "Working") : requestAnalysisQuoteId ? (locale === "ar" ? "اعتماد وإرسال" : "Approve & send") : requestMode === "manual" ? (locale === "ar" ? "إرسال الطلب" : "Send request") : (locale === "ar" ? "رفع وتحليل" : "Upload & analyze")}</button></div>
      </form>
    </section></div> : null}
    {confirmDialog}
  </div>;
}
