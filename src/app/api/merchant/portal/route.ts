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

function objectValue(input: unknown): Row {
  return input && typeof input === "object" && !Array.isArray(input) ? input as Row : {};
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
  const { data, error } = await context.userDb.rpc("my_monetization_dashboard");
  if (error) {
    return {
      merchant_id: context.merchantId,
      access_status: context.merchant.approval_status === "approved" ? "pre_launch_access" : "suspended",
      can_receive_new_work: context.merchant.approval_status === "approved",
      can_receive_orders: context.merchant.approval_status === "approved",
      stop_reason: context.merchant.rejection_reason ?? null,
      pricing_mode: context.merchant.pricing_mode,
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
  const [products, requests, orders, branches, unread, status, report, growth] = await Promise.all([
    context.service.from("products").select("id", { count: "exact", head: true }).eq("merchant_id", context.merchantId).eq("is_active", true),
    context.userDb.rpc("my_merchant_rfq_requests"),
    ordersQuery,
    branchesQuery,
    context.service.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", context.user.id).eq("is_read", false),
    accountStatus(context),
    context.userDb.rpc("merchant_report_summary"),
    context.userDb.rpc("merchant_growth_report"),
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
    growth: growth.error ? {} : growth.data ?? {},
    recentNotifications: recentNotifications ?? [],
    staleProducts: staleProducts ?? [],
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
  const [settings, options, primaryBranch] = await Promise.all([
    context.service.from("delivery_settings").select("*").eq("merchant_id", context.merchantId).maybeSingle(),
    context.userDb.rpc("get_merchant_shipping_options", { p_merchant_id: context.merchantId }),
    context.service
      .from("branches")
      .select("id,name,is_primary,free_delivery_enabled,free_delivery_minimum")
      .eq("merchant_id", context.merchantId)
      .eq("is_primary", true)
      .maybeSingle(),
  ]);
  if (settings.error) throw new PortalError(settings.error.message, 400);
  if (primaryBranch.error) throw new PortalError(primaryBranch.error.message, 400);
  return {
    settings: settings.data ?? null,
    shipping: options.error ? {} : options.data ?? {},
    primaryBranch: primaryBranch.data ?? null,
    currencyCode: context.currencyCode,
  };
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
  const visibleReviews = reviewRows;
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
    context.userDb.rpc("my_referral_dashboard_for", { p_audience: "merchant" }),
    context.service.from("ads_banners").select("id,image_url,target_url,placement,is_active,is_ongoing,starts_at,ends_at").eq("placement", "merchant_referrals_top").eq("is_active", true).order("created_at", { ascending: false }).limit(10),
  ]);
  if (dashboard.error) throw new PortalError(dashboard.error.message, 400);
  return { dashboard: dashboard.data ?? {}, ads: ads.data ?? [] };
}

async function supportConversationBundle(context: MerchantContext, requestedId?: string) {
  let conversationId = uuid(requestedId);
  if (conversationId) {
    const ownership = await context.service.from("chat_conversations").select("id").eq("id", conversationId).eq("user_id", context.user.id).maybeSingle();
    if (ownership.error) throw new PortalError(ownership.error.message, 400);
    if (!ownership.data?.id) throw new PortalError("support_conversation_not_found", 404);
  } else {
    const start = await context.userDb.rpc("start_or_get_support_conversation", {
      p_title: context.profile.preferred_language === "en" ? "Merchant portal support" : "دعم بوابة المتجر",
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
      .eq("conversation_id", conversationId).order("created_at", { ascending: true }).limit(400),
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

async function loadSupport(context: MerchantContext) {
  return supportConversationBundle(context);
}

async function loadReviews(context: MerchantContext) {
  return { reviews: await scopedReviews(context, 300) };
}

function flagEnabled(flags: Row[], key: string) {
  return Boolean(flags.find((flag) => value(flag.key) === key)?.is_enabled);
}

function paymentProviderReady(setting: Row) {
  const metadata = objectValue(setting.metadata);
  return Boolean(setting.is_enabled)
    && Boolean(setting.is_connected)
    && value(setting.config_status) === "connected"
    && value(setting.secret_reference)
    && value(metadata.last_test_result) === "connection_succeeded";
}

async function loadSubscriptions(context: MerchantContext) {
  const [
    status,
    flagsResult,
    plansResult,
    discountsResult,
    discountPlansResult,
    discountMerchantsResult,
    methodsResult,
    requestsResult,
    transactionsResult,
    subscriptionsResult,
    settingsResult,
  ] = await Promise.all([
    accountStatus(context),
    context.service
      .from("feature_flags")
      .select("key,is_enabled,configuration,updated_at")
      .in("key", [
        "monetization_enabled",
        "manual_payments_enabled",
        "merchant_monthly_subscription_enabled",
        "merchant_can_choose_billing_model",
        "merchant_commission_enabled",
        "electronic_payments_enabled",
      ]),
    context.service
      .from("subscription_plans")
      .select("id,plan_code,name_ar,name_en,description_ar,description_en,monthly_price,old_price,currency,duration_days,billing_period_months,grace_months,features,features_ar,features_en,is_active,sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    context.service
      .from("subscription_discounts")
      .select("id,code,name_ar,name_en,description_ar,description_en,discount_percent,discount_amount,currency,applies_to,starts_at,ends_at,usage_limit,usage_count,is_active,priority,created_at")
      .eq("is_active", true)
      .limit(200),
    context.service
      .from("subscription_discount_plans")
      .select("discount_id,plan_id")
      .limit(1000),
    context.service
      .from("subscription_discount_merchants")
      .select("discount_id,merchant_id,max_uses,used_count")
      .limit(1000),
    context.service
      .from("manual_payment_methods")
      .select("id,code,name_ar,name_en,provider,account_label,account_number,account_holder_name,instructions_ar,instructions_en,allowed_mime_types,max_file_size_bytes,is_active,sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    context.service
      .from("manual_payment_requests")
      .select("id,merchant_id,plan_id,manual_payment_method_id,contact_email,transfer_reference,proof_storage_bucket,proof_storage_path,proof_mime_type,proof_size_bytes,status,rejection_reason,reviewed_at,original_amount,discount_percent,discount_amount,final_amount,currency,duration_days,plan_snapshot,price_snapshot,created_at,updated_at")
      .eq("merchant_id", context.merchantId)
      .order("created_at", { ascending: false })
      .limit(100),
    context.service
      .from("payment_transactions")
      .select("id,merchant_id,subscription_id,plan_id,provider,amount,currency,status,external_reference,purpose,payment_method,direct_to_merchant,paid_at,failed_at,cancelled_at,refunded_at,created_at,updated_at")
      .eq("merchant_id", context.merchantId)
      .in("purpose", ["subscription", "merchant_balance", "commission_settlement"])
      .order("created_at", { ascending: false })
      .limit(100),
    context.service
      .from("merchant_subscriptions")
      .select("id,merchant_id,plan_id,status,starts_at,ends_at,next_billing_at,billing_model,grace_months,balance_due,last_charged_at,suspended_at,blocked_from_new_work_at,suspension_reason,auto_renew,source_payment_request_id,price_snapshot,created_at,updated_at")
      .eq("merchant_id", context.merchantId)
      .order("updated_at", { ascending: false })
      .limit(100),
    context.service
      .from("payment_settings")
      .select("provider,is_enabled,is_connected,config_status,gateway_environment,display_name_ar,display_name_en,supported_currencies,supported_methods,metadata,secret_reference")
      .order("provider", { ascending: true }),
  ]);
  const error = flagsResult.error
    || plansResult.error
    || discountsResult.error
    || discountPlansResult.error
    || discountMerchantsResult.error
    || methodsResult.error
    || requestsResult.error
    || transactionsResult.error
    || subscriptionsResult.error
    || settingsResult.error;
  if (error) throw new PortalError(error.message || "subscriptions_load_failed", 400);
  const flags = (flagsResult.data ?? []) as Row[];
  const rawPlans = (plansResult.data ?? []) as Row[];
  const discounts = (discountsResult.data ?? []) as Row[];
  const discountPlanRows = (discountPlansResult.data ?? []) as Row[];
  const discountMerchantRows = (discountMerchantsResult.data ?? []) as Row[];
  const subscriptionRows = (subscriptionsResult.data ?? []) as Row[];
  const isRenewal = subscriptionRows.length > 0;
  const now = Date.now();

  const plansByDiscount = new Map<string, Set<string>>();
  for (const link of discountPlanRows) {
    const discountId = value(link.discount_id);
    const planId = value(link.plan_id);
    if (!discountId || !planId) continue;
    const set = plansByDiscount.get(discountId) ?? new Set<string>();
    set.add(planId);
    plansByDiscount.set(discountId, set);
  }
  const merchantsByDiscount = new Map<string, Set<string>>();
  for (const link of discountMerchantRows) {
    const discountId = value(link.discount_id);
    const merchantId = value(link.merchant_id);
    if (!discountId || !merchantId) continue;
    const set = merchantsByDiscount.get(discountId) ?? new Set<string>();
    set.add(merchantId);
    merchantsByDiscount.set(discountId, set);
  }

  function discountApplies(discount: Row, planId: string) {
    const id = value(discount.id);
    if (!id || !Boolean(discount.is_active)) return false;
    const startsAt = Date.parse(value(discount.starts_at));
    const endsAt = Date.parse(value(discount.ends_at));
    if (Number.isFinite(startsAt) && startsAt > now) return false;
    if (Number.isFinite(endsAt) && endsAt <= now) return false;
    const usageLimit = discount.usage_limit == null ? null : finiteNumber(discount.usage_limit, 0);
    if (usageLimit != null && finiteNumber(discount.usage_count, 0) >= usageLimit) return false;
    const appliesTo = value(discount.applies_to) || "both";
    if (appliesTo === "first_subscription" && isRenewal) return false;
    if (appliesTo === "renewal" && !isRenewal) return false;
    const planTargets = plansByDiscount.get(id);
    if (planTargets?.size && !planTargets.has(planId)) return false;
    const merchantTargets = merchantsByDiscount.get(id);
    if (merchantTargets?.size && !merchantTargets.has(context.merchantId)) return false;
    return true;
  }

  function bestDiscount(planId: string) {
    return discounts
      .filter((discount) => discountApplies(discount, planId))
      .sort((a, b) => {
        const priority = finiteNumber(b.priority, 0) - finiteNumber(a.priority, 0);
        if (priority) return priority;
        const percent = finiteNumber(b.discount_percent, 0) - finiteNumber(a.discount_percent, 0);
        if (percent) return percent;
        const amount = finiteNumber(b.discount_amount, 0) - finiteNumber(a.discount_amount, 0);
        if (amount) return amount;
        return Date.parse(value(a.created_at)) - Date.parse(value(b.created_at));
      })[0] ?? null;
  }

  const plans: Row[] = rawPlans.map((plan): Row => {
    const originalPrice = Math.max(0, finiteNumber(plan.monthly_price, 0));
    const discount = bestDiscount(value(plan.id));
    const percent = Math.min(100, Math.max(0, finiteNumber(discount?.discount_percent, 0)));
    const fixed = Math.max(0, finiteNumber(discount?.discount_amount, 0));
    const discountAmount = discount
      ? Math.min(originalPrice, percent > 0 ? Math.round(originalPrice * percent) / 100 : fixed)
      : 0;
    return {
      ...plan,
      effective_price: Math.max(0, originalPrice - discountAmount),
      discount_id: discount?.id ?? null,
      discount_name_ar: discount?.name_ar ?? null,
      discount_name_en: discount?.name_en ?? null,
      discount_description_ar: discount?.description_ar ?? null,
      discount_description_en: discount?.description_en ?? null,
      discount_percent: percent,
      discount_amount: discountAmount,
      discount_applies_to: discount?.applies_to ?? null,
      is_renewal_price: isRenewal,
    };
  });
  const planMap = new Map<string, Row>(plans.map((plan) => [value(plan.id), plan]));
  const manualRequests = await Promise.all(((requestsResult.data ?? []) as Row[]).map(async (request) => {
    const plan = planMap.get(value(request.plan_id)) ?? objectValue(request.plan_snapshot);
    return {
      ...request,
      plan_name_ar: plan.name_ar ?? null,
      plan_name_en: plan.name_en ?? null,
      proof_signed_url: await signedStorageUrl(context, "merchant-payment-proofs", request.proof_storage_path, 10 * 60),
    };
  }));
  const transactions = ((transactionsResult.data ?? []) as Row[]).map((transaction) => {
    const plan = planMap.get(value(transaction.plan_id));
    return {
      ...transaction,
      plan_name_ar: plan?.name_ar ?? null,
      plan_name_en: plan?.name_en ?? null,
    };
  });
  const subscriptions = subscriptionRows.map((subscription) => {
    const plan = planMap.get(value(subscription.plan_id));
    return {
      ...subscription,
      plan_name_ar: plan?.name_ar ?? null,
      plan_name_en: plan?.name_en ?? null,
    };
  });
  const paymentSettings = ((settingsResult.data ?? []) as Row[]).map((setting) => ({
    provider: setting.provider,
    is_enabled: setting.is_enabled,
    is_connected: setting.is_connected,
    config_status: setting.config_status,
    gateway_environment: setting.gateway_environment,
    display_name_ar: setting.display_name_ar,
    display_name_en: setting.display_name_en,
    supported_currencies: setting.supported_currencies,
    supported_methods: setting.supported_methods,
    ready: paymentProviderReady(setting),
  }));
  const monetizationEnabled = flagEnabled(flags, "monetization_enabled");
  const monthlySubscriptionEnabled = monetizationEnabled && flagEnabled(flags, "merchant_monthly_subscription_enabled");
  const electronicPaymentFeatureEnabled = monetizationEnabled && flagEnabled(flags, "electronic_payments_enabled");
  const electronicGatewayReady = electronicPaymentFeatureEnabled && paymentSettings.some((setting) => setting.ready === true);
  return {
    status,
    flags,
    plans,
    manualMethods: methodsResult.data ?? [],
    manualRequests,
    transactions,
    subscriptions,
    paymentSettings,
    invoices: [],
    capabilities: {
      monetizationEnabled,
      monthlySubscriptionEnabled,
      manualPaymentEnabled: monetizationEnabled && flagEnabled(flags, "manual_payments_enabled"),
      canChooseBillingModel: monetizationEnabled && flagEnabled(flags, "merchant_can_choose_billing_model"),
      commissionEnabled: monetizationEnabled && flagEnabled(flags, "merchant_commission_enabled"),
      electronicPaymentFeatureEnabled,
      electronicGatewayReady,
      electronicCheckoutAvailable: false,
      electronicPaymentEnabled: electronicGatewayReady,
      invoicesAvailable: false,
    },
  };
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
  if (section === "account-status") return { ...common, section, data: { status: await accountStatus(context) } };
  if (section === "subscriptions") return { ...common, section, data: await loadSubscriptions(context) };
  if (section === "store" || section === "settings") {
    const [merchantCategories, categories] = await Promise.all([
      context.service.from("merchant_categories").select("merchant_id, category_id, is_primary").eq("merchant_id", context.merchantId),
      context.service.from("categories").select("id, name_ar, name_en, slug, display_order").is("parent_id", null).eq("is_active", true).order("display_order"),
    ]);
    const { data: settingsAds } = await context.service
      .from("ads_banners")
      .select("id,image_url,target_url,placement,is_active,is_ongoing,starts_at,ends_at")
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
    const [requestResult, branchResult, productResult, availabilityResult] = await Promise.all([
      context.userDb.rpc("my_merchant_rfq_requests"),
      context.service.from("branches").select("id,name,approval_status").eq("merchant_id", context.merchantId).eq("approval_status", "approved").order("name"),
      context.service.from("products").select("id,free_name,price,unit,quantity,brand,size,color,is_active,is_available").eq("merchant_id", context.merchantId).eq("is_active", true).order("free_name").limit(1000),
      context.service.from("branch_product_availability").select("branch_id,product_id,is_available").eq("merchant_id", context.merchantId),
    ]);
    const error = requestResult.error || branchResult.error || productResult.error || availabilityResult.error;
    if (error) throw new PortalError(error.message, 400);
    const scope = allowedBranchIds(context);
    const branchRows = scope ? ((branchResult.data ?? []) as Row[]).filter((item) => scope.has(String(item.id ?? ""))) : (branchResult.data ?? []) as Row[];
    const availabilityRows = scope ? ((availabilityResult.data ?? []) as Row[]).filter((item) => scope.has(String(item.branch_id ?? ""))) : (availabilityResult.data ?? []) as Row[];
    return { ...common, section, data: { requests: requestResult.data ?? [], branches: branchRows, products: productResult.data ?? [], availability: availabilityRows, currencyCode: context.currencyCode } };
  }
  if (section === "orders") {
    const { data, error } = await context.service
      .from("order_merchant_fulfillments")
      .select("id, order_id, merchant_id, branch_id, status, subtotal_snapshot, confirmation_deadline, confirmed_at, merchant_cancel_reason, merchant_cancel_details, buyer_decision, buyer_decided_at, delivery_available_snapshot, delivery_pricing_method_snapshot, delivery_pricing_table_snapshot, created_at, updated_at, order:orders(id,offer_id,status,accepted_at,confirmation_deadline), items:order_fulfillment_items(id, requested_name_snapshot, matched_name_snapshot, quantity_snapshot, unit_snapshot, unit_price_snapshot, line_total_snapshot)")
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
    const offerIds = [...new Set(scopedOrders.map((item: Row) => value(objectValue(item.order).offer_id)).filter(Boolean))];
    const deliveryTypeByOffer = new Map<string, string>();
    if (offerIds.length) {
      const offers = await context.service.from("offers").select("id,quote_request_id").in("id", offerIds);
      if (!offers.error && (offers.data ?? []).length) {
        const quoteIds = [...new Set(((offers.data ?? []) as Row[]).map((item) => value(item.quote_request_id)).filter(Boolean))];
        if (quoteIds.length) {
          const quotes = await context.service.from("quote_requests").select("id,delivery_type").in("id", quoteIds);
          if (!quotes.error) {
            const quoteTypes = new Map(((quotes.data ?? []) as Row[]).map((item) => [value(item.id), value(item.delivery_type) || "broadcast"]));
            for (const offer of (offers.data ?? []) as Row[]) deliveryTypeByOffer.set(value(offer.id), quoteTypes.get(value(offer.quote_request_id)) ?? "broadcast");
          }
        }
      }
    }
    const enrichedOrders = scopedOrders.map((item: Row) => ({ ...item, delivery_type: deliveryTypeByOffer.get(value(objectValue(item.order).offer_id)) ?? "broadcast" }));
    return { ...common, section, data: { orders: enrichedOrders, buyers, currencyCode: context.currencyCode } };
  }
  if (section === "branches") {
    const [branches, cities, documents, products, availability, branchSales] = await Promise.all([
      context.service.from("branches").select("*").eq("merchant_id", context.merchantId).order("created_at", { ascending: false }),
      context.service.from("cities").select("id, name_ar, name_en, governorate_ar, governorate_en, country_ar, country_en").eq("is_active", true).order("display_order").limit(1000),
      context.service.from("merchant_documents").select("id, branch_id, manager_name, kind, status, rejection_reason, created_at").eq("merchant_id", context.merchantId).not("branch_id", "is", null).is("superseded_by", null),
      context.service.from("products").select("id,free_name,is_active,is_available,quantity,unit").eq("merchant_id", context.merchantId).eq("is_active", true).order("free_name").limit(1000),
      context.service.from("branch_product_availability").select("branch_id,product_id,is_available").eq("merchant_id", context.merchantId),
      context.userDb.rpc("merchant_branch_sales_summary"),
    ]);
    const scope = allowedBranchIds(context);
    const scopedBranchRows = scope ? ((branches.data ?? []) as Row[]).filter((item: Row) => scope.has(String(item.id))) : (branches.data ?? []) as Row[];
    const branchRows = await Promise.all(scopedBranchRows.map(async (item) => ({ ...item, front_signed_url: await signedStorageUrl(context, "storefront-photos", item.front_image_url, 6 * 60 * 60) })));
    const documentRows = scope ? ((documents.data ?? []) as Row[]).filter((item: Row) => scope.has(String(item.branch_id))) : documents.data ?? [];
    const availabilityRows = scope ? ((availability.data ?? []) as Row[]).filter((item: Row) => scope.has(String(item.branch_id))) : availability.data ?? [];
    const allSalesRows = branchSales.error ? [] : (branchSales.data ?? []) as Row[];
    const branchSalesRows = scope ? allSalesRows.filter((item: Row) => Boolean(item.branch_id) && scope.has(String(item.branch_id))) : allSalesRows.filter((item: Row) => Boolean(item.branch_id));
    const unassignedSales = scope ? null : allSalesRows.find((item: Row) => !item.branch_id) ?? null;
    return { ...common, section, data: { branches: branchRows, cities: cities.data ?? [], documents: documentRows, products: products.data ?? [], availability: availabilityRows, branchSales: branchSalesRows, unassignedSales } };
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
  if (section === "buyer") throw new PortalError("merchant_buyer_mode_disabled", 404);
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
  return { ...common, section: "overview", data: await overviewData(context) };
}

export async function GET(request: NextRequest) {
  try {
    const context = await requireMerchant(request);
    const section = value(request.nextUrl.searchParams.get("section")) || "overview";
    if (section === "buyer") throw new PortalError("merchant_buyer_mode_disabled", 404);
    if (section === "employees") ownerOnly(context);
    if (section === "store") ownerOnly(context);
    if (section === "subscriptions") ownerOnly(context);
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
    if (["search_buyer_merchants", "load_buyer_products", "save_buyer_location", "toggle_buyer_favorite", "toggle_buyer_price_alert", "create_buyer_direct_request"].includes(action)) {
      throw new PortalError("merchant_buyer_mode_disabled", 404);
    }

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
      const savedBranch = objectValue(result.data);
      const savedBranchId = uuid(body.id) || uuid(savedBranch.id) || uuid(result.data);
      if (savedBranchId) {
        const freeDeliveryEnabled = booleanValue(body.freeDeliveryEnabled);
        const freeDeliveryMinimum = freeDeliveryEnabled ? finiteNumber(body.freeDeliveryMinimum) : null;
        if (freeDeliveryEnabled && (!freeDeliveryMinimum || freeDeliveryMinimum <= 0)) throw new PortalError("free_delivery_minimum_required", 400);
        const freeDelivery = await context.userDb.rpc("set_my_branch_free_delivery", {
          p_branch_id: savedBranchId,
          p_enabled: freeDeliveryEnabled,
          p_minimum: freeDeliveryMinimum,
        });
        if (freeDelivery.error) throw new PortalError(freeDelivery.error.message, 400);
      }
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
      if (!payload.category_id) throw new PortalError("product_category_required");
      if (!payload.unit.trim()) throw new PortalError("product_unit_required");
      if (payload.price <= 0) throw new PortalError("product_price_must_be_positive");
      if (payload.quantity < 0) throw new PortalError("product_quantity_invalid");
      if (payload.image_urls.length === 0) throw new PortalError("product_image_required");
      if (payload.delivery_pricing_method === "weight" && (!payload.shipping_weight_kg || payload.shipping_weight_kg <= 0)) throw new PortalError("product_shipping_weight_required");
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
      const branchId = uuid(body.id) || null;
      const branchFrontPath = normalizeStoragePath("storefront-photos", body.frontImageUrl) || null;
      if (!value(body.name)) throw new PortalError("branch_name_required", 400);
      if (!uuid(body.cityId)) throw new PortalError("branch_city_required", 400);
      if (!value(body.managerName)) throw new PortalError("branch_manager_name_required", 400);
      if (!value(body.managerMobile)) throw new PortalError("branch_manager_mobile_required", 400);
      if (!branchFrontPath) throw new PortalError("branch_front_image_required", 400);
      if (!branchId && (!normalizeStoragePath("merchant-ids", body.managerIdFrontPath) || !normalizeStoragePath("merchant-ids", body.managerIdBackPath))) throw new PortalError("branch_manager_id_required", 400);
      const result = await context.userDb.rpc("save_my_merchant_branch_web", {
        p_payload: {
          id: branchId,
          name: value(body.name),
          city_id: uuid(body.cityId),
          latitude: finiteNumber(body.latitude),
          longitude: finiteNumber(body.longitude),
          manager_name: value(body.managerName),
          manager_mobile: value(body.managerMobile),
          front_image_url: branchFrontPath,
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
      const savedBranch = objectValue(result.data);
      const savedBranchId = branchId || uuid(savedBranch.id) || uuid(result.data);
      if (savedBranchId) {
        const freeDeliveryEnabled = booleanValue(body.freeDeliveryEnabled);
        const freeDeliveryMinimum = freeDeliveryEnabled ? finiteNumber(body.freeDeliveryMinimum) : null;
        if (freeDeliveryEnabled && (!freeDeliveryMinimum || freeDeliveryMinimum <= 0)) throw new PortalError("free_delivery_minimum_required", 400);
        const freeDelivery = await context.userDb.rpc("set_my_branch_free_delivery", {
          p_branch_id: savedBranchId,
          p_enabled: freeDeliveryEnabled,
          p_minimum: freeDeliveryMinimum,
        });
        if (freeDelivery.error) throw new PortalError(freeDelivery.error.message, 400);
      }
      return NextResponse.json({ data: result.data });
    }

    if (action === "set_branch_craftsman") {
      if (!canManage(context, "branches")) throw new PortalError("branch_permission_required", 403);
      const branchId = uuid(body.branchId);
      if (!branchId) throw new PortalError("branch_not_found", 404);
      assertBranchAccess(context, branchId);
      const before = await context.service.from("branches").select("id,craftsman_available").eq("merchant_id", context.merchantId).eq("id", branchId).maybeSingle();
      if (before.error) throw new PortalError(before.error.message, 400);
      if (!before.data?.id) throw new PortalError("branch_not_found", 404);
      const result = await context.service.from("branches").update({ craftsman_available: booleanValue(body.available), updated_at: new Date().toISOString() }).eq("merchant_id", context.merchantId).eq("id", branchId).select("id,craftsman_available").single();
      if (result.error) throw new PortalError(result.error.message, 400);
      await audit(context, "portal_set_branch_craftsman_availability", "branches", branchId, before.data as Row, result.data as Row);
      return NextResponse.json({ data: result.data });
    }

    if (action === "set_branch_free_delivery") {
      ownerOnly(context);
      const branchId = uuid(body.branchId);
      if (!branchId) throw new PortalError("branch_not_found", 404);
      const enabled = booleanValue(body.enabled);
      const minimum = enabled ? finiteNumber(body.minimum) : null;
      if (enabled && (!minimum || minimum <= 0)) throw new PortalError("free_delivery_minimum_required", 400);
      const branch = await context.service.from("branches").select("id").eq("merchant_id", context.merchantId).eq("id", branchId).maybeSingle();
      if (branch.error) throw new PortalError(branch.error.message, 400);
      if (!branch.data?.id) throw new PortalError("branch_not_found", 404);
      const result = await context.userDb.rpc("set_my_branch_free_delivery", { p_branch_id: branchId, p_enabled: enabled, p_minimum: minimum });
      if (result.error) throw new PortalError(result.error.message, 400);
      return NextResponse.json({ data: result.data });
    }

    if (action === "delete_branch") {
      ownerOnly(context);
      const branchId = uuid(body.id);
      if (!branchId) throw new PortalError("branch_not_found", 404);
      const before = await context.service
        .from("branches")
        .select("*")
        .eq("id", branchId)
        .eq("merchant_id", context.merchantId)
        .maybeSingle();
      if (before.error) throw new PortalError(before.error.message, 400);
      if (!before.data) throw new PortalError("branch_not_found", 404);
      const result = await context.service
        .from("branches")
        .delete()
        .eq("id", branchId)
        .eq("merchant_id", context.merchantId);
      if (result.error) throw new PortalError(result.error.message, 400);
      await audit(context, "portal_delete_branch", "branches", branchId, before.data as Row, null);
      return NextResponse.json({ data: true });
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
      if ((status as Row).can_receive_new_work !== true && (status as Row).can_receive_orders !== true) {
        throw new PortalError(value((status as Row).stop_reason) || "merchant_not_receiving_requests", 409);
      }
      const branchId = uuid(body.branchId);
      if (!branchId) throw new PortalError("rfq_response_branch_required", 400);
      assertBranchAccess(context, branchId);
      const branch = await context.service.from("branches").select("id,approval_status").eq("id", branchId).eq("merchant_id", context.merchantId).maybeSingle();
      if (branch.error || !branch.data?.id || branch.data.approval_status !== "approved") throw new PortalError("rfq_response_branch_not_available", 400);
      const result = await context.userDb.rpc("submit_rfq_response", {
        p_rfq_request_id: uuid(body.requestId),
        p_item_responses: Array.isArray(body.itemResponses) ? body.itemResponses : [],
        p_branch_id: branchId,
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

    if (action === "save_primary_branch_free_delivery") {
      if (!canManage(context, "delivery")) throw new PortalError("delivery_permission_required", 403);
      const branchId = uuid(body.branchId);
      if (!branchId) throw new PortalError("primary_branch_not_found", 404);
      const branch = await context.service
        .from("branches")
        .select("id,is_primary")
        .eq("id", branchId)
        .eq("merchant_id", context.merchantId)
        .eq("is_primary", true)
        .maybeSingle();
      if (branch.error) throw new PortalError(branch.error.message, 400);
      if (!branch.data?.id) throw new PortalError("primary_branch_not_found", 404);
      assertBranchAccess(context, branchId);
      const enabled = booleanValue(body.enabled);
      const minimum = enabled ? finiteNumber(body.minimum) : null;
      if (enabled && (!minimum || minimum <= 0)) throw new PortalError("free_delivery_minimum_required", 400);
      const result = await context.userDb.rpc("set_my_branch_free_delivery", {
        p_branch_id: branchId,
        p_enabled: enabled,
        p_minimum: minimum,
      });
      if (result.error) throw new PortalError(result.error.message, 400);
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
      if (!canManage(context, "products") && !canManage(context, "branches")) throw new PortalError("product_or_branch_permission_required", 403);
      const branchId = uuid(body.branchId);
      assertBranchAccess(context, branchId);
      const unavailable = stringList(body.unavailableProductIds).map(uuid).filter(Boolean);
      const result = await context.userDb.rpc("set_branch_product_availability", { p_branch_id: branchId, p_unavailable_product_ids: unavailable });
      if (result.error) throw new PortalError(result.error.message, 400);
      return NextResponse.json({ data: true });
    }

    if (action === "create_support_conversation") {
      if (!canManage(context, "support")) throw new PortalError("support_permission_required", 403);
      const title = value(body.title).slice(0, 160);
      if (title.length < 15) throw new PortalError("support_title_too_short");
      const result = await context.userDb.rpc("create_support_conversation", { p_title: title, p_locale: body.locale === "en" ? "en" : "ar" });
      if (result.error) throw new PortalError(result.error.message, 400);
      return NextResponse.json({ data: await supportConversationBundle(context, value(result.data)) });
    }

    if (action === "load_support_conversation") {
      if (!canManage(context, "support")) throw new PortalError("support_permission_required", 403);
      return NextResponse.json({ data: await supportConversationBundle(context, uuid(body.conversationId)) });
    }

    if (action === "send_support_message") {
      if (!canManage(context, "support")) throw new PortalError("support_permission_required", 403);
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
      if (!canManage(context, "support")) throw new PortalError("support_permission_required", 403);
      const conversationId = uuid(body.conversationId);
      const result = await context.userDb.rpc("transfer_support_conversation", { p_conversation_id: conversationId, p_reason: value(body.reason) || "requested_by_merchant_portal" });
      if (result.error) throw new PortalError(result.error.message, 400);
      return NextResponse.json({ data: await supportConversationBundle(context, conversationId) });
    }

    if (action === "close_support_conversation") {
      if (!canManage(context, "support")) throw new PortalError("support_permission_required", 403);
      const conversationId = uuid(body.conversationId);
      const result = await context.userDb.rpc("close_my_support_conversation", { p_conversation_id: conversationId });
      if (result.error) throw new PortalError(result.error.message, 400);
      return NextResponse.json({ data: await supportConversationBundle(context, conversationId) });
    }

    if (action === "rate_support_conversation") {
      if (!canManage(context, "support")) throw new PortalError("support_permission_required", 403);
      const conversationId = uuid(body.conversationId);
      const stars = Math.max(1, Math.min(5, Math.round(finiteNumber(body.stars, 5))));
      const sentiment = body.sentiment === "negative" ? "negative" : "positive";
      const comment = value(body.comment).slice(0, 1000) || null;
      const result = await context.userDb.rpc("submit_my_support_conversation_rating", { p_conversation_id: conversationId, p_stars: stars, p_sentiment: sentiment, p_comment: comment });
      if (result.error) throw new PortalError(result.error.message, 400);
      return NextResponse.json({ data: await supportConversationBundle(context, conversationId) });
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

    if (action === "set_billing_preference") {
      ownerOnly(context);
      const preference = value(body.preference);
      if (!["monthly_subscription", "commission"].includes(preference)) throw new PortalError("billing_preference_required", 400);
      const result = await context.userDb.rpc("portal_set_my_billing_preference", { p_preference: preference });
      if (result.error) throw new PortalError(result.error.message, 400);
      return NextResponse.json({ data: result.data });
    }

    if (action === "create_manual_subscription_payment_request") {
      ownerOnly(context);
      const planId = uuid(body.planId);
      const methodId = uuid(body.manualPaymentMethodId);
      const proofPath = normalizeStoragePath("merchant-payment-proofs", body.proofStoragePath);
      if (!planId) throw new PortalError("subscription_plan_required", 400);
      if (!methodId) throw new PortalError("manual_payment_method_required", 400);
      if (!proofPath) throw new PortalError("payment_proof_required", 400);
      const result = await context.userDb.rpc("portal_create_manual_subscription_payment_request", {
        p_plan_id: planId,
        p_manual_payment_method_id: methodId,
        p_contact_email: value(body.contactEmail) || value(context.user.email) || value(context.profile.primary_email),
        p_proof_storage_path: proofPath,
        p_transfer_reference: value(body.transferReference) || null,
        p_idempotency_key: value(body.idempotencyKey) || `merchant-web:${context.merchantId}:${planId}:${methodId}:${proofPath}`,
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
