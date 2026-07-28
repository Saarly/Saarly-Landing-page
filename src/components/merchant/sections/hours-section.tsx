"use client";
import { useMemo, useState } from "react";
import { portalPost } from "@/components/merchant/portal-client";
import { PortalPanel } from "@/components/merchant/portal-ui";
import { bool, rows, text } from "@/components/merchant/portal-utils";
import type { SectionProps } from "@/components/merchant/section-props";
const daysAr=["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
const daysEn=["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
export function HoursSection({payload,locale,refresh,notify}:SectionProps){
 const initial=useMemo(()=>{const map=new Map(rows(payload.data.hours).map(x=>[Number(x.day_of_week),x]));return Array.from({length:7},(_,day)=>{const r=map.get(day);return{dayOfWeek:day,isOpen:r?bool(r.is_open):day!==5,opensAt:text(r?.opens_at,"09:00").slice(0,5),closesAt:text(r?.closes_at,"22:00").slice(0,5)}})},[payload.data.hours]);
 const [items,setItems]=useState(initial);const[saving,setSaving]=useState(false);
 async function save(){setSaving(true);try{await portalPost("save_working_hours",{hours:items});notify(locale==="ar"?"تم حفظ مواعيد العمل.":"Working hours saved.","success");await refresh()}catch(e){notify(e instanceof Error?e.message:"save_failed","error")}finally{setSaving(false)}}
 return <PortalPanel title={locale==="ar"?"مواعيد عمل المتجر":"Store working hours"} subtitle={locale==="ar"?"حدد الأيام المفتوحة ومواعيد البداية والنهاية. تظهر نفس المواعيد في التطبيق والموقع.":"Set open days and opening/closing times. The same schedule appears in the app and website."}>
 <div className="hours-list">{items.map((item,index)=><article className="hour-row" key={item.dayOfWeek}><label className="switch-row"><input type="checkbox" checked={item.isOpen} onChange={e=>setItems(v=>v.map((x,i)=>i===index?{...x,isOpen:e.target.checked}:x))}/><span><strong>{locale==="ar"?daysAr[index]:daysEn[index]}</strong><small>{item.isOpen?(locale==="ar"?"المتجر مفتوح":"Store is open"):(locale==="ar"?"إجازة":"Closed")}</small></span></label><div className="time-pair"><input type="time" disabled={!item.isOpen} value={item.opensAt} onChange={e=>setItems(v=>v.map((x,i)=>i===index?{...x,opensAt:e.target.value}:x))}/><span>—</span><input type="time" disabled={!item.isOpen} value={item.closesAt} onChange={e=>setItems(v=>v.map((x,i)=>i===index?{...x,closesAt:e.target.value}:x))}/></div></article>)}</div>
 <div className="form-actions"><button className="button primary" disabled={saving} onClick={()=>void save()}>{saving?(locale==="ar"?"جارٍ الحفظ":"Saving"):(locale==="ar"?"حفظ المواعيد":"Save hours")}</button></div></PortalPanel>}
