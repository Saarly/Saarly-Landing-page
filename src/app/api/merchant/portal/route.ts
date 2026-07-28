import { NextRequest, NextResponse } from "next/server";
import { allowedBranchIds, assertBranchAccess, canManage, ownerOnly, PortalError, requireMerchant, type MerchantContext, type Row } from "@/lib/merchant-auth";

export const dynamic = "force-dynamic";

function value(value: unknown) {
  return String(value ?? "").trim();
}

function uuid(valueInput: unknown) {
  const input = value(valueInput);
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input) ? input : "";
}

function finiteNumber(input: unknown, fallback = 0) {
  const result = Number(input);
  return Number.isFinite(result) ? result : fallback;
}

function booleanValue(input: unknown, fallback = false) {
  return typeof input === "boolean" ? input : input === "true" ? true : input === "false" ? false : fallback;
}

function stringList(input: unknown) {
  return Array.isArray(input) ? input.map((item) => value(item)).filter(Boolean) : [];
}

function safeLimit(input: unknown, fallback = 50, max = 200) {
  return Math.min(max, Math.max(1, Math.trunc(finiteNumber(input, fallback))));
}

function safeOffset(input: unknown) {
  return Math.max(0, Math.trunc(finiteNumber(input, 0)));
}

function scopedBranchIds(context: MerchantContext) {
  const allowed = allowedBranchIds(context);
  return allowed ? [...allowed] : null;
}

