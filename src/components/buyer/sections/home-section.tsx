"use client";

import Link from "next/link";
import { Icon } from "@/components/icons";
import { EmptyState, MetricCard, PortalPanel, StatusBadge } from "@/components/merchant/portal-ui";
import { PortalAdCarousel } from "@/components/portal-v2/ad-carousel";
import { buyerNotificationTarget, dateLabel, money, numberValue, row, rows, text } from "@/components/merchant/portal-utils";
import type { BuyerSectionProps } from "@/components/buyer/section-props";

export function BuyerHomeSection({ payload, locale }: BuyerSectionProps) {
  const data = payload.data;
  const counts = row(data.counts);
  const currency = payload.account.currencyCode || "EGP";
  const ads = rows(data.ads);
  const quotes = rows(data.quotes);
  const offers = rows(data.offers);
  const orders = rows(data.orders);
  const notifications = rows(data.recentNotifications);

  return <div className="portal-section-stack">
    <PortalPanel title={locale === "ar" ? "سعّرلي" : "Saarly"} subtitle={locale === "ar" ? "اكتب احتياجاتك واطّلع على أفضل عروض الأسعار." : "Write what you need and compare offers."}>
      <div className="buyer-quick-actions"><Link className="quick-action-card" href="/buyer/requests?new=manual"><Icon name="quote"/><strong>{locale === "ar" ? "طلب يدوي" : "Manual request"}</strong><span>{locale === "ar" ? "اكتب المنتجات والكميات" : "Enter items and quantities"}</span></Link><Link className="quick-action-card" href="/buyer/requests?new=image"><Icon name="upload"/><strong>{locale === "ar" ? "صورة قائمة" : "List image"}</strong><span>{locale === "ar" ? "ارفع صورة وسيتم تحليلها" : "Upload and analyze an image"}</span></Link><Link className="quick-action-card" href="/buyer/requests?new=pdf"><Icon name="receipt"/><strong>PDF</strong><span>{locale === "ar" ? "فاتورة أو ملف منتجات" : "Invoice or product file"}</span></Link><Link className="quick-action-card" href="/buyer/requests?new=voice"><Icon name="microphone"/><strong>{locale === "ar" ? "تسجيل صوتي" : "Voice request"}</strong><span>{locale === "ar" ? "سجّل أو ارفع صوتًا" : "Record or upload audio"}</span></Link></div>
    </PortalPanel>

    <PortalPanel title={locale === "ar" ? "إعلانات قريبة" : "Nearby ads"} subtitle={locale === "ar" ? "الإعلانات المطابقة لموقعك وإعدادات الإدارة الحالية." : "Ads matched to your location and current admin configuration."}>
      {ads.length ? <PortalAdCarousel ads={ads} locale={locale} fit="cover"/> : <EmptyState icon="bell" title={locale === "ar" ? "لا توجد إعلانات قريبة الآن" : "No nearby ads right now"} body={locale === "ar" ? "ستظهر هنا الإعلانات النشطة المناسبة لموقعك." : "Active ads relevant to your location will appear here."}/>} 
    </PortalPanel>

    <PortalPanel title={locale === "ar" ? "آخر الطلبات" : "Recent requests"} action={<Link className="button secondary compact" href="/buyer/requests">{locale === "ar" ? "كل الطلبات" : "All requests"}</Link>}>
      {quotes.length ? <div className="detail-list compact">{quotes.slice(0, 8).map((quote) => <Link href={`/buyer/requests?focus=${text(quote.id)}`} data-record-id={text(quote.id)} key={text(quote.id)}><div><strong>{locale === "ar" ? `طلب ${text(quote.id).slice(0, 8)}` : `Request ${text(quote.id).slice(0, 8)}`}</strong><small>{dateLabel(quote.created_at, locale)}</small></div><StatusBadge value={quote.ai_review_status || quote.status} locale={locale}/></Link>)}</div> : <EmptyState icon="quote" title={locale === "ar" ? "لسه مفيش طلبات" : "No requests yet"} body={locale === "ar" ? "ابدأ أول طلب تسعير من الطرق اللي فوق." : "Start your first quote request using the options above."}/>} 
    </PortalPanel>

    <div className="metrics-grid">
      <MetricCard icon="quote" label={locale === "ar" ? "طلبات التسعير" : "Quote requests"} value={numberValue(counts.quotes)} note={locale === "ar" ? "كل الطلبات المحفوظة" : "All saved requests"}/>
      <MetricCard icon="compare" label={locale === "ar" ? "العروض الجاهزة" : "Ready offers"} value={numberValue(counts.offers)} tone="blue"/>
      <MetricCard icon="receipt" label={locale === "ar" ? "الطلبات المقبولة" : "Accepted orders"} value={numberValue(counts.orders)} tone="gold"/>
      <MetricCard icon="target" label={locale === "ar" ? "المفضلة" : "Favorites"} value={numberValue(counts.favorites)} tone="gray"/>
    </div>

    <div className="portal-two-columns">
      <PortalPanel title={locale === "ar" ? "أحدث العروض" : "Latest offers"} action={<Link className="button secondary compact" href="/buyer/requests">{locale === "ar" ? "المقارنة" : "Compare"}</Link>}>
        {offers.length ? <div className="detail-list compact">{offers.slice(0, 6).map((offer) => <Link href={`/buyer/requests?focus=${text(offer.quote_request_id || offer.id)}`} key={`offer-${text(offer.id)}`}><div><strong>{text(offer.store_name, locale === "ar" ? "عرض متجر" : "Store offer")}</strong><small>{money(offer.total_price_snapshot, currency, locale)}</small></div><StatusBadge value={offer.status} locale={locale}/></Link>)}</div> : <EmptyState icon="compare" title={locale === "ar" ? "لا توجد عروض جاهزة" : "No ready offers"} body={locale === "ar" ? "العروض هتظهر بعد معالجة طلبات التسعير." : "Offers will appear after quote requests are processed."}/>} 
      </PortalPanel>
      <PortalPanel title={locale === "ar" ? "آخر الطلبات المقبولة" : "Latest accepted orders"} action={<Link className="button secondary compact" href="/buyer/orders">{locale === "ar" ? "متابعة الطلبات" : "Track orders"}</Link>}>
        {orders.length ? <div className="detail-list compact">{orders.slice(0, 6).map((order) => <Link href={`/buyer/orders?focus=${text(order.id)}`} data-record-id={text(order.id)} key={text(order.id)}><div><strong>{locale === "ar" ? `طلب #${text(order.id).slice(0, 8)}` : `Order #${text(order.id).slice(0, 8)}`}</strong><small>{dateLabel(order.accepted_at || order.created_at, locale)}</small></div><StatusBadge value={order.status} locale={locale}/></Link>)}</div> : <EmptyState icon="receipt" title={locale === "ar" ? "مفيش طلبات مقبولة" : "No accepted orders"} body={locale === "ar" ? "بعد ما توافق على عرض هتلاقي الطلب هنا." : "Accepted offers will appear here as orders."}/>} 
      </PortalPanel>
    </div>

    <PortalPanel title={locale === "ar" ? "أحدث الإشعارات" : "Latest notifications"} action={<Link className="button secondary compact" href="/buyer/notifications">{locale === "ar" ? "كل الإشعارات" : "All notifications"}</Link>}>
      {notifications.length ? <div className="notification-mini-list">{notifications.map((item) => <Link key={text(item.id)} href={buyerNotificationTarget(item.deep_link, item.payload)} className={item.is_read === true ? "" : "unread"}><Icon name="bell"/><div><strong>{locale === "ar" ? text(item.title_ar) : text(item.title_en)}</strong><p>{locale === "ar" ? text(item.body_ar) : text(item.body_en)}</p></div><small>{dateLabel(item.created_at, locale)}</small></Link>)}</div> : <EmptyState icon="bell" title={locale === "ar" ? "مفيش إشعارات جديدة" : "No new notifications"} body={locale === "ar" ? "الإشعارات المهمة هتظهر هنا." : "Important updates will appear here."}/>} 
    </PortalPanel>
  </div>;
}
