# Saarly Portal V2 — Parity Checklist

Status legend: **PASS** = active parity implemented, **WEB-ADAPTED** = same content/contract with a web-appropriate layout, **DISABLED-BY-SOURCE** = source app currently disables this feature, **BACKEND-LIMIT** = UI preserves the source data but current backend contract cannot persist/execute the additional field.

## Authentication
- PASS — email OTP sign-in.
- PASS — remember session/device.
- PASS — resend/change email behavior.
- PASS — profile completion.
- PASS — referral code carry-through.
- PASS — account type choice.
- PASS — merchant registration data/documents/review flow.
- WEB-ADAPTED — splash/onboarding/language are represented as website entry/auth UX rather than a literal mobile splash clone.

## Buyer
- PASS — core nav order Home → Requests → Favorites → Stores → Settings.
- PASS — mobile bottom dock keeps same five core destinations.
- PASS — Home core order: PriceMe → nearby ads → recent requests.
- PASS — manual quote.
- PASS — image/camera quote.
- PASS — PDF quote.
- PASS — voice recording quote.
- PASS — AI review before approval.
- PASS — city/governorate/country scope.
- PASS — offer sorting and details.
- PASS — quantity-aware offer acceptance + preview.
- PASS — uncovered-items RFQ.
- PASS — direct RFQ.
- PASS — RFQ shipping options/weight tiers/final cost.
- PASS — storefront search/categories/products/branches/badges.
- PASS — product/store favorites.
- PASS — product and free-text price alerts.
- PASS — per-store cart.
- PASS — cart review/delivery preview/free-delivery.
- PASS — create purchase order for physical goods.
- PASS — order history/status/contact/chat/review/cancel/delete.
- PASS — notifications read one/all.
- PASS — referrals progress/share/reward/status/banner.
- PASS — support chatbot/transfer/human chat/close/rate.
- PASS — profile/location/language/theme/legal/social/delete settings.
- DISABLED-BY-SOURCE — Buyer payment dashboard; portal API returns `buyer_payment_not_available` and no UI is rendered.

## Merchant — core order
- PASS — Overview.
- PASS — Orders.
- PASS — RFQ/custom pricing.
- PASS — Products when pricing mode is not `manual_quote`.
- PASS — Imports when pricing mode is not `manual_quote`.
- PASS — Hours.
- PASS — Delivery.
- PASS — Account status hidden for branch-scoped staff.
- PASS — Referrals.
- PASS — Branches.
- PASS — Settings.
- PASS — Support.
- DISABLED-BY-SOURCE — Merchant buyer mode. Flutter flag is false; active web nav and API block it. Legacy source remains preserved.

## Merchant overview
- PASS — product count.
- PASS — new requests.
- PASS — rating.
- PASS — total sales.
- PASS — confirmed orders.
- PASS — review count.
- PASS — top products/categories/low stock/stale product signals.

## Merchant orders
- PASS — All / Direct / Broadcast filter.
- PASS — confirm.
- PASS — cancel reasons out_of_stock / price_changed / other.
- PASS — optional buyer-facing explanation with fallback.
- PASS — deadline/countdown.
- PASS — buyer card/contact/chat according to backend state.

## Merchant RFQ
- PASS — All / Direct / Broadcast.
- PASS — approved/allowed branch required.
- PASS — every item answered priced/rejected.
- PASS — catalog product linking.
- PASS — stock, active, available and branch availability validation.
- PASS — outside-catalog pricing.
- PASS — line and total price display.

## Products
- PASS — category/name/price/unit/quantity validations.
- PASS — brand/size/color.
- PASS — available/active switches.
- PASS — image management.
- PASS — flat/zone/weight delivery method.
- PASS — weight validation.

## Imports
- PASS — 15-column `products` sheet.
- PASS — subcategories sheet.
- PASS — instructions sheet.
- PASS — valid/error row preview.
- PASS — malformed non-empty rows are preserved for correction.
- PASS — edit/add/delete row before import.
- BACKEND-LIMIT — current `import_my_products_web` approval stores core catalog fields but not all image/delivery/weight columns. Supabase was intentionally not changed.

## Hours
- PASS — seven days.
- PASS — open/closed.
- PASS — 30-minute times 00:00–23:30.
- PASS — open/close required for open days.

## Delivery
- PASS — on/off.
- PASS — flat/zone/weight.
- PASS — pricing config.
- PASS — weight shipping companies and tiers.
- PASS — primary branch free-delivery settings.

## Account status
- PASS — read-only mobile-equivalent status data from `my_monetization_dashboard`.
- PASS — receiving state, lifecycle, stop reason, founder/trial/status/grace dates.
- WEB-ADAPTED — owner has a link from account status to separate web-only Saarly subscription management.

## Referrals
- PASS — banner.
- PASS — code/link/share/copy.
- PASS — total accepted referrals.
- PASS — current target/progress/remaining.
- PASS — reward label.
- PASS — first-target note.
- PASS — latest reward status.

## Branches
- PASS — branch cards, image, status, location, manager phone.
- PASS — manager document statuses.
- PASS — commercial-register inheritance/independent path.
- PASS — unavailable product count.
- PASS — branch sales total + confirmed order count via `merchant_branch_sales_summary`.
- PASS — unassigned historical branch sales summary.
- PASS — inline craftsperson availability toggle.
- PASS — branch product availability modal via `set_branch_product_availability`.
- PASS — owner quick free-delivery modal via `set_my_branch_free_delivery`.
- PASS — add/edit/delete.
- PASS — GPS/current location + map preview.
- PASS — manager ID front/back uploads.
- PASS — storefront photo.
- PASS — rejected/review status presentation.

## Staff
- PASS — free-text role.
- PASS — default dashboard/orders/rfqs/support permissions.
- PASS — exact permission key set/order incl. `billing` label as Account status and legacy `buyer_mode` key.
- PASS — no invented notifications permission.
- PASS — all branches = empty array contract.
- PASS — selected branch scoping.

## Web-only subscriptions
- PASS — owner-only.
- PASS — plans from `subscription_plans`.
- PASS — discount snapshot rules from backend.
- PASS — manual methods from Admin-controlled table.
- PASS — method MIME/max-size enforcement.
- PASS — proof upload.
- PASS — `portal_create_manual_subscription_payment_request`.
- PASS — previous manual requests and transaction status.
- PASS — feature flag visibility/capability awareness.
- DISABLED-BY-SOURCE — electronic checkout button is not invented because no current checkout-session backend contract exists.

## Admin linkage
- PASS — plans/discounts/methods/gateway flags are read from shared Supabase controlled by Admin.
- PASS — no duplicated admin config store.
- PASS — merchant billing status remains shared backend state.

## Legacy
- PASS — old portal snapshot retained under `src/components/legacy-portals/`.
- PASS — no active TS/TSX runtime imports from that directory.
