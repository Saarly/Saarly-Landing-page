"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { portalPost } from "@/components/merchant/portal-client";
import { PortalPanel } from "@/components/merchant/portal-ui";
import { bool, rows, text } from "@/components/merchant/portal-utils";
import type { SectionProps } from "@/components/merchant/section-props";

const daysAr = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const daysEn = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const timeOptions = Array.from({ length: 48 }, (_, index) => {
  const hour = Math.floor(index / 2);
  const minute = index % 2 ? 30 : 0;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
});

export function HoursSection({ payload, locale, refresh, notify }: SectionProps) {
  const initial = useMemo(() => {
    const map = new Map(rows(payload.data.hours).map((item) => [Number(item.day_of_week), item]));
    return Array.from({ length: 7 }, (_, day) => {
      const source = map.get(day);
      const opensAt = text(source?.opens_at, "09:00").slice(0, 5);
      const closesAt = text(source?.closes_at, "22:00").slice(0, 5);
      return {
        dayOfWeek: day,
        isOpen: source ? bool(source.is_open) : day !== 5,
        opensAt: timeOptions.includes(opensAt) ? opensAt : "09:00",
        closesAt: timeOptions.includes(closesAt) ? closesAt : "22:00",
      };
    });
  }, [payload.data.hours]);
  const [items, setItems] = useState(initial);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await portalPost("save_working_hours", { hours: items });
      notify(locale === "ar" ? "تم حفظ مواعيد العمل." : "Working hours saved.", "success");
      await refresh();
    } catch (error) {
      notify(error instanceof Error ? error.message : "save_failed", "error");
    } finally {
      setSaving(false);
    }
  }

  return <PortalPanel
    title={locale === "ar" ? "مواعيد عمل المتجر" : "Store working hours"}
    subtitle={locale === "ar" ? "نفس أيام وساعات التطبيق، بنصف ساعة لكل اختيار. هذه المواعيد تتحكم أيضًا في استقبال إشعارات المتجر أثناء أوقات العمل." : "The same app schedule, in 30-minute increments. These hours also drive merchant notification quiet-hours behavior."}
  >
    <div className="hours-list">{items.map((item, index) => <article className="hour-row" key={item.dayOfWeek}>
      <label className="switch-row">
        <input type="checkbox" checked={item.isOpen} disabled={saving} onChange={(event) => setItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, isOpen: event.target.checked } : row))}/>
        <span><strong>{locale === "ar" ? daysAr[index] : daysEn[index]}</strong><small>{item.isOpen ? `${item.opensAt} — ${item.closesAt}` : (locale === "ar" ? "مغلق" : "Closed")}</small></span>
      </label>
      {item.isOpen ? <div className="time-pair">
        <label><span>{locale === "ar" ? "يفتح" : "Opens at"}</span><select value={item.opensAt} disabled={saving} onChange={(event) => setItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, opensAt: event.target.value } : row))}>{timeOptions.map((option) => <option value={option} key={option}>{option}</option>)}</select></label>
        <Icon name="arrow" size={16}/>
        <label><span>{locale === "ar" ? "يغلق" : "Closes at"}</span><select value={item.closesAt} disabled={saving} onChange={(event) => setItems((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, closesAt: event.target.value } : row))}>{timeOptions.map((option) => <option value={option} key={option}>{option}</option>)}</select></label>
      </div> : null}
    </article>)}</div>
    <div className="form-actions"><button className="button primary" disabled={saving} onClick={() => void save()}><Icon name="check" size={17}/>{saving ? (locale === "ar" ? "جارٍ الحفظ" : "Saving") : (locale === "ar" ? "حفظ المواعيد" : "Save hours")}</button></div>
  </PortalPanel>;
}
