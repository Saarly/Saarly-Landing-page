"use client";

import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { Icon } from "@/components/icons";
import { supabase } from "@/lib/supabase";

type ResolvedLocation = { city?: string; governorate?: string; country?: string };

const IMAGE_WIDTH = 960;
const IMAGE_HEIGHT = 480;

function numeric(input: string, fallback: number) {
  const value = Number(input);
  return Number.isFinite(value) ? value : fallback;
}

function lngToWorldX(lng: number, worldSize: number) { return ((lng + 180) / 360) * worldSize; }
function latToWorldY(lat: number, worldSize: number) {
  const safe = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const sin = Math.sin((safe * Math.PI) / 180);
  return (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * worldSize;
}
function worldXToLng(x: number, worldSize: number) { return (x / worldSize) * 360 - 180; }
function worldYToLat(y: number, worldSize: number) { return (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / worldSize))) * 180) / Math.PI; }

export function CoordinateMapPicker({
  latitude,
  longitude,
  locale,
  onChange,
}: {
  latitude: string;
  longitude: string;
  locale: "ar" | "en";
  onChange: (latitude: string, longitude: string, resolved?: ResolvedLocation) => void;
}) {
  const [apiKey, setApiKey] = useState("");
  const [zoom, setZoom] = useState(15);
  const [loadingKey, setLoadingKey] = useState(true);
  const [resolving, setResolving] = useState(false);
  const lat = numeric(latitude, 30.0444);
  const lng = numeric(longitude, 31.2357);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        if (!supabase) return;
        const { data, error } = await supabase.functions.invoke("tomtom-map-config");
        if (!error && active && data && typeof data === "object") {
          const key = String((data as { apiKey?: unknown }).apiKey ?? "").trim();
          if (key) setApiKey(key);
        }
      } catch { /* graceful fallback */ }
      finally { if (active) setLoadingKey(false); }
    }
    void load();
    return () => { active = false; };
  }, []);

  const imageUrl = useMemo(() => {
    if (!apiKey) return "";
    const params = new URLSearchParams({
      key: apiKey,
      zoom: String(zoom),
      center: `${lng},${lat}`,
      format: "png",
      layer: "basic",
      style: "main",
      width: String(IMAGE_WIDTH),
      height: String(IMAGE_HEIGHT),
      view: "Unified",
    });
    return `https://api.tomtom.com/map/1/staticimage?${params.toString()}`;
  }, [apiKey, lat, lng, zoom]);

  async function reverseGeocode(nextLat: number, nextLng: number) {
    if (!apiKey) return undefined;
    setResolving(true);
    try {
      const response = await fetch(`https://api.tomtom.com/search/2/reverseGeocode/${nextLat},${nextLng}.json?key=${encodeURIComponent(apiKey)}&language=${locale === "ar" ? "ar-EG" : "en-US"}`);
      if (!response.ok) return undefined;
      const data = await response.json() as { addresses?: Array<{ address?: Record<string, unknown> }> };
      const address = data.addresses?.[0]?.address ?? {};
      const clean = (input: unknown) => { const value = String(input ?? "").trim(); return value || undefined; };
      return {
        city: clean(address.municipalitySubdivision) ?? clean(address.municipality) ?? clean(address.localName),
        governorate: clean(address.countrySubdivisionName) ?? clean(address.countrySubdivision),
        country: clean(address.country),
      } satisfies ResolvedLocation;
    } catch { return undefined; }
    finally { setResolving(false); }
  }

  async function choose(event: MouseEvent<HTMLButtonElement>) {
    if (!imageUrl) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const px = (event.clientX - rect.left - rect.width / 2) * (IMAGE_WIDTH / rect.width);
    const py = (event.clientY - rect.top - rect.height / 2) * (IMAGE_HEIGHT / rect.height);
    const worldSize = 256 * 2 ** zoom;
    const x = lngToWorldX(lng, worldSize) + px;
    const y = latToWorldY(lat, worldSize) + py;
    const nextLng = Math.max(-180, Math.min(180, worldXToLng(x, worldSize)));
    const nextLat = Math.max(-85.05112878, Math.min(85.05112878, worldYToLat(y, worldSize)));
    const resolved = await reverseGeocode(nextLat, nextLng);
    onChange(nextLat.toFixed(6), nextLng.toFixed(6), resolved);
  }

  return <div className="coordinate-map-picker">
    <div className="coordinate-map-toolbar">
      <div><Icon name="location" size={17}/><span>{locale === "ar" ? "تحديد دقيق على الخريطة" : "Choose precisely on map"}</span>{resolving ? <small>{locale === "ar" ? "جارٍ تحديد المنطقة..." : "Resolving area..."}</small> : null}</div>
      <div className="inline-actions"><button className="icon-button" type="button" aria-label={locale === "ar" ? "تصغير الخريطة" : "Zoom out"} title={locale === "ar" ? "تصغير" : "Zoom out"} onClick={() => setZoom((current) => Math.max(5, current - 1))}>−</button><span className="map-zoom-value">{zoom}</span><button className="icon-button" type="button" aria-label={locale === "ar" ? "تكبير الخريطة" : "Zoom in"} title={locale === "ar" ? "تكبير" : "Zoom in"} onClick={() => setZoom((current) => Math.min(19, current + 1))}>+</button></div>
    </div>
    {imageUrl ? <button className="coordinate-map-canvas" type="button" onClick={(event) => void choose(event)} aria-label={locale === "ar" ? "اضغط على الخريطة لاختيار الموقع" : "Click the map to choose location"}><img src={imageUrl} alt={locale === "ar" ? "خريطة اختيار الموقع" : "Location picker map"}/><span className="coordinate-map-pin"><Icon name="location" size={28}/></span><small>{locale === "ar" ? "اضغط على المكان المطلوب، ثم احفظ." : "Click the desired point, then save."}</small></button> : <div className="coordinate-map-fallback"><Icon name="location" size={24}/><span>{loadingKey ? (locale === "ar" ? "جارٍ تحميل الخريطة..." : "Loading map...") : (locale === "ar" ? "تعذر تحميل الخريطة الآن. تقدر تستخدم الموقع الحالي أو تكتب الإحداثيات يدويًا." : "Map is unavailable right now. You can use current location or enter coordinates manually.")}</span></div>}
  </div>;
}
