"use client";

import { useEffect, useRef, useState } from "react";
import "leaflet/dist/leaflet.css";
import type { ExperienceStep } from "@/lib/types";

interface Point {
  lat: number;
  lon: number;
  label: string;
  index: number;
}

// Nominatim: 1 istek/sn nezaket kuralı — sıralı ve önbellekli geokodlama
async function geocode(query: string): Promise<[number, number] | null> {
  const cacheKey = `geo:${query}`;
  try {
    const cached = sessionStorage.getItem(cacheKey);
    if (cached) return JSON.parse(cached);
  } catch {}

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=tr&q=${encodeURIComponent(query)}`
    );
    const data = await res.json();
    const hit = data?.[0]
      ? ([parseFloat(data[0].lat), parseFloat(data[0].lon)] as [number, number])
      : null;
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify(hit));
    } catch {}
    return hit;
  } catch {
    return null;
  }
}

export default function RouteMap({
  steps,
  location,
}: {
  steps: ExperienceStep[];
  location: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [points, setPoints] = useState<Point[] | null>(null);

  // 1) Adımları geokodla
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const found: Point[] = [];
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        const query =
          step.place_query ||
          (location ? `${step.title}, ${location}, İstanbul` : null);
        if (!query) continue;
        const coords = await geocode(query);
        if (cancelled) return;
        if (coords) {
          found.push({ lat: coords[0], lon: coords[1], label: step.title, index: i + 1 });
        }
        await new Promise((r) => setTimeout(r, 400)); // Nominatim hız sınırı
      }
      if (!cancelled) setPoints(found);
    })();
    return () => {
      cancelled = true;
    };
  }, [steps, location]);

  // 2) Haritayı çiz
  useEffect(() => {
    if (!points || points.length === 0 || !containerRef.current) return;
    let map: import("leaflet").Map | null = null;

    (async () => {
      const L = (await import("leaflet")).default;
      if (!containerRef.current) return;

      map = L.map(containerRef.current, { scrollWheelZoom: false });
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OSM</a>',
      }).addTo(map);

      const latlngs: [number, number][] = points.map((p) => [p.lat, p.lon]);

      for (const p of points) {
        L.marker([p.lat, p.lon], {
          icon: L.divIcon({
            className: "",
            html: `<div style="width:26px;height:26px;border-radius:50%;background:#f0a860;color:#14111f;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px;border:2px solid #14111f;box-shadow:0 1px 4px rgba(0,0,0,.4)">${p.index}</div>`,
            iconSize: [26, 26],
            iconAnchor: [13, 13],
          }),
        })
          .addTo(map!)
          .bindPopup(`<b>${p.index}.</b> ${p.label}`);
      }

      if (latlngs.length > 1) {
        L.polyline(latlngs, {
          color: "#f0a860",
          weight: 3,
          dashArray: "2 10", // noktalı rota estetiği
        }).addTo(map);
      }

      map.fitBounds(L.latLngBounds(latlngs), { padding: [30, 30], maxZoom: 16 });
    })();

    return () => {
      map?.remove();
    };
  }, [points]);

  if (points === null) {
    return (
      <p className="mt-3 font-mono text-xs text-dusk-300">
        harita hazırlanıyor… (mekanlar konumlandırılıyor)
      </p>
    );
  }
  if (points.length === 0) {
    return (
      <p className="mt-3 font-mono text-xs text-dusk-300">
        Bu rotadaki adımlar haritada konumlandırılamadı.
      </p>
    );
  }

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={`Rota haritası: ${points.length} durak`}
      className="mt-4 h-64 w-full overflow-hidden rounded-xl border border-dusk-700"
    />
  );
}
