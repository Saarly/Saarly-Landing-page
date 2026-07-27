import { NextRequest, NextResponse } from "next/server";
import { canManage, ownerOnly, PortalError, requireMerchant, type MerchantContext, type Row } from "@/lib/merchant-auth";

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
  const [products, requests, orders, branches, unread, status] = await Promise.all([
    context.service.from("products").select("id", { count: "exact", head: true }).eq("merchant_id", context.merchantId).eq("is_active", true),
    context.userDb.rpc("my_merchant_rfq_requests"),
    context.service.from("order_merchant_fulfillments").select("id", { count: "exact", head: true }).eq("merchant_id", context.merchantId),
    context.service.from("branches").select("id", { count: "exact", head: true }).eq("merchant_id", context.merchantId),
    context.service.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", context.user.id).eq("is_read", false),
    accountStatus(context),
  ]);
  const { data: recentNotifications } = await context.service
    .from("notifications")
    .select("id, type, title_ar, title_en, body_ar, body_en, is_read, created_at, deep_link")
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
    recentNotifications: recentNotifications ?? [],
    staleProducts: staleProducts ?? [],
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
  };
}

async function loadSection(context: MerchantContext, section: string) {
  const common = {
    account: {
      userId: context.user.id,
      email: context.user.email ?? context.profile.primary_email ?? "",
      profile: context.profile,
      merchant: context.merchant,
      merchantId: context.merchantId,
      isOwner: context.isOwner,
      staff: context.staff,
    },
  };

  if (section === "overview") return { ...common, section, data: await overviewData(context) };
  if (section === "store" || section === "settings") {
    const [merchantCategories, categories] = await Promise.all([
      context.service.from("merchant_categories").select("merchant_id, category_id, is_primary").eq("merchant_id", context.merchantId),
      context.service.from("categories").select("id, name_ar, name_en, slug, display_order").is("parent_id", null).eq("is_active", true).order("display_order"),
    ]);
    return { ...common, section, data: { merchantCategories: merchantCategories.data ?? [], categories: categories.data ?? [], status: await accountStatus(context) } };
  }
  if (section === "products") {
    const [products, categories] = await Promise.all([
      context.service.from("products").select("id, category_id, free_name, price, unit, quantity, brand, size, color, image_url, is_active, is_available, price_quantity_updated_at, shipping_type, weight_in_kg").eq("merchant_id", context.merchantId).order("updated_at", { ascending: false }).limit(500),
      context.service.from("categories").select("id, name_ar, name_en, parent_id, slug").eq("is_active", true).order("display_order"),
    ]);
    return { ...common, section, data: { products: products.data ?? [], categories: categories.data ?? [] } };
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
    const orderIds = ((data ?? []) as Row[]).map((item: Row) => String(item.order_id ?? "")).filter(Boolean);
    let buyers: Row[] = [];
    if (orderIds.length > 0) {
      const buyerResult = await context.service.rpc("merchant_order_buyer_cards", { p_order_ids: orderIds });
      if (!buyerResult.error && Array.isArray(buyerResult.data)) buyers = buyerResult.data as Row[];
    }
    return { ...common, section, data: { orders: data ?? [], buyers } };
  }
  if (section === "branches") {
    const [branches, cities, documents] = await Promise.all([
      context.service.from("branches").select("*").eq("merchant_id", context.merchantId).order("created_at", { ascending: false }),
      context.service.from("cities").select("id, name_ar, name_en, governorate_ar, governorate_en, country_ar, country_en").eq("is_active", true).order("display_order").limit(1000),
      context.service.from("merchant_documents").select("id, branch_id, kind, status, rejection_reason, created_at").eq("merchant_id", context.merchantId).not("branch_id", "is", null).is("superseded_by", null),
    ]);
    return { ...common, section, data: { branches: branches.data ?? [], cities: cities.data ?? [], documents: documents.data ?? [] } };
  }
  if (section === "employees") {
    const { data, error } = await context.userDb.rpc("my_merchant_staff_members");
    if (error) throw new PortalError(error.message, 400);
    const { data: branches } = await context.service.from("branches").select("id, name").eq("merchant_id", context.merchantId).order("name");
    return { ...common, section, data: { employees: data ?? [], branches: branches ?? [] } };
  }
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
    const freelyVisible = new Set(["store", "notifications"]);
    if (!context.isOwner && !freelyVisible.has(section) && !canManage(context, section)) {
      throw new PortalError("section_permission_required", 403);
    }
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
      const { data, error } = await context.service.rpc("portal_update_merchant_profile_as", {
        p_user_id: context.user.id,
        p_store_name: value(body.storeName),
        p_manager_name: value(body.managerName),
        p_manager_mobile: value(body.managerMobile),
        p_contact_mobile: value(body.contactMobile),
        p_craftsman_available: booleanValue(body.craftsmanAvailable),
      });
      if (error) throw new PortalError(error.message, 400);
      const categoryIds = Array.isArray(body.categoryIds) ? body.categoryIds.map(uuid).filter(Boolean) : [];
      if (categoryIds.length > 0) {
        const result = await context.service.rpc("portal_set_merchant_categories_as", {
          p_user_id: context.user.id,
          p_category_ids: categoryIds,
        });
        if (result.error) throw new PortalError(result.error.message, 400);
      }
      return NextResponse.json({ data });
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
        image_url: value(body.imageUrl).slice(0, 1000) || null,
        image_urls: value(body.imageUrl) ? [value(body.imageUrl).slice(0, 1000)] : [],
        is_active: booleanValue(body.isActive, true),
        is_available: booleanValue(body.isAvailable, true),
        shipping_type: value(body.shippingType) || "merchant_delivery",
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
      if (!canManage(context, "products")) throw new PortalError("product_permission_required", 403);
      const items = Array.isArray(body.items) ? body.items.slice(0, 500) : [];
      if (items.length === 0) throw new PortalError("import_rows_required");
      const rows = items.map((raw) => {
        const item = raw as Row;
        const name = value(item.name).slice(0, 240);
        if (name.length < 2) throw new PortalError("invalid_import_product_name");
        return {
          merchant_id: context.merchantId,
          category_id: uuid(item.categoryId) || null,
          free_name: name,
          price: Math.max(0, finiteNumber(item.price)),
          unit: value(item.unit).slice(0, 80) || "قطعة",
          quantity: Math.max(0, finiteNumber(item.quantity)),
          brand: value(item.brand).slice(0, 160) || null,
          size: value(item.size).slice(0, 120) || null,
          color: value(item.color).slice(0, 120) || null,
          is_active: true,
          is_available: true,
          image_urls: [],
          shipping_type: "merchant_delivery",
          price_quantity_updated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      });
      const result = await context.service.from("products").insert(rows).select("id");
      if (result.error) throw new PortalError(result.error.message, 400);
      await audit(context, "portal_import_products", "products", context.merchantId, null, { count: rows.length });
      return NextResponse.json({ data: { imported: result.data?.length ?? rows.length } });
    }

    if (action === "save_branch") {
      if (!canManage(context, "branches")) throw new PortalError("branch_permission_required", 403);
      const branchId = uuid(body.id);
      const cityId = uuid(body.cityId);
      if (!cityId) throw new PortalError("city_required");
      const cityResult = await context.service.from("cities").select("id, name_ar, governorate_ar").eq("id", cityId).eq("is_active", true).maybeSingle();
      if (!cityResult.data) throw new PortalError("city_not_found");
      const payload = {
        merchant_id: context.merchantId,
        name: value(body.name).slice(0, 200),
        latitude: finiteNumber(body.latitude),
        longitude: finiteNumber(body.longitude),
        city_id: cityId,
        city_name: cityResult.data.name_ar,
        governorate_name: cityResult.data.governorate_ar,
        manager_mobile: value(body.managerMobile).slice(0, 50),
        front_image_url: value(body.frontImageUrl).slice(0, 1000) || null,
        delivery_enabled: booleanValue(body.deliveryEnabled),
        delivery_pricing_method: value(body.deliveryPricingMethod) || null,
        craftsman_available: booleanValue(body.craftsmanAvailable),
        uses_parent_commercial_register: booleanValue(body.usesParentCommercialRegister, true),
        updated_at: new Date().toISOString(),
      };
      if (payload.name.length < 2 || payload.manager_mobile.length < 7) throw new PortalError("branch_data_incomplete");
      let before: Row | null = null;
      let result;
      if (branchId) {
        const current = await context.service.from("branches").select("*").eq("id", branchId).eq("merchant_id", context.merchantId).maybeSingle();
        if (!current.data) throw new PortalError("branch_not_found", 404);
        before = current.data as Row;
        result = await context.service.from("branches").update(payload).eq("id", branchId).eq("merchant_id", context.merchantId).select("*").single();
      } else {
        result = await context.service.from("branches").insert({ ...payload, approval_status: "pending", rejection_reason: null }).select("*").single();
      }
      if (result.error) throw new PortalError(result.error.message, 400);
      const savedId = String(result.data.id);
      const frontPath = value(body.managerIdFrontPath);
      const backPath = value(body.managerIdBackPath);
      if (frontPath || backPath) {
        if (!frontPath || !backPath) throw new PortalError("both_manager_id_sides_required");
        const docResult = await context.userDb.rpc("upsert_my_branch_manager_documents", {
          p_branch_id: savedId,
          p_manager_name: value(body.managerName),
          p_front_storage_path: frontPath,
          p_back_storage_path: backPath,
        });
        if (docResult.error) throw new PortalError(docResult.error.message, 400);
      }
      const commercialRegisterPath = value(body.commercialRegisterPath);
      const usesParentRegister = booleanValue(body.usesParentCommercialRegister, true);
      if (!usesParentRegister && commercialRegisterPath) {
        const currentDoc = await context.service.from("merchant_documents").select("id").eq("merchant_id", context.merchantId).eq("branch_id", savedId).eq("kind", "commercial_register").is("superseded_by", null).order("created_at", { ascending: false }).limit(1).maybeSingle();
        const inserted = await context.service.from("merchant_documents").insert({
          merchant_id: context.merchantId, branch_id: savedId, kind: "commercial_register", storage_bucket: "commercial-registers",
          storage_path: commercialRegisterPath, status: "pending", manager_name: value(body.managerName) || null,
          metadata: { source: "merchant_portal", legal_entity: "separate_branch" },
        }).select("id").single();
        if (inserted.error) throw new PortalError(inserted.error.message, 400);
        if (currentDoc.data?.id) await context.service.from("merchant_documents").update({ superseded_by: inserted.data.id, updated_at: new Date().toISOString() }).eq("id", currentDoc.data.id);
      }
      await audit(context, branchId ? "portal_update_branch" : "portal_create_branch", "branches", savedId, before, result.data as Row);
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
      if (!["pending_merchant_confirmation", "pending", "confirmed"].includes(String(current.data.status ?? ""))) {
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
