import { NextRequest, NextResponse } from "next/server";
import { requireBuyer, type BuyerContext } from "@/lib/buyer-auth";
import { PortalError, type Row } from "@/lib/merchant-auth";

export const dynamic = "force-dynamic";

function value(input: unknown) { return String(input ?? "").trim(); }
function uuid(input: unknown) {
  const text = value(input);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text) ? text : "";
}
function numberValue(input: unknown, fallback = 0) { const result = Number(input); return Number.isFinite(result) ? result : fallback; }
function objectValue(input: unknown): Row { return input && typeof input === "object" && !Array.isArray(input) ? input as Row : {}; }
function arrayValue(input: unknown): Row[] { return Array.isArray(input) ? input.filter((item) => item && typeof item === "object") as Row[] : []; }

function errorResponse(error: unknown) {
  if (error instanceof PortalError) return NextResponse.json({ error: error.code }, { status: error.status });
  console.error("buyer portal error", error);
  return NextResponse.json({ error: error instanceof Error ? error.message : "buyer_portal_request_failed" }, { status: 500 });
}

function normalizeStoragePath(bucket: string, raw: unknown) {
  let result = value(raw).split("?")[0].replace(/^\/+/, "");
  const marker = "/storage/v1/object/";
  const markerIndex = result.indexOf(marker);
  if (markerIndex >= 0) result = result.slice(markerIndex + marker.length).replace(/^(public|sign|authenticated)\//, "");
  if (result.startsWith(`${bucket}/`)) result = result.slice(bucket.length + 1);
  return result.replace(/^\/+/, "");
}

async function signedStorageUrl(context: BuyerContext, bucket: string, raw: unknown, expiresIn = 3600) {
  const original = value(raw);
  if (!original) return "";
  if (/^https?:\/\//i.test(original)) return original;
  const path = normalizeStoragePath(bucket, original);
  if (!path) return "";
  const result = await context.service.storage.from(bucket).createSignedUrl(path, expiresIn);
  return result.error ? "" : result.data.signedUrl;
}

async function signMerchants(context: BuyerContext, items: Row[]) {
  const visibleItems = items.filter((item) => value(item.merchant_id) !== context.ownMerchantId);
  return Promise.all(visibleItems.map(async (item) => ({
    ...item,
    storefront_signed_url: await signedStorageUrl(context, "storefront-photos", item.store_front_image_url, 6 * 60 * 60),
  })));
}

async function signProducts(context: BuyerContext, items: Row[]) {
  return Promise.all(items.map(async (item) => {
    const imageValues = [item.image_url, ...(Array.isArray(item.image_urls) ? item.image_urls : [])].map(value).filter(Boolean).slice(0, 6);
    const signed = (await Promise.all(imageValues.map((image) => signedStorageUrl(context, "product-images", image, 6 * 60 * 60)))).filter(Boolean);
    return { ...item, image_signed_url: signed[0] ?? "", image_signed_urls: signed };
  }));
}

function locationMatchesAd(ad: Row, location: Row) {
  const normalize = (input: unknown) => value(input).toLowerCase().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/\s+/g, " ");
  const pairs: Array<[unknown, unknown]> = [
    [ad.target_country_ar, location.country_ar || location.country],
    [ad.target_governorate_ar, location.governorate_ar || location.governorate],
    [ad.target_city_ar, location.city_ar || location.city],
  ];
  return pairs.every(([target, actual]) => !normalize(target) || normalize(target) === normalize(actual));
}

async function loadAds(context: BuyerContext, placement: string, location: Row) {
  const { data, error } = await context.service
    .from("ads_banners")
    .select("id,image_url,target_url,placement,sort_order,target_country_ar,target_governorate_ar,target_city_ar,starts_at,ends_at,is_active,is_ongoing")
    .eq("placement", placement)
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(30);
  if (error) return [];
  const now = Date.now();
  return ((data ?? []) as Row[]).filter((ad) => {
    const starts = value(ad.starts_at) ? Date.parse(value(ad.starts_at)) : null;
    const ends = value(ad.ends_at) ? Date.parse(value(ad.ends_at)) : null;
    return (!starts || starts <= now) && (!ends || ends > now) && locationMatchesAd(ad, location);
  }).slice(0, 10);
}

async function loadQuotes(context: BuyerContext, limit = 60) {
  const [quotes, contacts] = await Promise.all([
    context.service.from("quote_requests")
      .select("id,source,ai_review_status,search_scope,delivery_type,target_merchant_id,target_branch_id,response_deadline_at,target_merchant_responded_at,approved_at,created_at,updated_at,quote_items(id,requested_name,quantity,unit,specifications,ai_confidence,display_order)")
      .eq("buyer_id", context.user.id).order("created_at", { ascending: false }).limit(limit),
    context.userDb.rpc("my_buyer_direct_request_contacts"),
  ]);
  if (quotes.error) throw new PortalError(quotes.error.message, 400);
  const contactMap = new Map<string, Row>();
  if (!contacts.error && Array.isArray(contacts.data)) {
    for (const item of contacts.data as Row[]) contactMap.set(value(item.quote_request_id), item);
  }
  return ((quotes.data ?? []) as Row[]).map((item) => ({ ...item, direct_contact: contactMap.get(value(item.id)) ?? null }));
}

async function loadMerchantBadges(context: BuyerContext, merchantIds: string[]) {
  const ids = [...new Set(merchantIds.map(uuid).filter(Boolean))];
  const map = new Map<string, Row>();
  if (!ids.length) return map;
  const result = await context.userDb.rpc("buyer_merchant_badges", { p_merchant_ids: ids });
  if (result.error) return map;
  for (const item of (result.data ?? []) as Row[]) map.set(value(item.merchant_id), item);
  return map;
}

async function loadOffers(context: BuyerContext, limit = 120): Promise<Row[]> {
  const offers = await context.userDb.from("buyer_offer_results").select("*")
    .order("generated_at", { ascending: false }).order("ranking", { ascending: true }).limit(limit);
  if (offers.error) throw new PortalError(offers.error.message, 400);
  const offerRows = (offers.data ?? []) as Row[];
  if (!offerRows.length) return [];
  const ids = offerRows.map((item) => value(item.id)).filter(Boolean);
  const items = await context.userDb.from("buyer_offer_item_results").select("*").in("offer_id", ids)
    .order("is_available", { ascending: false }).order("line_total_snapshot", { ascending: true });
  if (items.error) throw new PortalError(items.error.message, 400);
  const itemMap = new Map<string, Row[]>();
  for (const item of (items.data ?? []) as Row[]) {
    const key = value(item.offer_id); itemMap.set(key, [...(itemMap.get(key) ?? []), item]);
  }
  const badgeMap = await loadMerchantBadges(context, offerRows.map((offer) => value(offer.merchant_id)));
  return offerRows.map((offer): Row => ({
    ...offer,
    ...objectValue(badgeMap.get(value(offer.merchant_id))),
    items: itemMap.get(value(offer.id)) ?? [],
  }));
}

async function loadRfqResponses(context: BuyerContext) {
  const result = await context.userDb.from("buyer_rfq_response_results").select("*").order("submitted_at", { ascending: false }).limit(200);
  if (result.error) throw new PortalError(result.error.message, 400);
  return result.data ?? [];
}

async function loadOrders(context: BuyerContext, limit = 100) {
  const orders = await context.service.from("orders")
    .select("id,offer_id,merchant_id,status,accepted_at,confirmation_deadline,confirmed_at,merchant_cancel_reason,merchant_cancel_details,confirmation_progress,payment_status,created_at,updated_at")
    .eq("buyer_id", context.user.id).order("accepted_at", { ascending: false }).limit(limit);
  if (orders.error) throw new PortalError(orders.error.message, 400);
  const orderRows = (orders.data ?? []) as Row[];
  const ids = orderRows.map((item) => value(item.id)).filter(Boolean);
  if (!ids.length) return [];
  const [fulfillments, details, reviews] = await Promise.all([
    context.service.from("order_merchant_fulfillments")
      .select("id,order_id,merchant_id,branch_id,status,subtotal_snapshot,confirmation_deadline,confirmed_at,merchant_cancel_reason,merchant_cancel_details,delivery_available_snapshot,delivery_pricing_method_snapshot,delivery_pricing_table_snapshot,buyer_decision,order_fulfillment_items(id,requested_name_snapshot,matched_name_snapshot,quantity_snapshot,unit_snapshot,unit_price_snapshot,line_total_snapshot,created_at)")
      .in("order_id", ids).order("confirmation_deadline", { ascending: true }),
    context.userDb.from("buyer_accepted_merchant_details").select("*").in("order_id", ids).order("store_name"),
    context.service.from("reviews").select("id,order_id,merchant_id,stars,comment,created_at").eq("buyer_id", context.user.id).in("order_id", ids),
  ]);
  const error = fulfillments.error || details.error || reviews.error;
  if (error) throw new PortalError(error.message, 400);
  const fulfillmentMap = new Map<string, Row[]>();
  for (const item of (fulfillments.data ?? []) as Row[]) fulfillmentMap.set(value(item.order_id), [...(fulfillmentMap.get(value(item.order_id)) ?? []), item]);
  const detailRows = (details.data ?? []) as Row[];
  const badgeMap = await loadMerchantBadges(context, detailRows.map((item) => value(item.merchant_id)));
  const detailsMap = new Map<string, Row[]>();
  for (const item of detailRows) {
    const merged = { ...item, ...objectValue(badgeMap.get(value(item.merchant_id))) };
    detailsMap.set(value(item.order_id), [...(detailsMap.get(value(item.order_id)) ?? []), merged]);
  }
  const reviewMap = new Map<string, Row[]>();
  for (const item of (reviews.data ?? []) as Row[]) reviewMap.set(value(item.order_id), [...(reviewMap.get(value(item.order_id)) ?? []), item]);
  return orderRows.map((order) => ({ ...order, fulfillments: fulfillmentMap.get(value(order.id)) ?? [], merchant_details: detailsMap.get(value(order.id)) ?? [], reviews: reviewMap.get(value(order.id)) ?? [] }));
}

async function loadStorefront(context: BuyerContext) {
  const [categories, merchants, favorites, alerts, location, options] = await Promise.all([
    context.userDb.rpc("buyer_storefront_categories"),
    context.userDb.rpc("buyer_storefront_merchants", { p_category_id: null, p_query: null }),
    context.userDb.rpc("my_buyer_favorites"),
    context.userDb.rpc("my_buyer_price_alerts"),
    context.userDb.rpc("my_buyer_location"),
    context.userDb.rpc("app_location_options"),
  ]);
  const error = categories.error || merchants.error || favorites.error || alerts.error || location.error || options.error;
  if (error) throw new PortalError(error.message || "buyer_storefront_load_failed", 400);
  const favoriteRows = await Promise.all(((favorites.data ?? []) as Row[]).map(async (item) => ({
    ...item,
    image_signed_url: await signedStorageUrl(context, value(item.favorite_type) === "merchant" ? "storefront-photos" : "product-images", item.image_url, 6 * 60 * 60),
  })));
  return {
    categories: categories.data ?? [],
    merchants: await signMerchants(context, (merchants.data ?? []) as Row[]),
    favorites: favoriteRows,
    priceAlerts: alerts.data ?? [],
    location: location.data ?? {},
    locationOptions: options.data ?? [],
  };
}

async function supportConversationBundle(context: BuyerContext, requestedId?: string) {
  let conversationId = uuid(requestedId);
  if (conversationId) {
    const ownership = await context.service.from("chat_conversations").select("id").eq("id", conversationId).eq("user_id", context.user.id).maybeSingle();
    if (ownership.error) throw new PortalError(ownership.error.message, 400);
    if (!ownership.data?.id) throw new PortalError("support_conversation_not_found", 404);
  } else {
    const start = await context.userDb.rpc("start_or_get_support_conversation", {
      p_title: context.profile.preferred_language === "en" ? "Buyer web support" : "دعم المشتري من الموقع",
      p_locale: context.profile.preferred_language === "en" ? "en" : "ar",
    });
    if (start.error) throw new PortalError(start.error.message, 400);
    conversationId = value(start.data);
  }

  const [conversation, messages, conversations] = await Promise.all([
    context.service.from("chat_conversations")
      .select("id,status,title,transferred_at,last_message_at,last_user_message_at,last_support_message_at,user_last_read_at,created_at,updated_at,closed_at,closed_reason,locale")
      .eq("id", conversationId).eq("user_id", context.user.id).maybeSingle(),
    context.service.from("chat_messages")
      .select("id,conversation_id,sender_type,sender_user_id,body,metadata,created_at")
      .eq("conversation_id", conversationId).order("created_at").limit(400),
    context.service.from("chat_conversations")
      .select("id,status,title,transferred_at,last_message_at,last_user_message_at,last_support_message_at,user_last_read_at,created_at,updated_at,closed_at,closed_reason,locale,support_conversation_ratings(stars,sentiment,comment,created_at,updated_at)")
      .eq("user_id", context.user.id).order("updated_at", { ascending: false }).limit(100),
  ]);
  const error = conversation.error || messages.error || conversations.error;
  if (error) throw new PortalError(error.message, 400);
  const mark = await context.userDb.rpc("mark_support_conversation_read", { p_conversation_id: conversationId });
  if (mark.error) throw new PortalError(mark.error.message, 400);
  const current = (conversation.data ?? {}) as Row;
  const currentWithRating = ((conversations.data ?? []) as Row[]).find((item) => value(item.id) === conversationId) ?? current;
  return { conversation: currentWithRating, messages: messages.data ?? [], conversations: conversations.data ?? [] };
}

async function loadSupport(context: BuyerContext) {
  return supportConversationBundle(context);
}

const merchantOnlyNotificationTypes = new Set([
  "merchant_approved", "merchant_rejected", "branch_approved", "branch_rejected",
  "weekly_price_update", "shipping_price_reminder", "rfq_request_new",
  "buyer_accepted_offer", "rfq_accepted",
]);

function visibleBuyerNotification(item: Row) {
  const type = value(item.type);
  const link = value(item.deep_link);
  if (merchantOnlyNotificationTypes.has(type)) return false;
  if (/^(saarly:\/\/merchant\/|\/merchant\/)/i.test(link)) return false;
  return true;
}

async function buyerNotifications(context: BuyerContext, limit = 300) {
  const result = await context.service.from("notifications")
    .select("id,type,title_ar,title_en,body_ar,body_en,deep_link,is_read,read_at,created_at,payload")
    .eq("user_id", context.user.id).order("created_at", { ascending: false }).limit(Math.max(limit * 2, 60));
  if (result.error) throw new PortalError(result.error.message, 400);
  return ((result.data ?? []) as Row[]).filter(visibleBuyerNotification).slice(0, limit);
}

async function loadNotifications(context: BuyerContext) {
  return { notifications: await buyerNotifications(context, 300) };
}

async function loadHome(context: BuyerContext) {
  const locationResult = await context.userDb.rpc("my_buyer_location");
  const location = objectValue(locationResult.data);
  const [quotes, offers, orders, favorites, referral, ads, notifications] = await Promise.all([
    loadQuotes(context, 8), loadOffers(context, 12), loadOrders(context, 8), context.userDb.rpc("my_buyer_favorites"),
    context.userDb.rpc("my_referral_dashboard_for", { p_audience: "buyer" }), loadAds(context, "buyer_home_top", location),
    buyerNotifications(context, 6),
  ]);
  const [quoteCount, offerCount, orderCount, favoriteCount] = await Promise.all([
    context.service.from("quote_requests").select("id", { count: "exact", head: true }).eq("buyer_id", context.user.id),
    context.userDb.from("buyer_offer_results").select("id", { count: "exact", head: true }).eq("status", "active"),
    context.service.from("orders").select("id", { count: "exact", head: true }).eq("buyer_id", context.user.id),
    context.service.from("favorites").select("id", { count: "exact", head: true }).eq("buyer_id", context.user.id),
  ]);
  return {
    location,
    ads,
    quotes,
    offers,
    orders,
    favorites: favorites.error ? [] : favorites.data ?? [],
    referral: referral.error ? {} : referral.data ?? {},
    recentNotifications: Array.isArray(notifications) ? notifications : [],
    counts: {
      quotes: quoteCount.count ?? quotes.length,
      offers: offerCount.count ?? offers.filter((item) => value(item.status) === "active").length,
      orders: orderCount.count ?? orders.length,
      favorites: favoriteCount.count ?? (Array.isArray(favorites.data) ? favorites.data.length : 0),
    },
  };
}

async function loadSection(context: BuyerContext, section: string) {
  const buyerNotificationRows = await buyerNotifications(context, 500);
  const unreadCount = buyerNotificationRows.filter((item) => item.is_read !== true).length;
  const common = {
    account: {
      userId: context.user.id,
      email: context.user.email ?? context.profile.primary_email ?? "",
      profile: context.profile,
      merchant: context.ownMerchant ?? {},
      merchantId: context.ownMerchantId,
      isOwner: context.isMerchantOwner,
      staff: context.staff,
      branchIds: [],
      currencyCode: context.currencyCode,
      unreadNotifications: unreadCount,
    },
    section,
  };
  if (section === "home") return { ...common, data: await loadHome(context) };
  if (section === "requests") {
    const [locationResult, optionsResult] = await Promise.all([context.userDb.rpc("my_buyer_location"), context.userDb.rpc("app_location_options")]);
    if (locationResult.error || optionsResult.error) throw new PortalError((locationResult.error || optionsResult.error)?.message || "buyer_location_load_failed", 400);
    return { ...common, data: { quotes: await loadQuotes(context), offers: await loadOffers(context), rfqResponses: await loadRfqResponses(context), location: locationResult.data ?? {}, locationOptions: optionsResult.data ?? [] } };
  }
  if (section === "orders") return { ...common, data: { orders: await loadOrders(context), currencyCode: context.currencyCode } };
  if (section === "stores") return { ...common, data: await loadStorefront(context) };
  if (section === "favorites") { const data = await loadStorefront(context); return { ...common, data: { favorites: data.favorites, priceAlerts: data.priceAlerts } }; }
  if (section === "alerts") return { ...common, data: { priceAlerts: (await context.userDb.rpc("my_buyer_price_alerts")).data ?? [] } };
  if (section === "notifications") return { ...common, data: await loadNotifications(context) };
  if (section === "referrals") {
    const location = objectValue((await context.userDb.rpc("my_buyer_location")).data);
    return { ...common, data: { dashboard: (await context.userDb.rpc("my_referral_dashboard_for", { p_audience: "buyer" })).data ?? {}, ads: await loadAds(context, "buyer_referrals_top", location) } };
  }
  if (section === "support") return { ...common, data: await loadSupport(context) };
  if (section === "settings") return { ...common, data: { location: (await context.userDb.rpc("my_buyer_location")).data ?? {}, locationOptions: (await context.userDb.rpc("app_location_options")).data ?? [] } };
  throw new PortalError("buyer_section_not_found", 404);
}

async function visibleMerchant(context: BuyerContext, merchantId: string) {
  if (!merchantId || merchantId === context.ownMerchantId) throw new PortalError("target_merchant_own_store", 400);
  const result = await context.userDb.rpc("buyer_storefront_merchants", { p_category_id: null, p_query: null });
  if (result.error) throw new PortalError(result.error.message, 400);
  const match = ((result.data ?? []) as Row[]).find((item) => value(item.merchant_id) === merchantId);
  if (!match) throw new PortalError("buyer_store_not_available", 404);
  return match;
}

async function createManualQuote(context: BuyerContext, body: Row) {
  const submittedItems = arrayValue(body.items);
  if (submittedItems.length > 50) throw new PortalError("quote_items_limit_exceeded", 400);
  const rawItems = submittedItems.slice(0, 50);
  const items = rawItems.map((item, index) => ({
    requested_name: value(item.name || item.requested_name).slice(0, 240),
    quantity: Math.max(0.0001, numberValue(item.quantity, 1)),
    unit: value(item.unit).slice(0, 80) || "قطعة",
    specifications: objectValue(item.specifications),
    ai_confidence: item.ai_confidence === null || item.ai_confidence === undefined ? null : Math.max(0, Math.min(1, numberValue(item.ai_confidence))),
    display_order: index + 1,
  })).filter((item) => item.requested_name);
  if (!items.length) throw new PortalError("quote_items_required");
  const targetMerchantId = uuid(body.merchantId || body.targetMerchantId);
  const targetBranchId = uuid(body.branchId || body.targetBranchId);
  if (targetMerchantId) {
    await visibleMerchant(context, targetMerchantId);
    const direct = await context.userDb.rpc("create_my_direct_quote_request_web", {
      p_target_merchant_id: targetMerchantId,
      p_target_branch_id: targetBranchId || null,
      p_items: items.map((item) => ({
        name: item.requested_name, quantity: item.quantity, unit: item.unit,
        specifications: item.specifications,
      })),
      p_location: objectValue(body.searchScope).location || objectValue(body.location),
    });
    if (direct.error) throw new PortalError(direct.error.message, 400);
    return direct.data;
  }
  const quote = await context.service.from("quote_requests").insert({
    buyer_id: context.user.id,
    source: "manual",
    ai_review_status: "approved",
    approved_at: new Date().toISOString(),
    search_scope: objectValue(body.searchScope),
    delivery_type: "broadcast",
    target_merchant_id: null,
    target_branch_id: null,
    response_deadline_at: null,
  }).select("id").single();
  if (quote.error) throw new PortalError(quote.error.message, 400);
  const quoteId = value(quote.data.id);
  const inserted = await context.service.from("quote_items").insert(items.map((item) => ({ quote_request_id: quoteId, ...item })));
  if (inserted.error) {
    await context.service.from("quote_requests").delete().eq("id", quoteId).eq("buyer_id", context.user.id);
    throw new PortalError(inserted.error.message, 400);
  }
  const generated = await context.userDb.rpc("generate_offers_for_quote", { p_quote_request_id: quoteId });
  if (generated.error) throw new PortalError(generated.error.message, 400);
  return { quoteRequestId: quoteId, generatedOffers: generated.data ?? 0, direct: false };
}

async function approveAnalyzedQuote(context: BuyerContext, body: Row) {
  const quoteId = uuid(body.quoteRequestId);
  const quote = await context.service.from("quote_requests").select("id,buyer_id,delivery_type,target_merchant_id,target_branch_id").eq("id", quoteId).eq("buyer_id", context.user.id).maybeSingle();
  if (quote.error || !quote.data) throw new PortalError("quote_not_found_for_current_buyer", 404);
  const requestedTargetMerchantId = uuid(body.merchantId || body.targetMerchantId);
  const requestedTargetBranchId = uuid(body.branchId || body.targetBranchId);
  if (requestedTargetMerchantId) await visibleMerchant(context, requestedTargetMerchantId);
  const submittedItems = arrayValue(body.items);
  if (submittedItems.length > 50) throw new PortalError("quote_items_limit_exceeded", 400);
  const items = submittedItems.slice(0, 50).map((item, index) => ({
    quote_request_id: quoteId,
    requested_name: value(item.name || item.product_name || item.requested_name).slice(0, 240),
    quantity: Math.max(0.0001, numberValue(item.quantity, 1)),
    unit: value(item.unit).slice(0, 80) || "قطعة",
    specifications: objectValue(item.specifications),
    ai_confidence: item.confidence === null || item.confidence === undefined ? null : Math.max(0, Math.min(1, numberValue(item.confidence))),
    display_order: index + 1,
  })).filter((item) => item.requested_name);
  if (!items.length) throw new PortalError("quote_items_required");
  const existingItems = await context.service.from("quote_items")
    .select("requested_name,quantity,unit,specifications,ai_confidence,display_order")
    .eq("quote_request_id", quoteId).order("display_order");
  if (existingItems.error) throw new PortalError(existingItems.error.message, 400);
  const deleted = await context.service.from("quote_items").delete().eq("quote_request_id", quoteId);
  if (deleted.error) throw new PortalError(deleted.error.message, 400);
  const inserted = await context.service.from("quote_items").insert(items);
  if (inserted.error) {
    if ((existingItems.data ?? []).length) {
      await context.service.from("quote_items").insert((existingItems.data ?? []).map((item: Row) => ({ quote_request_id: quoteId, ...item })));
    }
    throw new PortalError(inserted.error.message, 400);
  }
  const updated = await context.service.from("quote_requests").update({
    ai_review_status: "approved",
    approved_at: new Date().toISOString(),
    search_scope: objectValue(body.searchScope),
    delivery_type: requestedTargetMerchantId ? "direct" : quote.data.delivery_type,
    target_merchant_id: requestedTargetMerchantId || quote.data.target_merchant_id,
    target_branch_id: requestedTargetMerchantId ? (requestedTargetBranchId || null) : quote.data.target_branch_id,
    updated_at: new Date().toISOString(),
  }).eq("id", quoteId).eq("buyer_id", context.user.id);
  if (updated.error) {
    await context.service.from("quote_items").delete().eq("quote_request_id", quoteId);
    if ((existingItems.data ?? []).length) {
      await context.service.from("quote_items").insert((existingItems.data ?? []).map((item: Row) => ({ quote_request_id: quoteId, ...item })));
    }
    throw new PortalError(updated.error.message, 400);
  }
  if (requestedTargetMerchantId || quote.data.delivery_type === "direct") {
    const rfq = await context.userDb.rpc("create_rfq_for_uncovered_items", { p_quote_request_id: quoteId });
    if (rfq.error) throw new PortalError(rfq.error.message, 400);
    return { quoteRequestId: quoteId, rfqRequestId: rfq.data };
  }
  const generated = await context.userDb.rpc("generate_offers_for_quote", { p_quote_request_id: quoteId });
  if (generated.error) throw new PortalError(generated.error.message, 400);
  return { quoteRequestId: quoteId, generatedOffers: generated.data ?? 0 };
}

export async function GET(request: NextRequest) {
  try {
    const context = await requireBuyer(request);
    const section = value(request.nextUrl.searchParams.get("section")) || "home";
    return NextResponse.json(await loadSection(context, section));
  } catch (error) { return errorResponse(error); }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireBuyer(request);
    const body = objectValue(await request.json());
    const action = value(body.action);

    if (action === "search_stores") {
      const result = await context.userDb.rpc("buyer_storefront_merchants", { p_category_id: uuid(body.categoryId) || null, p_query: value(body.query).slice(0, 160) || null });
      if (result.error) throw new PortalError(result.error.message, 400);
      return NextResponse.json({ data: await signMerchants(context, (result.data ?? []) as Row[]) });
    }
    if (action === "load_store_products") {
      const merchantId = uuid(body.merchantId); await visibleMerchant(context, merchantId);
      const result = await context.userDb.rpc("buyer_storefront_products", { p_merchant_id: merchantId, p_category_id: uuid(body.categoryId) || null, p_query: value(body.query).slice(0, 160) || null });
      if (result.error) throw new PortalError(result.error.message, 400);
      return NextResponse.json({ data: await signProducts(context, (result.data ?? []) as Row[]) });
    }
    if (action === "load_product_target") {
      const productId = uuid(body.productId);
      const product = await context.service.from("products").select("id,merchant_id,is_active,is_available").eq("id", productId).maybeSingle();
      if (!product.data || product.data.is_active !== true || product.data.is_available !== true) throw new PortalError("buyer_product_not_available", 404);
      const merchant = await visibleMerchant(context, value(product.data.merchant_id));
      const result = await context.userDb.rpc("buyer_storefront_products", { p_merchant_id: value(product.data.merchant_id), p_category_id: null, p_query: null });
      if (result.error) throw new PortalError(result.error.message, 400);
      return NextResponse.json({ data: { merchant: (await signMerchants(context, [merchant]))[0] ?? merchant, products: await signProducts(context, (result.data ?? []) as Row[]), productId } });
    }
    if (action === "create_manual_quote") return NextResponse.json({ data: await createManualQuote(context, body) });
    if (action === "approve_analyzed_quote") return NextResponse.json({ data: await approveAnalyzedQuote(context, body) });
    if (action === "analyze_upload") {
      const source = value(body.source);
      if (!["image", "pdf", "voice"].includes(source)) throw new PortalError("unsupported_file_type");
      const file = objectValue(body.file);
      const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/analyze-customer-request`;
      const response = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${context.accessToken}`, apikey: String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""), "Content-Type": "application/json" },
        body: JSON.stringify({ purpose: "buyer_quote", source, file, locale: body.locale === "en" ? "en" : "ar", client_metadata: { search_scope: body.searchScope, location: body.location, created_from: "buyer_web" } }),
      });
      const payload = await response.json();
      if (!response.ok) throw new PortalError(value(payload?.error?.code || payload?.error || "analysis_failed"), response.status);
      return NextResponse.json({ data: payload });
    }
    if (action === "generate_offers") {
      const result = await context.userDb.rpc("generate_offers_for_quote", { p_quote_request_id: uuid(body.quoteRequestId) });
      if (result.error) throw new PortalError(result.error.message, 400);
      return NextResponse.json({ data: { count: result.data ?? 0 } });
    }
    if (action === "accept_offer") {
      const offerId = uuid(body.offerId);
      if (!offerId) throw new PortalError("offer_not_found", 404);
      const rawQuantities = Array.isArray(body.itemQuantities) ? body.itemQuantities : Array.isArray(body.item_quantities) ? body.item_quantities : [];
      const quantities = rawQuantities
        .map((raw) => objectValue(raw))
        .map((item) => ({
          offer_item_id: uuid(item.offer_item_id || item.offerItemId || item.id),
          quantity: numberValue(item.quantity, 1),
        }))
        .filter((item) => item.offer_item_id && item.quantity > 0);
      const result = await context.userDb.rpc("accept_offer_with_quantities", { p_offer_id: offerId, p_item_quantities: quantities });
      if (result.error) throw new PortalError(result.error.message, 400);
      return NextResponse.json({ data: { orderId: result.data } });
    }
    if (action === "preview_offer_acceptance") {
      const result = await context.userDb.rpc("preview_offer_acceptance", { p_offer_id: uuid(body.offerId) });
      if (result.error) throw new PortalError(result.error.message, 400);
      return NextResponse.json({ data: result.data ?? {} });
    }
    if (action === "preview_catalog_cart") {
      const merchantId = uuid(body.merchantId);
      await visibleMerchant(context, merchantId);
      const items = Array.isArray(body.items) ? body.items.map((raw) => {
        const item = objectValue(raw);
        return { product_id: uuid(item.productId || item.product_id), quantity: Math.max(0, numberValue(item.quantity)) };
      }).filter((item) => item.product_id && item.quantity > 0).slice(0, 100) : [];
      if (!items.length) throw new PortalError("catalog_cart_empty", 400);
      const result = await context.userDb.rpc("preview_catalog_cart_order", { p_merchant_id: merchantId, p_items: items });
      if (result.error) throw new PortalError(result.error.message, 400);
      return NextResponse.json({ data: result.data ?? {} });
    }
    if (action === "create_catalog_cart_order") {
      const merchantId = uuid(body.merchantId);
      await visibleMerchant(context, merchantId);
      const items = Array.isArray(body.items) ? body.items.map((raw) => {
        const item = objectValue(raw);
        return { product_id: uuid(item.productId || item.product_id), quantity: Math.max(0, numberValue(item.quantity)) };
      }).filter((item) => item.product_id && item.quantity > 0).slice(0, 100) : [];
      if (!items.length) throw new PortalError("catalog_cart_empty", 400);
      const result = await context.userDb.rpc("create_catalog_cart_order", { p_merchant_id: merchantId, p_items: items });
      if (result.error) throw new PortalError(result.error.message, 400);
      return NextResponse.json({ data: result.data ?? {} });
    }
    if (action === "create_rfq") {
      const result = await context.userDb.rpc("create_rfq_for_uncovered_items", { p_quote_request_id: uuid(body.quoteRequestId), p_quote_item_ids: Array.isArray(body.quoteItemIds) ? body.quoteItemIds.map(uuid).filter(Boolean) : null });
      if (result.error) throw new PortalError(result.error.message, 400);
      return NextResponse.json({ data: { rfqRequestId: result.data } });
    }
    if (action === "create_direct_rfq_from_offer") {
      const offerId = uuid(body.offerId);
      const quoteItemIds = Array.isArray(body.quoteItemIds) ? body.quoteItemIds.map(uuid).filter(Boolean) : [];
      if (!offerId || !quoteItemIds.length) throw new PortalError("manual_rfq_items_required", 400);
      const result = await context.userDb.rpc("create_direct_rfq_from_offer", {
        p_offer_id: offerId,
        p_quote_item_ids: quoteItemIds,
        p_expires_at: null,
      });
      if (result.error) throw new PortalError(result.error.message, 400);
      return NextResponse.json({ data: { rfqRequestId: result.data } });
    }
    if (action === "reject_rfq_response") {
      const rfqResponseId = uuid(body.rfqResponseId);
      if (!rfqResponseId) throw new PortalError("rfq_response_not_found", 404);
      const result = await context.userDb.rpc("reject_rfq_response", { p_rfq_response_id: rfqResponseId });
      if (result.error) throw new PortalError(result.error.message, 400);
      return NextResponse.json({ data: result.data });
    }
    if (action === "rfq_shipping_options") {
      const rfqResponseId = uuid(body.rfqResponseId);
      if (!rfqResponseId) throw new PortalError("rfq_response_not_found", 404);
      const result = await context.userDb.rpc("get_rfq_response_delivery_quote", {
        p_rfq_response_id: rfqResponseId,
        p_total_weight_kg: body.totalWeightKg === null || body.totalWeightKg === undefined ? null : numberValue(body.totalWeightKg),
      });
      if (result.error) throw new PortalError(result.error.message, 400);
      return NextResponse.json({ data: result.data ?? { companies: [] } });
    }
    if (action === "accept_rfq_response") {
      const result = await context.userDb.rpc("accept_rfq_response", {
        p_rfq_response_id: uuid(body.rfqResponseId), p_shipping_company_id: uuid(body.shippingCompanyId) || null,
        p_shipping_company_name: value(body.shippingCompanyName) || null, p_total_weight_kg: body.totalWeightKg === null || body.totalWeightKg === undefined ? null : numberValue(body.totalWeightKg),
        p_shipping_cost: body.shippingCost === null || body.shippingCost === undefined ? null : numberValue(body.shippingCost),
      });
      if (result.error) throw new PortalError(result.error.message, 400);
      return NextResponse.json({ data: { orderId: result.data } });
    }
    if (action === "delete_quote") {
      const result = await context.userDb.rpc("delete_buyer_quote_request", { p_quote_request_id: uuid(body.quoteRequestId) });
      if (result.error) throw new PortalError(result.error.message, 400);
      return NextResponse.json({ data: result.data });
    }
    if (action === "cancel_order") {
      const result = await context.userDb.rpc("cancel_my_order", { p_order_id: uuid(body.orderId) });
      if (result.error) throw new PortalError(result.error.message, 400);
      return NextResponse.json({ data: result.data });
    }
    if (action === "delete_order") {
      const result = await context.userDb.rpc("delete_my_order_history", { p_order_id: uuid(body.orderId) });
      if (result.error) throw new PortalError(result.error.message, 400);
      return NextResponse.json({ data: result.data });
    }
    if (action === "order_payment_dashboard") {
      // Intentionally unavailable in the Buyer web portal to match the current mobile app.
      // Buyer payment UI is dormant in Flutter and must not be revived by a hidden web action.
      throw new PortalError("buyer_payment_not_available", 404);
    }
    if (action === "open_order_chat") {
      const orderId = uuid(body.orderId); const merchantId = uuid(body.merchantId);
      const result = await context.userDb.rpc("ensure_buyer_merchant_conversation", { p_order_id: orderId, p_merchant_id: merchantId });
      if (result.error) throw new PortalError(result.error.message, 400);
      const conversationId = value(result.data);
      const messages = await context.service.from("buyer_merchant_messages").select("id,conversation_id,sender_user_id,body,created_at,read_by_recipient_at,read_at").eq("conversation_id", conversationId).order("created_at").limit(400);
      if (messages.error) throw new PortalError(messages.error.message, 400);
      await context.userDb.rpc("mark_buyer_merchant_conversation_read", { p_conversation_id: conversationId });
      return NextResponse.json({ data: { conversationId, messages: messages.data ?? [] } });
    }
    if (action === "send_order_chat_message") {
      const message = value(body.message).slice(0, 4000); if (!message) throw new PortalError("message_required");
      const result = await context.userDb.rpc("send_buyer_merchant_message", { p_conversation_id: uuid(body.conversationId), p_body: message });
      if (result.error) throw new PortalError(result.error.message, 400);
      return NextResponse.json({ data: result.data });
    }
    if (action === "submit_review") {
      const orderId = uuid(body.orderId); const merchantId = uuid(body.merchantId); const stars = Math.min(5, Math.max(1, Math.trunc(numberValue(body.stars, 5))));
      const order = await context.service.from("order_merchant_fulfillments").select("order_id,merchant_id,status").eq("order_id", orderId).eq("merchant_id", merchantId).maybeSingle();
      const ownedOrder = await context.service.from("orders").select("id").eq("id", orderId).eq("buyer_id", context.user.id).maybeSingle();
      if (!ownedOrder.data || !order.data) throw new PortalError("order_not_found", 404);
      const existingReview = await context.service.from("reviews").select("id").eq("order_id", orderId).eq("buyer_id", context.user.id).eq("merchant_id", merchantId).maybeSingle();
      const reviewPayload = { stars, comment: value(body.comment).slice(0, 1000) || null, updated_at: new Date().toISOString() };
      const result = existingReview.data?.id
        ? await context.service.from("reviews").update(reviewPayload).eq("id", existingReview.data.id).eq("buyer_id", context.user.id)
        : await context.service.from("reviews").insert({ order_id: orderId, buyer_id: context.user.id, merchant_id: merchantId, ...reviewPayload });
      if (result.error) throw new PortalError(result.error.message, 400);
      return NextResponse.json({ data: { saved: true } });
    }
    if (action === "add_search_favorite") {
      const searchText = value(body.searchText).replace(/\s+/g, " ").slice(0, 200);
      if (searchText.length < 2) throw new PortalError("search_text_required");
      const existing = await context.service.from("favorites").select("id").eq("buyer_id", context.user.id).eq("favorite_type", "search").ilike("search_text", searchText).maybeSingle();
      if (existing.error) throw new PortalError(existing.error.message, 400);
      if (existing.data?.id) return NextResponse.json({ data: { active: true, id: existing.data.id, existing: true } });
      const created = await context.service.from("favorites").insert({ buyer_id: context.user.id, favorite_type: "search", search_text: searchText }).select("id").single();
      if (created.error) throw new PortalError(created.error.message, 400);
      return NextResponse.json({ data: { active: true, id: created.data.id } });
    }
    if (action === "set_favorite_price_alert") {
      const favoriteId = uuid(body.favoriteId);
      const enabled = booleanValue(body.enabled);
      if (!favoriteId) throw new PortalError("favorite_not_found", 404);
      const favorite = await context.service.from("favorites").select("id,favorite_type,product_id").eq("id", favoriteId).eq("buyer_id", context.user.id).maybeSingle();
      if (favorite.error) throw new PortalError(favorite.error.message, 400);
      if (!favorite.data?.id) throw new PortalError("favorite_not_found", 404);
      const updated = await context.service.from("favorites").update({ is_price_alert_enabled: enabled }).eq("id", favoriteId).eq("buyer_id", context.user.id).select("id").single();
      if (updated.error) throw new PortalError(updated.error.message, 400);
      return NextResponse.json({ data: { active: enabled, id: favoriteId } });
    }
    if (action === "toggle_favorite") {
      const favoriteType = value(body.favoriteType); const targetId = uuid(body.targetId);
      if (!["merchant", "product", "search"].includes(favoriteType)) throw new PortalError("invalid_favorite_type");
      if (favoriteType === "search") {
        const searchText = value(body.searchText).slice(0, 200); if (!searchText) throw new PortalError("search_text_required");
        const existing = await context.service.from("favorites").select("id").eq("buyer_id", context.user.id).eq("favorite_type", "search").ilike("search_text", searchText).maybeSingle();
        if (existing.data?.id) { await context.service.from("favorites").delete().eq("id", existing.data.id).eq("buyer_id", context.user.id); return NextResponse.json({ data: { active: false } }); }
        const created = await context.service.from("favorites").insert({ buyer_id: context.user.id, favorite_type: "search", search_text: searchText }).select("id").single();
        if (created.error) throw new PortalError(created.error.message, 400);
        return NextResponse.json({ data: { active: true, id: created.data.id } });
      }
      if (!targetId) throw new PortalError("invalid_favorite_type");
      let targetMerchantId = targetId;
      if (favoriteType === "product") {
        const product = await context.service.from("products").select("id,merchant_id,is_active,is_available").eq("id", targetId).maybeSingle();
        if (!product.data || product.data.is_active !== true || product.data.is_available !== true) throw new PortalError("buyer_product_not_available", 404);
        targetMerchantId = value(product.data.merchant_id);
      }
      await visibleMerchant(context, targetMerchantId);
      const base = context.service.from("favorites").select("id").eq("buyer_id", context.user.id).eq("favorite_type", favoriteType);
      const existing = favoriteType === "merchant" ? await base.eq("merchant_id", targetId).maybeSingle() : await base.eq("product_id", targetId).maybeSingle();
      if (existing.data?.id) { await context.service.from("favorites").delete().eq("id", existing.data.id).eq("buyer_id", context.user.id); return NextResponse.json({ data: { active: false } }); }
      const created = await context.service.from("favorites").insert({ buyer_id: context.user.id, favorite_type: favoriteType, merchant_id: favoriteType === "merchant" ? targetId : null, product_id: favoriteType === "product" ? targetId : null }).select("id").single();
      if (created.error) throw new PortalError(created.error.message, 400);
      return NextResponse.json({ data: { active: true, id: created.data.id } });
    }
    if (action === "toggle_price_alert") {
      const productId = uuid(body.productId);
      const product = await context.service.from("products").select("id,merchant_id,free_name,price,is_active,is_available").eq("id", productId).maybeSingle();
      if (!product.data || product.data.is_active !== true || product.data.is_available !== true) throw new PortalError("buyer_product_not_available", 404);
      await visibleMerchant(context, value(product.data.merchant_id));
      let favorite = await context.service.from("favorites").select("id").eq("buyer_id", context.user.id).eq("favorite_type", "product").eq("product_id", productId).maybeSingle();
      if (!favorite.data?.id) favorite = await context.service.from("favorites").insert({ buyer_id: context.user.id, favorite_type: "product", product_id: productId }).select("id").single();
      if (favorite.error || !favorite.data?.id) throw new PortalError(favorite.error?.message || "favorite_create_failed", 400);
      const existing = await context.service.from("price_alerts").select("id").eq("buyer_id", context.user.id).eq("product_id", productId).eq("is_active", true).is("cancelled_at", null).maybeSingle();
      if (existing.data?.id) {
        const stopped = await context.service.from("price_alerts").update({ is_active: false, cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", existing.data.id).eq("buyer_id", context.user.id);
        if (stopped.error) throw new PortalError(stopped.error.message, 400);
        await context.service.from("favorites").update({ is_price_alert_enabled: false }).eq("id", favorite.data.id);
        return NextResponse.json({ data: { active: false } });
      }
      const created = await context.service.from("price_alerts").insert({ buyer_id: context.user.id, watched_product_text: product.data.free_name, favorite_id: favorite.data.id, product_id: productId, merchant_id: product.data.merchant_id, alert_type: "best_price", reference_price: product.data.price, last_known_price: product.data.price, last_valid_price: product.data.price, current_price: product.data.price, is_active: true, cancelled_at: null, last_price_status: "waiting" }).select("id").single();
      if (created.error) throw new PortalError(created.error.message, 400);
      await context.service.from("favorites").update({ is_price_alert_enabled: true }).eq("id", favorite.data.id);
      return NextResponse.json({ data: { active: true, id: created.data.id } });
    }
    if (action === "create_text_price_alert") {
      const watchedText = value(body.watchedText).replace(/\s+/g, " ").slice(0, 240);
      if (watchedText.length < 2) throw new PortalError("price_alert_text_required", 400);
      const location = await context.userDb.rpc("my_buyer_location");
      const existing = await context.service.from("price_alerts").select("id,is_active,cancelled_at")
        .eq("buyer_id", context.user.id).is("product_id", null).ilike("watched_product_text", watchedText).maybeSingle();
      if (existing.error) throw new PortalError(existing.error.message, 400);
      if (existing.data?.id) {
        const revived = await context.service.from("price_alerts").update({
          is_active: true, cancelled_at: null, alert_type: "best_price", search_scope: objectValue(location.data),
          last_price_status: "waiting", last_error: null, updated_at: new Date().toISOString(),
        }).eq("id", existing.data.id).eq("buyer_id", context.user.id).select("id").single();
        if (revived.error) throw new PortalError(revived.error.message, 400);
        return NextResponse.json({ data: { active: true, id: revived.data.id } });
      }
      const created = await context.service.from("price_alerts").insert({
        buyer_id: context.user.id, watched_product_text: watchedText, search_scope: objectValue(location.data),
        alert_type: "best_price", is_active: true, cancelled_at: null, last_price_status: "waiting",
      }).select("id").single();
      if (created.error) throw new PortalError(created.error.message, 400);
      return NextResponse.json({ data: { active: true, id: created.data.id } });
    }
    if (action === "set_price_alert_active") {
      const alertId = uuid(body.alertId);
      const active = booleanValue(body.active);
      if (!alertId) throw new PortalError("price_alert_not_found", 404);
      const current = await context.service.from("price_alerts").select("id,favorite_id").eq("id", alertId).eq("buyer_id", context.user.id).maybeSingle();
      if (current.error) throw new PortalError(current.error.message, 400);
      if (!current.data?.id) throw new PortalError("price_alert_not_found", 404);
      const updated = await context.service.from("price_alerts").update({ is_active: active, cancelled_at: active ? null : new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", alertId).eq("buyer_id", context.user.id).select("id,favorite_id").single();
      if (updated.error) throw new PortalError(updated.error.message, 400);
      if (updated.data.favorite_id) await context.service.from("favorites").update({ is_price_alert_enabled: active }).eq("id", updated.data.favorite_id).eq("buyer_id", context.user.id);
      return NextResponse.json({ data: { active, id: updated.data.id } });
    }
    if (action === "stop_price_alert") {
      const alertId = uuid(body.alertId);
      if (!alertId) throw new PortalError("price_alert_not_found", 404);
      const stopped = await context.service.from("price_alerts").update({ is_active: false, cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", alertId).eq("buyer_id", context.user.id).select("id,favorite_id").maybeSingle();
      if (stopped.error) throw new PortalError(stopped.error.message, 400);
      if (!stopped.data?.id) throw new PortalError("price_alert_not_found", 404);
      if (stopped.data.favorite_id) await context.service.from("favorites").update({ is_price_alert_enabled: false }).eq("id", stopped.data.favorite_id).eq("buyer_id", context.user.id);
      return NextResponse.json({ data: { active: false } });
    }
    if (action === "save_location") {
      const cityId = uuid(body.cityId);
      const city = await context.service.from("cities").select("id,name_ar,name_en,governorate_ar,governorate_en,country_ar,country_en,currency_code,currency_name_ar,currency_name_en").eq("id", cityId).eq("is_active", true).maybeSingle();
      if (!city.data) throw new PortalError("city_not_found", 404);
      const result = await context.userDb.rpc("save_my_buyer_location", { p_location: { city_id: city.data.id, city: city.data.name_ar, city_ar: city.data.name_ar, city_en: city.data.name_en, governorate: city.data.governorate_ar, governorate_ar: city.data.governorate_ar, governorate_en: city.data.governorate_en, country: city.data.country_ar || city.data.country_en || "مصر", country_ar: city.data.country_ar || "مصر", country_en: city.data.country_en || "Egypt", currency_code: city.data.currency_code || "EGP", currency_name_ar: city.data.currency_name_ar, currency_name_en: city.data.currency_name_en, latitude: value(body.latitude) ? numberValue(body.latitude) : null, longitude: value(body.longitude) ? numberValue(body.longitude) : null, is_manual: true, source: "buyer_web" } });
      if (result.error) throw new PortalError(result.error.message, 400);
      return NextResponse.json({ data: result.data });
    }
    if (action === "mark_notification") {
      const result = await context.service.from("notifications").update({ is_read: true, read_at: new Date().toISOString() }).eq("id", uuid(body.id)).eq("user_id", context.user.id).select("id").maybeSingle();
      if (result.error) throw new PortalError(result.error.message, 400);
      return NextResponse.json({ data: result.data });
    }
    if (action === "mark_all_notifications") {
      const visible = await buyerNotifications(context, 1000);
      const ids = visible.filter((item) => item.is_read !== true).map((item) => value(item.id)).filter(Boolean);
      if (ids.length) {
        const result = await context.service.from("notifications").update({ is_read: true, read_at: new Date().toISOString() }).eq("user_id", context.user.id).in("id", ids);
        if (result.error) throw new PortalError(result.error.message, 400);
      }
      return NextResponse.json({ data: { updated: ids.length } });
    }
    if (action === "create_support_conversation") {
      const title = value(body.title).slice(0, 160);
      if (title.length < 15) throw new PortalError("support_title_too_short");
      const result = await context.userDb.rpc("create_support_conversation", { p_title: title, p_locale: body.locale === "en" ? "en" : "ar" });
      if (result.error) throw new PortalError(result.error.message, 400);
      return NextResponse.json({ data: await supportConversationBundle(context, value(result.data)) });
    }
    if (action === "load_support_conversation") {
      return NextResponse.json({ data: await supportConversationBundle(context, uuid(body.conversationId)) });
    }
    if (action === "send_support_message") {
      const conversationId = uuid(body.conversationId);
      const message = value(body.message).slice(0, 4000);
      if (!conversationId || !message) throw new PortalError("message_required");
      const ownership = await context.service.from("chat_conversations").select("id,status").eq("id", conversationId).eq("user_id", context.user.id).maybeSingle();
      if (!ownership.data?.id) throw new PortalError("support_conversation_not_found", 404);
      let resultData: unknown;
      if (value(ownership.data.status) === "transferred") {
        const result = await context.userDb.rpc("send_support_message", { p_conversation_id: conversationId, p_body: message });
        if (result.error) throw new PortalError(result.error.message, 400);
        resultData = result.data;
      } else {
        const result = await context.userDb.functions.invoke("support-chatbot", {
          body: { conversation_id: conversationId, message, locale: body.locale === "en" ? "en" : "ar" },
        });
        if (result.error) throw new PortalError(result.error.message, 400);
        resultData = result.data;
      }
      return NextResponse.json({ data: { result: resultData, ...(await supportConversationBundle(context, conversationId)) } });
    }
    if (action === "transfer_support") {
      const conversationId = uuid(body.conversationId);
      if (!conversationId) throw new PortalError("support_conversation_not_found", 404);
      const result = await context.userDb.rpc("transfer_support_conversation", { p_conversation_id: conversationId, p_reason: value(body.reason).slice(0, 500) || "requested_by_user" });
      if (result.error) throw new PortalError(result.error.message, 400);
      return NextResponse.json({ data: await supportConversationBundle(context, conversationId) });
    }
    if (action === "close_support_conversation") {
      const conversationId = uuid(body.conversationId);
      const result = await context.userDb.rpc("close_my_support_conversation", { p_conversation_id: conversationId });
      if (result.error) throw new PortalError(result.error.message, 400);
      return NextResponse.json({ data: await supportConversationBundle(context, conversationId) });
    }
    if (action === "rate_support_conversation") {
      const conversationId = uuid(body.conversationId);
      const stars = Math.max(1, Math.min(5, Math.round(numberValue(body.stars, 5))));
      const sentiment = body.sentiment === "negative" ? "negative" : "positive";
      const comment = value(body.comment).slice(0, 1000) || null;
      const result = await context.userDb.rpc("submit_my_support_conversation_rating", { p_conversation_id: conversationId, p_stars: stars, p_sentiment: sentiment, p_comment: comment });
      if (result.error) throw new PortalError(result.error.message, 400);
      return NextResponse.json({ data: await supportConversationBundle(context, conversationId) });
    }
    if (action === "save_preferences") {
      const language = body.language === "en" ? "en" : "ar"; const theme = body.theme === "dark" ? "dark" : "light";
      const result = await context.service.from("users").update({ preferred_language: language, theme, updated_at: new Date().toISOString() }).eq("id", context.user.id).select("*").single();
      if (result.error) throw new PortalError(result.error.message, 400);
      return NextResponse.json({ data: result.data });
    }
    if (action === "save_profile") {
      const fullName = value(body.fullName).slice(0, 160); const mobile = value(body.mobile).slice(0, 40);
      if (fullName.length < 2 || mobile.length < 7) throw new PortalError("profile_data_required");
      const result = await context.service.from("users").update({ full_name: fullName, mobile, updated_at: new Date().toISOString() }).eq("id", context.user.id).select("*").single();
      if (result.error) throw new PortalError(result.error.message, 400);
      return NextResponse.json({ data: result.data });
    }
    throw new PortalError("buyer_action_not_found", 404);
  } catch (error) { return errorResponse(error); }
}