function normalizeStoragePath(bucket: string, raw: unknown) {
  let result = value(raw).split("?")[0].replace(/^\/+/, "");
  const marker = "/storage/v1/object/";
  const markerIndex = result.indexOf(marker);
  if (markerIndex >= 0) {
    result = result.slice(markerIndex + marker.length).replace(/^(public|sign|authenticated)\//, "");
  }
  if (result.startsWith(`${bucket}/`)) result = result.slice(bucket.length + 1);
  return result.replace(/^\/+/, "");
}


async function signedStorageUrl(context: MerchantContext, bucket: string, raw: unknown, expiresIn = 3600) {
  const path = normalizeStoragePath(bucket, raw);
  if (!path) return "";
  if (/^https?:\/\//i.test(value(raw))) return value(raw);
  const result = await context.service.storage.from(bucket).createSignedUrl(path, expiresIn);
  return result.error ? "" : result.data.signedUrl;
}

async function signBuyerMerchantRows(context: MerchantContext, items: Row[]) {
  return Promise.all(items.map(async (item) => ({
    ...item,
    storefront_signed_url: await signedStorageUrl(context, "storefront-photos", item.store_front_image_url),
  })));
}

async function signBuyerProductRows(context: MerchantContext, items: Row[]) {
  return Promise.all(items.map(async (item) => {
    const rawImages = Array.isArray(item.image_urls) ? item.image_urls : [];
    const imageValues = [item.image_url, ...rawImages].map(value).filter(Boolean).slice(0, 6);
    const signedImages = await Promise.all(imageValues.map((image) => signedStorageUrl(context, "product-images", image)));
    const cleanImages = signedImages.filter(Boolean);
    return {
      ...item,
      image_signed_url: cleanImages[0] ?? "",
      image_signed_urls: cleanImages,
    };
  }));
}

async function scopedOrderIds(context: MerchantContext) {
  const scope = allowedBranchIds(context);
  if (!scope) return null;
  if (scope.size === 0) return new Set<string>();
  const { data, error } = await context.service
    .from("order_merchant_fulfillments")
    .select("order_id")
    .eq("merchant_id", context.merchantId)
    .in("branch_id", [...scope]);
  if (error) throw new PortalError(error.message, 400);
  return new Set(((data ?? []) as Row[]).map((item) => value(item.order_id)).filter(Boolean));
}

async function scopedReviews(context: MerchantContext, limit = 300) {
  const result = await context.service
    .from("reviews")
    .select("id,order_id,buyer_id,stars,comment,created_at,updated_at")
    .eq("merchant_id", context.merchantId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (result.error) throw new PortalError(result.error.message, 400);
  const allowedOrders = await scopedOrderIds(context);
  if (!allowedOrders) return (result.data ?? []) as Row[];
  return ((result.data ?? []) as Row[]).filter((item) => allowedOrders.has(value(item.order_id)));
}
function errorResponse(error: unknown) {
  if (error instanceof PortalError) {
    return NextResponse.json({ error: error.code }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "portal_request_failed";
  console.error("merchant portal error", error);
  return NextResponse.json({ error: message || "portal_request_failed" }, { status: 500 });
}

async function accountStatus(context: MerchantContext) {
  const { data, error } = await context.userDb.rpc("merchant_account_status");
  if (error) {
    return {
      merchant_id: context.merchantId,
      access_status: context.merchant.approval_status === "approved" ? "pre_launch_access" : "suspended",
      can_receive_orders: context.merchant.approval_status === "approved",
      stop_reason: context.merchant.rejection_reason ?? null,
      pricing_mode: context.merchant.pricing_mode,
      billing_preference: context.merchant.billing_preference,
    };
  }
  return data ?? {};
}

async function audit(context: MerchantContext, action: string, targetTable: string, targetId: string, oldData: Row | null, newData: Row | null) {
  const { error } = await context.service.from("audit_logs").insert({
    actor_id: context.user.id,
    action,
    target_table: targetTable,
    target_id: targetId,
    old_data: oldData,
    new_data: newData,
  });
  if (error) console.warn("portal audit failed", error.message);
}

async function overviewData(context: MerchantContext) {
  const scope = scopedBranchIds(context);
  let ordersQuery = context.service.from("order_merchant_fulfillments").select("id", { count: "exact", head: true }).eq("merchant_id", context.merchantId);
  let branchesQuery = context.service.from("branches").select("id", { count: "exact", head: true }).eq("merchant_id", context.merchantId);
  if (scope?.length) {
    ordersQuery = ordersQuery.in("branch_id", scope);
    branchesQuery = branchesQuery.in("id", scope);
  }
  const [products, requests, orders, branches, unread, status, report] = await Promise.all([
    context.service.from("products").select("id", { count: "exact", head: true }).eq("merchant_id", context.merchantId).eq("is_active", true),
    context.userDb.rpc("my_merchant_rfq_requests"),
    ordersQuery,
    branchesQuery,
    context.service.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", context.user.id).eq("is_read", false),
    accountStatus(context),
    context.userDb.rpc("merchant_report_summary"),
  ]);
  const { data: recentNotifications } = await context.service
    .from("notifications")
    .select("id, type, title_ar, title_en, body_ar, body_en, is_read, created_at, deep_link, payload")
    .eq("user_id", context.user.id)
    .order("created_at", { ascending: false })
    .limit(5);
  const { data: staleProducts } = await context.service
    .from("products")
    .select("id, free_name, price, quantity, price_quantity_updated_at")
    .eq("merchant_id", context.merchantId)
    .eq("is_active", true)
    .lt("price_quantity_updated_at", new Date(Date.now() - 30 * 86400000).toISOString())
    .order("price_quantity_updated_at")
    .limit(8);
  return {
    counts: {
      products: products.count ?? 0,
      requests: Array.isArray(requests.data) ? requests.data.length : 0,
      orders: orders.count ?? 0,
      branches: branches.count ?? 0,
      notifications: unread.count ?? 0,
    },
    status,
    report: Array.isArray(report.data) ? report.data[0] ?? {} : report.data ?? {},
    recentNotifications: recentNotifications ?? [],
    staleProducts: staleProducts ?? [],
    currencyCode: context.currencyCode,
  };
}

async function loadBilling(context: MerchantContext) {
  const status = await accountStatus(context);
  const { data: flags } = await context.service
    .from("feature_flags")
    .select("key, is_enabled, configuration")
    .in("key", [
      "monetization_enabled",
      "monetization_enforcement_enabled",
      "manual_payment_enabled",
      "automatic_payment_enabled",
      "commission_mode_enabled",
      "grace_period_enabled",
    ]);
  const flagMap = Object.fromEntries(((flags ?? []) as Row[]).map((item: Row) => [String(item.key), item]));
  const monetization = Boolean(flagMap.monetization_enabled?.is_enabled);
  const manualEnabled = monetization && Boolean(flagMap.manual_payment_enabled?.is_enabled);
  const automaticEnabled = monetization && Boolean(flagMap.automatic_payment_enabled?.is_enabled);

  const [subscriptions, paymentRequests, ledger, commissions, settlements] = await Promise.all([
    context.service.from("merchant_subscriptions").select("*").eq("merchant_id", context.merchantId).order("created_at", { ascending: false }).limit(50),
    context.service.from("manual_payment_requests").select("*").eq("merchant_id", context.merchantId).order("created_at", { ascending: false }).limit(50),
    context.service.from("merchant_billing_ledger").select("*").eq("merchant_id", context.merchantId).order("created_at", { ascending: false }).limit(100),
    context.service.from("merchant_commissions").select("*").eq("merchant_id", context.merchantId).order("created_at", { ascending: false }).limit(100),
    context.service.from("merchant_commission_settlements").select("*").eq("merchant_id", context.merchantId).order("created_at", { ascending: false }).limit(50),
  ]);

  let plans: Row[] = [];
  let manualMethods: Row[] = [];
  let gateways: Row[] = [];
  if (monetization) {
    const planResult = await context.service
      .from("subscription_plans")
      .select("id, name_ar, name_en, description_ar, description_en, monthly_price, old_price, currency, duration_days, plan_type, features_ar, features_en, sort_order")
      .eq("is_active", true)
      .order("sort_order");
    plans = (planResult.data ?? []) as Row[];
  }
  if (manualEnabled) {
    const methodResult = await context.service
      .from("manual_payment_methods")
      .select("id, code, name_ar, name_en, account_label, account_number, account_holder_name, instructions_ar, instructions_en, allowed_mime_types, max_file_size_bytes, sort_order")
      .eq("is_active", true)
      .order("sort_order");
    manualMethods = (methodResult.data ?? []) as Row[];
  }
  if (automaticEnabled) {
    const gatewayResult = await context.service
      .from("payment_settings")
      .select("id, provider, display_name_ar, display_name_en, supported_currencies, supported_methods, gateway_environment")
      .eq("is_enabled", true)
      .eq("is_connected", true);
    gateways = (gatewayResult.data ?? []) as Row[];
  }

  return {
    status,
    flags: {
      monetizationEnabled: monetization,
      manualPaymentEnabled: manualEnabled,
      automaticPaymentEnabled: automaticEnabled,
      commissionEnabled: monetization && Boolean(flagMap.commission_mode_enabled?.is_enabled),
      enforcementEnabled: Boolean(flagMap.monetization_enforcement_enabled?.is_enabled),
    },
    plans,
    manualMethods,
    gateways,
    subscriptions: subscriptions.data ?? [],
    paymentRequests: paymentRequests.data ?? [],
    ledger: ledger.data ?? [],
    commissions: commissions.data ?? [],
    settlements: settlements.data ?? [],
    currencyCode: context.currencyCode,
  };
}


async function loadImports(context: MerchantContext) {
  const { data: batches, error } = await context.service
    .from("product_import_batches")
    .select("id, source, original_file_url, ai_result, status, reviewed_at, approved_at, created_at, updated_at")
    .eq("merchant_id", context.merchantId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new PortalError(error.message, 400);
  const ids = ((batches ?? []) as Row[]).map((item: Row) => String(item.id));
  let items: Row[] = [];
  if (ids.length) {
    const result = await context.service
      .from("product_import_items")
      .select("id, batch_id, row_number, raw_value, parsed_product, ai_confidence, review_status, row_errors, approved_product_id, created_at")
      .in("batch_id", ids)
      .order("row_number");
    if (result.error) throw new PortalError(result.error.message, 400);
    items = (result.data ?? []) as Row[];
  }
  const { data: categories } = await context.service.from("categories").select("id,name_ar,name_en,parent_id").eq("is_active", true).order("display_order");
  return { batches: batches ?? [], items, categories: categories ?? [] };
}

async function loadHours(context: MerchantContext) {
  const { data, error } = await context.service
    .from("merchant_working_hours")
    .select("id,day_of_week,is_open,opens_at,closes_at")
    .eq("merchant_id", context.merchantId)
    .order("day_of_week");
  if (error) throw new PortalError(error.message, 400);
  return { hours: data ?? [] };
}

async function loadDelivery(context: MerchantContext) {
  const [settings, options] = await Promise.all([
    context.service.from("delivery_settings").select("*").eq("merchant_id", context.merchantId).maybeSingle(),
    context.userDb.rpc("get_merchant_shipping_options", { p_merchant_id: context.merchantId }),
  ]);
  if (settings.error) throw new PortalError(settings.error.message, 400);
  return { settings: settings.data ?? null, shipping: options.error ? {} : options.data ?? {}, currencyCode: context.currencyCode };
}

async function loadReports(context: MerchantContext) {
  const [summary, growth, branches, reviewRows] = await Promise.all([
    context.userDb.rpc("merchant_report_summary"),
    context.userDb.rpc("merchant_growth_report"),
    context.userDb.rpc("merchant_branch_sales_summary"),
    scopedReviews(context, 200),
  ]);
  const scope = allowedBranchIds(context);
  const branchRows = Array.isArray(branches.data) ? branches.data as Row[] : [];
  const visibleBranches = scope ? branchRows.filter((item) => scope.has(String(item.branch_id ?? ""))) : branchRows;
  let visibleReviews = reviewRows;
  let summaryRow = (Array.isArray(summary.data) ? summary.data[0] ?? {} : summary.data ?? {}) as Row;
  let growthRow = (growth.data ?? {}) as Row;
  if (scope) {
    summaryRow = {
      ...summaryRow,
      total_sales: visibleBranches.reduce((sum, item) => sum + finiteNumber(item.total_sales), 0),
      confirmed_orders_count: visibleBranches.reduce((sum, item) => sum + finiteNumber(item.confirmed_orders_count), 0),
      average_rating: visibleReviews.length ? visibleReviews.reduce((sum, item) => sum + finiteNumber(item.stars), 0) / visibleReviews.length : 0,
      reviews_count: visibleReviews.length,
      scoped_to_assigned_branches: true,
    };
    growthRow = { scoped_to_assigned_branches: true, total_sales: summaryRow.total_sales, confirmed_orders_count: summaryRow.confirmed_orders_count };
  }
  return { summary: summaryRow, growth: growthRow, branches: visibleBranches, reviews: visibleReviews, currencyCode: context.currencyCode };
}

async function loadReferrals(context: MerchantContext) {
  const [dashboard, ads] = await Promise.all([
    context.userDb.rpc("my_referral_dashboard"),
    context.service.from("ads_banners").select("id,title_ar,title_en,image_url,target_url,placement,is_active,is_ongoing,starts_at,ends_at").eq("placement", "merchant_referrals_top").eq("is_active", true).order("created_at", { ascending: false }).limit(10),
  ]);
  if (dashboard.error) throw new PortalError(dashboard.error.message, 400);
  return { dashboard: dashboard.data ?? {}, ads: ads.data ?? [] };
}

async function loadSupport(context: MerchantContext) {
  const start = await context.userDb.rpc("start_or_get_support_conversation", {
    p_title: context.profile.preferred_language === "en" ? "Merchant portal support" : "دعم بوابة المتجر",
    p_locale: context.profile.preferred_language === "en" ? "en" : "ar",
  });
  if (start.error) throw new PortalError(start.error.message, 400);
  const conversationId = String(start.data ?? "");
  const [conversation, messages] = await Promise.all([
    context.service.from("chat_conversations").select("*").eq("id", conversationId).eq("user_id", context.user.id).maybeSingle(),
    context.service.from("chat_messages").select("id,conversation_id,sender_type,sender_user_id,body,metadata,created_at").eq("conversation_id", conversationId).order("created_at", { ascending: true }).limit(300),
  ]);
  if (conversation.error || messages.error) throw new PortalError(conversation.error?.message || messages.error?.message || "support_load_failed", 400);
  await context.userDb.rpc("mark_support_conversation_read", { p_conversation_id: conversationId });
  return { conversation: conversation.data ?? {}, messages: messages.data ?? [] };
}

async function loadReviews(context: MerchantContext) {
  return { reviews: await scopedReviews(context, 300) };
}

async function visibleBuyerMerchant(context: MerchantContext, merchantId: string) {
  if (!merchantId || merchantId === context.merchantId) throw new PortalError("own_store_hidden_in_buyer_mode", 400);
  const visible = await context.userDb.rpc("buyer_storefront_merchants", { p_category_id: null, p_query: null });
  if (visible.error) throw new PortalError(visible.error.message, 400);
  const match = ((visible.data ?? []) as Row[]).find((item) => value(item.merchant_id) === merchantId);
  if (!match) throw new PortalError("buyer_store_not_available", 404);
  return match;
}

async function loadBuyerMode(context: MerchantContext) {
  const [categories, merchants, favorites, alerts, location, locations] = await Promise.all([
    context.userDb.rpc("buyer_storefront_categories"),
    context.userDb.rpc("buyer_storefront_merchants", { p_category_id: null, p_query: null }),
    context.userDb.rpc("my_buyer_favorites"),
    context.userDb.rpc("my_buyer_price_alerts"),
    context.userDb.rpc("my_buyer_location"),
    context.userDb.rpc("app_location_options"),
  ]);
  const error = categories.error || merchants.error || favorites.error || alerts.error || location.error || locations.error;
  if (error) throw new PortalError(error.message || "buyer_mode_load_failed", 400);
  const merchantRows = await signBuyerMerchantRows(context, (merchants.data ?? []) as Row[]);
  const favoriteRows = await Promise.all(((favorites.data ?? []) as Row[]).map(async (item) => ({
    ...item,
    image_signed_url: await signedStorageUrl(
      context,
      value(item.favorite_type) === "merchant" ? "storefront-photos" : "product-images",
      item.image_url,
    ),
  })));
  return {
    categories: categories.data ?? [],
    merchants: merchantRows,
    favorites: favoriteRows,
    priceAlerts: alerts.data ?? [],
    location: location.data ?? {},
    locationOptions: locations.data ?? [],
  };
}

async function loadSection(context: MerchantContext, section: string) {
  const unreadResult = await context.service
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", context.user.id)
    .eq("is_read", false);
  const common = {
    account: {
      userId: context.user.id,
      email: context.user.email ?? context.profile.primary_email ?? "",
      profile: context.profile,
      merchant: context.merchant,
      merchantId: context.merchantId,
      isOwner: context.isOwner,
      staff: context.staff,
      branchIds: context.branchIds,
      currencyCode: context.currencyCode,
      unreadNotifications: unreadResult.count ?? 0,
    },
  };

  if (section === "overview") return { ...common, section, data: await overviewData(context) };
  if (section === "store" || section === "settings") {
    const [merchantCategories, categories] = await Promise.all([
      context.service.from("merchant_categories").select("merchant_id, category_id, is_primary").eq("merchant_id", context.merchantId),
      context.service.from("categories").select("id, name_ar, name_en, slug, display_order").is("parent_id", null).eq("is_active", true).order("display_order"),
    ]);
    const { data: settingsAds } = await context.service
      .from("ads_banners")
      .select("id,title_ar,title_en,image_url,target_url,placement,is_active,is_ongoing,starts_at,ends_at")
      .eq("placement", "merchant_settings_top")
      .eq("is_active", true)
      .order("created_at", { ascending: false })
      .limit(10);
    return { ...common, section, data: { merchantCategories: merchantCategories.data ?? [], categories: categories.data ?? [], status: await accountStatus(context), settingsAds: settingsAds ?? [] } };
  }
  if (section === "products") {
    const scope = scopedBranchIds(context);
    const [products, categories, availability, branches] = await Promise.all([
      context.service.from("products").select("id, category_id, free_name, price, unit, quantity, brand, size, color, image_url, image_urls, is_active, is_available, price_quantity_updated_at, shipping_type, delivery_pricing_method, shipping_weight_kg, weight_in_kg").eq("merchant_id", context.merchantId).order("updated_at", { ascending: false }).limit(1000),
      context.service.from("categories").select("id, name_ar, name_en, parent_id, slug").eq("is_active", true).order("display_order"),
      context.service.from("branch_product_availability").select("branch_id,product_id,is_available").eq("merchant_id", context.merchantId),
      context.service.from("branches").select("id,name,approval_status").eq("merchant_id", context.merchantId).eq("approval_status", "approved").order("name"),
    ]);
    const branchRows = scope?.length ? ((branches.data ?? []) as Row[]).filter((item: Row) => scope.includes(String(item.id))) : branches.data ?? [];
    const availabilityRows = scope?.length ? ((availability.data ?? []) as Row[]).filter((item: Row) => scope.includes(String(item.branch_id))) : availability.data ?? [];
    return { ...common, section, data: { products: products.data ?? [], categories: categories.data ?? [], branches: branchRows, availability: availabilityRows, currencyCode: context.currencyCode } };
  }
  if (section === "requests") {
    const { data, error } = await context.userDb.rpc("my_merchant_rfq_requests");
    if (error) throw new PortalError(error.message, 400);
    return { ...common, section, data: { requests: data ?? [] } };
  }
  if (section === "orders") {
    const { data, error } = await context.service
      .from("order_merchant_fulfillments")
      .select("id, order_id, branch_id, status, subtotal_snapshot, confirmation_deadline, confirmed_at, merchant_cancel_reason, merchant_cancel_details, buyer_decision, buyer_decided_at, created_at, updated_at, items:order_fulfillment_items(id, requested_name_snapshot, matched_name_snapshot, quantity_snapshot, unit_snapshot, unit_price_snapshot, line_total_snapshot)")
      .eq("merchant_id", context.merchantId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new PortalError(error.message, 400);
    const scope = allowedBranchIds(context);
    const scopedOrders = scope ? ((data ?? []) as Row[]).filter((item) => scope.has(String(item.branch_id ?? ""))) : (data ?? []) as Row[];
    const orderIds = scopedOrders.map((item: Row) => String(item.order_id ?? "")).filter(Boolean);
    let buyers: Row[] = [];
    if (orderIds.length > 0) {
      const buyerResult = await context.service.rpc("merchant_order_buyer_cards", { p_order_ids: orderIds });
      if (!buyerResult.error && Array.isArray(buyerResult.data)) buyers = buyerResult.data as Row[];
    }
    return { ...common, section, data: { orders: scopedOrders, buyers, currencyCode: context.currencyCode } };
  }
  if (section === "branches") {
    const [branches, cities, documents] = await Promise.all([
      context.service.from("branches").select("*").eq("merchant_id", context.merchantId).order("created_at", { ascending: false }),
      context.service.from("cities").select("id, name_ar, name_en, governorate_ar, governorate_en, country_ar, country_en").eq("is_active", true).order("display_order").limit(1000),
      context.service.from("merchant_documents").select("id, branch_id, manager_name, kind, status, rejection_reason, created_at").eq("merchant_id", context.merchantId).not("branch_id", "is", null).is("superseded_by", null),
    ]);
    const scope = allowedBranchIds(context);
    const scopedBranchRows = scope ? ((branches.data ?? []) as Row[]).filter((item: Row) => scope.has(String(item.id))) : (branches.data ?? []) as Row[];
    const branchRows = await Promise.all(scopedBranchRows.map(async (item) => ({ ...item, front_signed_url: await signedStorageUrl(context, "storefront-photos", item.front_image_url, 6 * 60 * 60) })));
    const documentRows = scope ? ((documents.data ?? []) as Row[]).filter((item: Row) => scope.has(String(item.branch_id))) : documents.data ?? [];
    return { ...common, section, data: { branches: branchRows, cities: cities.data ?? [], documents: documentRows } };
  }
  if (section === "employees") {
    const { data, error } = await context.userDb.rpc("my_merchant_staff_members");
    if (error) throw new PortalError(error.message, 400);
    const { data: branches } = await context.service.from("branches").select("id, name").eq("merchant_id", context.merchantId).order("name");
    return { ...common, section, data: { employees: data ?? [], branches: branches ?? [] } };
  }
  if (section === "imports") return { ...common, section, data: await loadImports(context) };
  if (section === "hours") return { ...common, section, data: await loadHours(context) };
  if (section === "delivery") return { ...common, section, data: await loadDelivery(context) };
  if (section === "reports") return { ...common, section, data: await loadReports(context) };
  if (section === "reviews") return { ...common, section, data: await loadReviews(context) };
  if (section === "referrals") return { ...common, section, data: await loadReferrals(context) };
  if (section === "support") return { ...common, section, data: await loadSupport(context) };
  if (section === "buyer") return { ...common, section, data: await loadBuyerMode(context) };
  if (section === "notifications") {
    const { data, error } = await context.service
      .from("notifications")
      .select("id, type, title_ar, title_en, body_ar, body_en, deep_link, is_read, read_at, created_at, payload")
      .eq("user_id", context.user.id)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new PortalError(error.message, 400);
    return { ...common, section, data: { notifications: data ?? [] } };
  }
  if (section === "billing" || section === "payments") {
    return { ...common, section, data: await loadBilling(context) };
  }
  return { ...common, section: "overview", data: await overviewData(context) };
}

export async function GET(request: NextRequest) {
  try {
    const context = await requireMerchant(request);
    const section = value(request.nextUrl.searchParams.get("section")) || "overview";
    if (section === "employees") ownerOnly(context);
    if (section === "store") ownerOnly(context);
    if (!context.isOwner && !canManage(context, section)) throw new PortalError("section_permission_required", 403);
    return NextResponse.json(await loadSection(context, section));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireMerchant(request);
    const body = (await request.json()) as Row;
    const action = value(body.action);

    if (action === "save_store") {
      ownerOnly(context);
      const categoryIds = Array.isArray(body.categoryIds) ? body.categoryIds.map(uuid).filter(Boolean) : [];
      const result = await context.userDb.rpc("save_my_merchant_profile_web", {
        p_payload: {
          store_name: value(body.storeName),
          manager_name: value(body.managerName),
          manager_mobile: value(body.managerMobile),
          contact_mobile: value(body.contactMobile),
          craftsman_available: booleanValue(body.craftsmanAvailable),
          category_ids: categoryIds,
        },
      });
      if (result.error) throw new PortalError(result.error.message, 400);
      return NextResponse.json({ data: result.data });
    }

    if (action === "save_product") {
      if (!canManage(context, "products")) throw new PortalError("product_permission_required", 403);
      const productId = uuid(body.id);
      const categoryId = uuid(body.categoryId) || null;
      const payload = {
        merchant_id: context.merchantId,
        category_id: categoryId,
        free_name: value(body.name).slice(0, 240),
        price: Math.max(0, finiteNumber(body.price)),
        unit: value(body.unit).slice(0, 80) || "قطعة",
        quantity: Math.max(0, finiteNumber(body.quantity)),
        brand: value(body.brand).slice(0, 160) || null,
        size: value(body.size).slice(0, 120) || null,
        color: value(body.color).slice(0, 120) || null,
        image_url: (stringList(body.imageUrls)[0] || value(body.imageUrl)).slice(0, 1000) || null,
        image_urls: (stringList(body.imageUrls).length ? stringList(body.imageUrls) : value(body.imageUrl) ? [value(body.imageUrl)] : []).slice(0, 6).map((item) => item.slice(0, 1000)),
        is_active: booleanValue(body.isActive, true),
        is_available: booleanValue(body.isAvailable, true),
        shipping_type: value(body.shippingType) || "fixed",
        delivery_pricing_method: ["flat", "zone", "weight"].includes(value(body.deliveryPricingMethod)) ? value(body.deliveryPricingMethod) : "flat",
        shipping_weight_kg: body.shippingWeightKg === null || body.shippingWeightKg === "" ? null : Math.max(0, finiteNumber(body.shippingWeightKg)),
        weight_in_kg: body.weightInKg === null || body.weightInKg === "" ? null : Math.max(0, finiteNumber(body.weightInKg)),
        price_quantity_updated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (payload.free_name.length < 2) throw new PortalError("product_name_required");
      let before: Row | null = null;
      let result;
      if (productId) {
        const current = await context.service.from("products").select("*").eq("id", productId).eq("merchant_id", context.merchantId).maybeSingle();
        if (!current.data) throw new PortalError("product_not_found", 404);
        before = current.data as Row;
        result = await context.service.from("products").update(payload).eq("id", productId).eq("merchant_id", context.merchantId).select("*").single();
      } else {
        result = await context.service.from("products").insert(payload).select("*").single();
      }
      if (result.error) throw new PortalError(result.error.message, 400);
      await audit(context, productId ? "portal_update_product" : "portal_create_product", "products", String(result.data.id), before, result.data as Row);
      return NextResponse.json({ data: result.data });
    }

    if (action === "deactivate_product") {
      if (!canManage(context, "products")) throw new PortalError("product_permission_required", 403);
      const productId = uuid(body.id);
      const before = await context.service.from("products").select("*").eq("id", productId).eq("merchant_id", context.merchantId).maybeSingle();
      if (!before.data) throw new PortalError("product_not_found", 404);
      const result = await context.service.from("products").update({ is_active: false, updated_at: new Date().toISOString() }).eq("id", productId).eq("merchant_id", context.merchantId).select("*").single();
      if (result.error) throw new PortalError(result.error.message, 400);
      await audit(context, "portal_deactivate_product", "products", productId, before.data as Row, result.data as Row);
      return NextResponse.json({ data: result.data });
    }

    if (action === "import_products") {
      if (!canManage(context, "imports")) throw new PortalError("import_permission_required", 403);
      const items = Array.isArray(body.items) ? body.items.slice(0, 500) : [];
      if (items.length === 0) throw new PortalError("import_rows_required");
      const sourcePath = normalizeStoragePath("product-imports", body.sourcePath);
      if (!sourcePath) throw new PortalError("import_file_required");
      const result = await context.userDb.rpc("import_my_products_web", {
        p_source: ["image", "pdf", "voice", "excel"].includes(value(body.source)) ? value(body.source) : "excel",
        p_original_file_url: sourcePath,
        p_file_name: value(body.fileName) || "portal-import",
        p_items: items.map((raw, index) => {
          const item = raw as Row;
          return {
            ...item,
            row_number: Math.max(1, Math.trunc(finiteNumber(item.rowNumber ?? item.row_number, index + 2))),
            free_name: value(item.free_name || item.name),
            category_id: uuid(item.category_id || item.categoryId) || null,
            errors: stringList(item.errors),
          };
        }),
      });
      if (result.error) throw new PortalError(result.error.message, 400);
      return NextResponse.json({ data: result.data });
    }

    if (action === "save_branch") {
      ownerOnly(context);
      const result = await context.userDb.rpc("save_my_merchant_branch_web", {
        p_payload: {
          id: uuid(body.id) || null,
          name: value(body.name),
          city_id: uuid(body.cityId),
          latitude: finiteNumber(body.latitude),
          longitude: finiteNumber(body.longitude),
          manager_name: value(body.managerName),
          manager_mobile: value(body.managerMobile),
          front_image_url: normalizeStoragePath("storefront-photos", body.frontImageUrl) || null,
          manager_id_front_path: normalizeStoragePath("merchant-ids", body.managerIdFrontPath) || null,
          manager_id_back_path: normalizeStoragePath("merchant-ids", body.managerIdBackPath) || null,
          uses_parent_commercial_register: booleanValue(body.usesParentCommercialRegister, true),
          commercial_register_path: normalizeStoragePath("commercial-registers", body.commercialRegisterPath) || null,
          delivery_enabled: body.deliveryEnabled === null || body.deliveryEnabled === undefined ? null : booleanValue(body.deliveryEnabled),
          delivery_pricing_method: value(body.deliveryPricingMethod) || null,
          craftsman_available: booleanValue(body.craftsmanAvailable),
        },
      });
      if (result.error) throw new PortalError(result.error.message, 400);
      return NextResponse.json({ data: result.data });
    }

    if (action === "save_staff") {
      ownerOnly(context);
      const result = await context.userDb.rpc("upsert_my_merchant_staff_member", {
        p_email: value(body.email),
        p_role_label: value(body.roleLabel) || "manager",
        p_permissions: typeof body.permissions === "object" && body.permissions ? body.permissions : {},
        p_branch_ids: Array.isArray(body.branchIds) ? body.branchIds.map(uuid).filter(Boolean) : [],
      });
      if (result.error) throw new PortalError(result.error.message, 400);
      return NextResponse.json({ data: result.data });
    }

    if (action === "remove_staff") {
      ownerOnly(context);
      const result = await context.userDb.rpc("remove_my_merchant_staff_member", { p_staff_member_id: uuid(body.id) });
      if (result.error) throw new PortalError(result.error.message, 400);
      return NextResponse.json({ data: true });
    }

    if (action === "update_order") {
      if (!canManage(context, "orders")) throw new PortalError("order_permission_required", 403);
      const fulfillmentId = uuid(body.id);
      const nextStatus = value(body.status);
      if (!fulfillmentId || !["confirmed", "cancelled_by_merchant"].includes(nextStatus)) throw new PortalError("invalid_order_update");
      const current = await context.service
        .from("order_merchant_fulfillments")
        .select("*")
        .eq("id", fulfillmentId)
        .eq("merchant_id", context.merchantId)
        .maybeSingle();
      if (!current.data) throw new PortalError("order_not_found", 404);
      assertBranchAccess(context, current.data.branch_id ? String(current.data.branch_id) : null);
      if (!["pending_merchant_confirmation", "pending", "awaiting_confirmation", "confirmed"].includes(String(current.data.status ?? ""))) {
        throw new PortalError("order_status_not_editable");
      }
      const patch = nextStatus === "confirmed"
        ? { status: "confirmed", confirmed_at: new Date().toISOString(), merchant_cancel_reason: null, merchant_cancel_details: null, updated_at: new Date().toISOString() }
        : {
            status: "cancelled_by_merchant",
            merchant_cancel_reason: value(body.reason).slice(0, 100) || "other",
            merchant_cancel_details: value(body.details).slice(0, 1000) || value(body.reason).slice(0, 100) || "merchant_cancelled",
            updated_at: new Date().toISOString(),
          };
      const result = await context.service
        .from("order_merchant_fulfillments")
        .update(patch)
        .eq("id", fulfillmentId)
        .eq("merchant_id", context.merchantId)
        .select("*")
        .single();
      if (result.error) throw new PortalError(result.error.message, 400);
      await audit(context, nextStatus === "confirmed" ? "portal_confirm_order" : "portal_cancel_order", "order_merchant_fulfillments", fulfillmentId, current.data as Row, result.data as Row);
      return NextResponse.json({ data: result.data });
    }

    if (action === "submit_rfq") {
      if (!canManage(context, "requests")) throw new PortalError("request_permission_required", 403);
      const status = await accountStatus(context);
      if ((status as Row).can_receive_orders !== true) {
        throw new PortalError(value((status as Row).stop_reason) || "merchant_not_receiving_requests", 409);
      }
      const result = await context.userDb.rpc("submit_rfq_response", {
        p_rfq_request_id: uuid(body.requestId),
        p_item_responses: Array.isArray(body.itemResponses) ? body.itemResponses : [],
      });
      if (result.error) throw new PortalError(result.error.message, 400);
      return NextResponse.json({ data: result.data });
    }

    if (action === "save_working_hours") {
      if (!canManage(context, "hours")) throw new PortalError("hours_permission_required", 403);
      const hours = Array.isArray(body.hours) ? body.hours : [];
      if (hours.length !== 7) throw new PortalError("seven_working_days_required");
      const rowsToSave = hours.map((raw) => {
        const item = raw as Row;
        const day = Math.trunc(finiteNumber(item.dayOfWeek, -1));
        const isOpen = booleanValue(item.isOpen, false);
        const opensAt = value(item.opensAt) || null;
        const closesAt = value(item.closesAt) || null;
        if (day < 0 || day > 6) throw new PortalError("invalid_working_day");
        if (isOpen && (!opensAt || !closesAt)) throw new PortalError("working_time_required");
        return { merchant_id: context.merchantId, day_of_week: day, is_open: isOpen, opens_at: isOpen ? opensAt : null, closes_at: isOpen ? closesAt : null, updated_at: new Date().toISOString() };
      });
      const result = await context.service.from("merchant_working_hours").upsert(rowsToSave, { onConflict: "merchant_id,day_of_week" }).select("id,day_of_week,is_open,opens_at,closes_at");
      if (result.error) throw new PortalError(result.error.message, 400);
      await audit(context, "portal_save_working_hours", "merchant_working_hours", context.merchantId, null, { days: rowsToSave.length });
      return NextResponse.json({ data: result.data });
    }

    if (action === "save_delivery") {
      if (!canManage(context, "delivery")) throw new PortalError("delivery_permission_required", 403);
      const method = value(body.pricingMethod) || "flat";
      if (!["flat", "zone", "weight"].includes(method)) throw new PortalError("invalid_delivery_method");
      const pricingTable = body.pricingTable && typeof body.pricingTable === "object" ? body.pricingTable : {};
      const result = await context.userDb.rpc("configure_my_delivery", { p_is_enabled: booleanValue(body.isEnabled), p_pricing_method: method, p_pricing_table: pricingTable });
      if (result.error) throw new PortalError(result.error.message, 400);
      return NextResponse.json({ data: result.data });
    }

    if (action === "save_shipping_company") {
      if (!canManage(context, "delivery")) throw new PortalError("delivery_permission_required", 403);
      const result = await context.userDb.rpc("upsert_my_shipping_company", { p_company_id: uuid(body.id) || null, p_name: value(body.name), p_is_active: booleanValue(body.isActive, true) });
      if (result.error) throw new PortalError(result.error.message, 400);
      return NextResponse.json({ data: result.data });
    }

    if (action === "delete_shipping_company") {
      if (!canManage(context, "delivery")) throw new PortalError("delivery_permission_required", 403);
      const result = await context.userDb.rpc("delete_my_shipping_company", { p_company_id: uuid(body.id) });
      if (result.error) throw new PortalError(result.error.message, 400);
      return NextResponse.json({ data: result.data });
    }

    if (action === "save_shipping_batch") {
      if (!canManage(context, "delivery")) throw new PortalError("delivery_permission_required", 403);
      const result = await context.userDb.rpc("upsert_my_shipping_batch", { p_batch_id: uuid(body.id) || null, p_company_id: uuid(body.companyId), p_min_weight_kg: finiteNumber(body.minWeight), p_max_weight_kg: finiteNumber(body.maxWeight), p_price: finiteNumber(body.price) });
      if (result.error) throw new PortalError(result.error.message, 400);
      return NextResponse.json({ data: result.data });
    }

    if (action === "delete_shipping_batch") {
      if (!canManage(context, "delivery")) throw new PortalError("delivery_permission_required", 403);
      const result = await context.userDb.rpc("delete_my_shipping_batch", { p_batch_id: uuid(body.id) });
      if (result.error) throw new PortalError(result.error.message, 400);
      return NextResponse.json({ data: result.data });
    }

    if (action === "save_branch_availability") {
      if (!canManage(context, "products")) throw new PortalError("product_permission_required", 403);
      const branchId = uuid(body.branchId);
      assertBranchAccess(context, branchId);
      const unavailable = stringList(body.unavailableProductIds).map(uuid).filter(Boolean);
      const result = await context.userDb.rpc("set_branch_product_availability", { p_branch_id: branchId, p_unavailable_product_ids: unavailable });
      if (result.error) throw new PortalError(result.error.message, 400);
      return NextResponse.json({ data: true });
    }

    if (action === "send_support_message") {
      if (!canManage(context, "support")) throw new PortalError("support_permission_required", 403);
      const conversationId = uuid(body.conversationId);
      const message = value(body.message).slice(0, 4000);
      if (!conversationId || !message) throw new PortalError("message_required");
      const result = await context.userDb.rpc("send_support_message", { p_conversation_id: conversationId, p_body: message });
      if (result.error) throw new PortalError(result.error.message, 400);
      return NextResponse.json({ data: result.data });
    }

    if (action === "transfer_support") {
      if (!canManage(context, "support")) throw new PortalError("support_permission_required", 403);
      const result = await context.userDb.rpc("transfer_support_conversation", { p_conversation_id: uuid(body.conversationId), p_reason: value(body.reason) || "requested_by_merchant_portal" });
      if (result.error) throw new PortalError(result.error.message, 400);
      return NextResponse.json({ data: result.data });
    }

    if (action === "open_order_chat") {
      if (!canManage(context, "orders")) throw new PortalError("order_permission_required", 403);
      const orderId = uuid(body.orderId);
      const fulfillment = await context.service.from("order_merchant_fulfillments").select("branch_id,status,buyer_decision").eq("order_id", orderId).eq("merchant_id", context.merchantId).maybeSingle();
      if (!fulfillment.data) throw new PortalError("order_not_found", 404);
      assertBranchAccess(context, fulfillment.data.branch_id ? String(fulfillment.data.branch_id) : null);
      if (fulfillment.data.status !== "confirmed" && fulfillment.data.buyer_decision !== "accepted") throw new PortalError("chat_available_after_acceptance", 409);
      const conversation = await context.userDb.rpc("ensure_buyer_merchant_conversation", { p_order_id: orderId, p_merchant_id: context.merchantId });
      if (conversation.error) throw new PortalError(conversation.error.message, 400);
      const conversationId = String(conversation.data ?? "");
      const messages = await context.service.from("buyer_merchant_messages").select("id,conversation_id,sender_user_id,body,created_at,read_by_recipient_at,read_at").eq("conversation_id", conversationId).order("created_at");
      if (messages.error) throw new PortalError(messages.error.message, 400);
      await context.userDb.rpc("mark_buyer_merchant_conversation_read", { p_conversation_id: conversationId });
      return NextResponse.json({ data: { conversationId, messages: messages.data ?? [] } });
    }

    if (action === "send_order_chat_message") {
      if (!canManage(context, "orders")) throw new PortalError("order_permission_required", 403);
      const conversationId = uuid(body.conversationId);
      const message = value(body.message).slice(0, 4000);
      if (!message) throw new PortalError("message_required");
      const membership = await context.service.from("buyer_merchant_conversations").select("id,merchant_id,order_id").eq("id", conversationId).eq("merchant_id", context.merchantId).maybeSingle();
      if (!membership.data) throw new PortalError("conversation_not_found", 404);
      const fulfillment = await context.service.from("order_merchant_fulfillments").select("branch_id").eq("order_id", membership.data.order_id).eq("merchant_id", context.merchantId).limit(1).maybeSingle();
      assertBranchAccess(context, fulfillment.data?.branch_id ? String(fulfillment.data.branch_id) : null);
      const result = await context.userDb.rpc("send_buyer_merchant_message", { p_conversation_id: conversationId, p_body: message });
      if (result.error) throw new PortalError(result.error.message, 400);
      return NextResponse.json({ data: result.data });
    }

    if (action === "search_buyer_merchants") {
      if (!canManage(context, "buyer")) throw new PortalError("buyer_mode_permission_required", 403);
      const result = await context.userDb.rpc("buyer_storefront_merchants", {
        p_category_id: uuid(body.categoryId) || null,
        p_query: value(body.query).slice(0, 160) || null,
      });
      if (result.error) throw new PortalError(result.error.message, 400);
      return NextResponse.json({ data: await signBuyerMerchantRows(context, (result.data ?? []) as Row[]) });
    }

    if (action === "load_buyer_products") {
      if (!canManage(context, "buyer")) throw new PortalError("buyer_mode_permission_required", 403);
      const merchantId = uuid(body.merchantId);
      await visibleBuyerMerchant(context, merchantId);
      const result = await context.userDb.rpc("buyer_storefront_products", {
        p_merchant_id: merchantId,
        p_category_id: uuid(body.categoryId) || null,
        p_query: value(body.query).slice(0, 160) || null,
      });
      if (result.error) throw new PortalError(result.error.message, 400);
      return NextResponse.json({ data: await signBuyerProductRows(context, (result.data ?? []) as Row[]) });
    }

    if (action === "save_buyer_location") {
      if (!canManage(context, "buyer")) throw new PortalError("buyer_mode_permission_required", 403);
      const cityId = uuid(body.cityId);
      const city = await context.service.from("cities").select("id,name_ar,name_en,governorate_ar,governorate_en,country_ar,country_en,currency_code").eq("id", cityId).eq("is_active", true).maybeSingle();
      if (city.error || !city.data) throw new PortalError("city_not_found", 404);
      const result = await context.userDb.rpc("save_my_buyer_location", {
        p_location: {
          city_id: city.data.id,
          city: city.data.name_ar,
          city_ar: city.data.name_ar,
          city_en: city.data.name_en,
          governorate: city.data.governorate_ar,
          governorate_ar: city.data.governorate_ar,
          governorate_en: city.data.governorate_en,
          country: city.data.country_ar || city.data.country_en || "مصر",
          country_ar: city.data.country_ar || "مصر",
          country_en: city.data.country_en || "Egypt",
          currency_code: city.data.currency_code || context.currencyCode,
          latitude: body.latitude === "" || body.latitude === null || body.latitude === undefined ? null : finiteNumber(body.latitude),
          longitude: body.longitude === "" || body.longitude === null || body.longitude === undefined ? null : finiteNumber(body.longitude),
          source: "merchant_web_buyer_mode",
        },
      });
      if (result.error) throw new PortalError(result.error.message, 400);
      return NextResponse.json({ data: result.data });
    }

    if (action === "toggle_buyer_favorite") {
      if (!canManage(context, "buyer")) throw new PortalError("buyer_mode_permission_required", 403);
      const favoriteType = value(body.favoriteType);
      const targetId = uuid(body.targetId);
      if (!targetId || !["merchant", "product"].includes(favoriteType)) throw new PortalError("invalid_favorite_type");

      let targetMerchantId = targetId;
      if (favoriteType === "product") {
        const product = await context.service.from("products").select("id,merchant_id,is_active,is_available").eq("id", targetId).maybeSingle();
        if (product.error || !product.data || product.data.is_active !== true || product.data.is_available !== true) throw new PortalError("buyer_product_not_available", 404);
        targetMerchantId = value(product.data.merchant_id);
      }
      await visibleBuyerMerchant(context, targetMerchantId);

      const match = context.service.from("favorites").select("id").eq("buyer_id", context.user.id).eq("favorite_type", favoriteType);
      const existing = favoriteType === "merchant" ? await match.eq("merchant_id", targetId).maybeSingle() : await match.eq("product_id", targetId).maybeSingle();
      if (existing.data?.id) {
        if (favoriteType === "product") {
          await context.service.from("price_alerts").update({ is_active: false, cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("buyer_id", context.user.id).eq("favorite_id", existing.data.id).eq("is_active", true);
        }
        const removed = await context.service.from("favorites").delete().eq("id", existing.data.id).eq("buyer_id", context.user.id);
        if (removed.error) throw new PortalError(removed.error.message, 400);
        return NextResponse.json({ data: { active: false } });
      }
      const inserted = await context.service.from("favorites").insert({
        buyer_id: context.user.id,
        favorite_type: favoriteType,
        product_id: favoriteType === "product" ? targetId : null,
        merchant_id: favoriteType === "merchant" ? targetId : null,
      }).select("id").single();
      if (inserted.error) throw new PortalError(inserted.error.message, 400);
      return NextResponse.json({ data: { active: true, id: inserted.data.id } });
    }

    if (action === "toggle_buyer_price_alert") {
      if (!canManage(context, "buyer")) throw new PortalError("buyer_mode_permission_required", 403);
      const productId = uuid(body.productId);
      const product = await context.service.from("products").select("id,merchant_id,free_name,price,is_active,is_available").eq("id", productId).maybeSingle();
      if (product.error || !product.data || product.data.is_active !== true || product.data.is_available !== true) throw new PortalError("buyer_product_not_available", 404);
      await visibleBuyerMerchant(context, value(product.data.merchant_id));

      let favorite = await context.service.from("favorites").select("id,is_price_alert_enabled").eq("buyer_id", context.user.id).eq("favorite_type", "product").eq("product_id", productId).maybeSingle();
      if (favorite.error) throw new PortalError(favorite.error.message, 400);
      if (!favorite.data?.id) {
        favorite = await context.service.from("favorites").insert({ buyer_id: context.user.id, favorite_type: "product", product_id: productId, is_price_alert_enabled: false }).select("id,is_price_alert_enabled").single();
        if (favorite.error) throw new PortalError(favorite.error.message, 400);
      }
      const favoriteId = value(favorite.data?.id);
      const existing = await context.service.from("price_alerts").select("id").eq("buyer_id", context.user.id).eq("product_id", productId).eq("is_active", true).is("cancelled_at", null).maybeSingle();
      if (existing.error) throw new PortalError(existing.error.message, 400);
      if (existing.data?.id) {
        const stopped = await context.service.from("price_alerts").update({ is_active: false, cancelled_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", existing.data.id).eq("buyer_id", context.user.id);
        if (stopped.error) throw new PortalError(stopped.error.message, 400);
        await context.service.from("favorites").update({ is_price_alert_enabled: false, updated_at: new Date().toISOString() }).eq("id", favoriteId).eq("buyer_id", context.user.id);
        return NextResponse.json({ data: { active: false } });
      }
      const created = await context.service.from("price_alerts").insert({
        buyer_id: context.user.id,
        watched_product_text: value(product.data.free_name),
        favorite_id: favoriteId,
        product_id: productId,
        merchant_id: product.data.merchant_id,
        alert_type: "best_price",
        reference_price: product.data.price,
        last_known_price: product.data.price,
        last_valid_price: product.data.price,
        current_price: product.data.price,
        is_active: true,
        cancelled_at: null,
        last_price_status: "waiting",
      }).select("id").single();
      if (created.error) throw new PortalError(created.error.message, 400);
      await context.service.from("favorites").update({ is_price_alert_enabled: true, updated_at: new Date().toISOString() }).eq("id", favoriteId).eq("buyer_id", context.user.id);
      return NextResponse.json({ data: { active: true, id: created.data.id } });
    }

    if (action === "create_buyer_direct_request") {
      if (!canManage(context, "buyer")) throw new PortalError("buyer_mode_permission_required", 403);
      const merchantId = uuid(body.merchantId);
      await visibleBuyerMerchant(context, merchantId);
      const items = Array.isArray(body.items) ? body.items.slice(0, 50) : [];
      if (items.length === 0) throw new PortalError("quote_items_required");
      const location = body.location && typeof body.location === "object" ? body.location : {};
      const result = await context.userDb.rpc("create_my_direct_quote_request_web", {
        p_target_merchant_id: merchantId,
        p_target_branch_id: uuid(body.branchId) || null,
        p_items: items.map((raw) => {
          const item = raw as Row;
          return {
            name: value(item.name || item.requested_name).slice(0, 240),
            quantity: Math.max(0.0001, finiteNumber(item.quantity, 1)),
            unit: value(item.unit).slice(0, 80) || "قطعة",
            product_id: uuid(item.productId || item.product_id) || null,
            category_id: uuid(item.categoryId || item.category_id) || null,
            specifications: item.specifications && typeof item.specifications === "object" ? item.specifications : {},
          };
        }),
        p_location: location,
      });
      if (result.error) throw new PortalError(result.error.message, 400);
      return NextResponse.json({ data: result.data });
    }

    if (action === "mark_notification") {
      const notificationId = uuid(body.id);
      const result = await context.service
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("id", notificationId)
        .eq("user_id", context.user.id)
        .select("id")
        .maybeSingle();
      if (result.error) throw new PortalError(result.error.message, 400);
      return NextResponse.json({ data: result.data });
    }

    if (action === "mark_all_notifications") {
      const result = await context.service
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("user_id", context.user.id)
        .eq("is_read", false);
      if (result.error) throw new PortalError(result.error.message, 400);
      return NextResponse.json({ data: true });
    }

    if (action === "set_billing_preference") {
      ownerOnly(context);
      const preference = value(body.preference);
      if (!["monthly_subscription", "commission"].includes(preference)) throw new PortalError("billing_preference_invalid");
      const result = await context.service.rpc("portal_set_billing_preference_as", {
        p_user_id: context.user.id,
        p_preference: preference,
      });
      if (result.error) throw new PortalError(result.error.message, 400);
      return NextResponse.json({ data: result.data });
    }

    if (action === "create_manual_payment") {
      ownerOnly(context);
      const result = await context.service.rpc("portal_create_manual_subscription_payment_request_as", {
        p_user_id: context.user.id,
        p_plan_id: uuid(body.planId),
        p_manual_payment_method_id: uuid(body.methodId),
        p_contact_email: value(body.contactEmail),
        p_proof_storage_path: value(body.proofPath),
        p_transfer_reference: value(body.transferReference) || null,
        p_idempotency_key: value(body.idempotencyKey),
      });
      if (result.error) throw new PortalError(result.error.message, 400);
      return NextResponse.json({ data: result.data });
    }

    if (action === "save_preferences") {
      const language = body.language === "en" ? "en" : "ar";
      const theme = ["light", "dark", "system"].includes(value(body.theme)) ? value(body.theme) : "system";
      const result = await context.service.from("users").update({ preferred_language: language, theme, updated_at: new Date().toISOString() }).eq("id", context.user.id).select("id, preferred_language, theme").single();
      if (result.error) throw new PortalError(result.error.message, 400);
      return NextResponse.json({ data: result.data });
    }

    if (action === "delete_account") {
      const result = await context.userDb.rpc("request_account_deletion");
      if (result.error) throw new PortalError(result.error.message, 400);
      return NextResponse.json({ data: result.data });
    }

    throw new PortalError("unknown_action", 400);
  } catch (error) {
    return errorResponse(error);
  }
}
