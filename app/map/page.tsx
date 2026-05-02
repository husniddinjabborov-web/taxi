"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export default function MapPage() {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const circleRef = useRef<any>(null);
  const watchIdRef = useRef<number | null>(null);
  const LRef = useRef<any>(null);

  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    // HTML va BODY ni to'liq balandlikka chiqarish
    document.documentElement.style.height = "100%";
    document.body.style.height = "100%";
    document.body.style.margin = "0";
    document.body.style.padding = "0";

    const loadLeaflet = async () => {
      // CSS
      if (!document.getElementById("leaflet-css")) {
        const link = document.createElement("link");
        link.id = "leaflet-css";
        link.rel = "stylesheet";
        link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(link);
      }

      // JS
      if (!(window as any).L) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
          script.onload = () => resolve();
          script.onerror = () => reject();
          document.head.appendChild(script);
        });
      }

      const L = (window as any).L;
      LRef.current = L;

      if (!mapRef.current || mapInstanceRef.current) return;

      const map = L.map(mapRef.current, {
        center: [41.2995, 69.2401],
        zoom: 13,
        zoomControl: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap",
        maxZoom: 19,
      }).addTo(map);

      L.control.zoom({ position: "topright" }).addTo(map);

      mapInstanceRef.current = map;
      setReady(true);
    };

    loadLeaflet().catch(console.error);

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  const updateMap = useCallback(async (lat: number, lng: number, acc: number) => {
    const L = LRef.current;
    const map = mapInstanceRef.current;
    if (!map || !L) return;

    setCoords({ lat, lng });
    setAccuracy(acc);

    const icon = L.divIcon({
      className: "",
      html: `<div style="
        width:18px;height:18px;
        background:#2563eb;
        border:3px solid white;
        border-radius:50%;
        box-shadow:0 0 0 6px rgba(37,99,235,0.25),0 2px 8px rgba(0,0,0,0.4);
      "></div>`,
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    });

    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng]);
    } else {
      markerRef.current = L.marker([lat, lng], { icon }).addTo(map);
    }

    if (circleRef.current) {
      circleRef.current.setLatLng([lat, lng]);
      circleRef.current.setRadius(acc);
    } else {
      circleRef.current = L.circle([lat, lng], {
        radius: acc,
        color: "#2563eb",
        fillColor: "#3b82f6",
        fillOpacity: 0.12,
        weight: 1,
      }).addTo(map);
    }

    map.setView([lat, lng], Math.max(map.getZoom(), 17), { animate: true });

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
        { headers: { "Accept-Language": "uz,ru;q=0.9" } }
      );
      const data = await res.json();
      setAddress(data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    } catch {
      setAddress(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);
    }
  }, []);

  const handleLocate = () => {
    if (!navigator.geolocation) {
      setStatus("error");
      setErrorMsg("Brauzeringiz joylashuvni qo'llab-quvvatlamaydi.");
      return;
    }

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }

    setStatus("loading");
    setAccuracy(null);
    setAddress("");
    setErrorMsg("");

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng, accuracy: acc } = pos.coords;
        setStatus("success");
        updateMap(lat, lng, acc);
        if (acc <= 20) {
          navigator.geolocation.clearWatch(id);
          watchIdRef.current = null;
        }
      },
      (err) => {
        setStatus("error");
        if (err.code === 1) setErrorMsg("Ruxsat berilmadi. Brauzerda joylashuv ruxsatini yoqing.");
        else if (err.code === 2) setErrorMsg("GPS signal topilmadi. Ochiq havoda urinib ko'ring.");
        else setErrorMsg("Vaqt tugadi. Qayta urinib ko'ring.");
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 }
    );

    watchIdRef.current = id;
  };

  const accInfo = (() => {
    if (!accuracy) return null;
    if (accuracy <= 20) return { label: `±${Math.round(accuracy)}m — Juda aniq ✅`, bg: "#f0fdf4", border: "#bbf7d0", color: "#15803d" };
    if (accuracy <= 60) return { label: `±${Math.round(accuracy)}m — Aniq`, bg: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8" };
    if (accuracy <= 300) return { label: `±${Math.round(accuracy)}m — Aniqlanmoqda...`, bg: "#fefce8", border: "#fde68a", color: "#a16207" };
    return { label: `±${Math.round(accuracy)}m — GPS kutilmoqda...`, bg: "#fff7ed", border: "#fed7aa", color: "#c2410c" };
  })();

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100vw", height: "100vh", overflow: "hidden", fontFamily: "sans-serif" }}>

      {/* Xarita */}
      <div ref={mapRef} style={{ flex: 1, minHeight: 0, width: "100%" }} />

      {/* Pastki panel */}
      <div style={{ background: "white", borderTop: "1px solid #e5e7eb", boxShadow: "0 -4px 24px rgba(0,0,0,0.1)", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>

        {!ready && (
          <div style={{ textAlign: "center", color: "#9ca3af", fontSize: 14 }}>🗺️ Xarita yuklanmoqda...</div>
        )}

        {accInfo && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: 12, border: `1px solid ${accInfo.border}`, background: accInfo.bg, color: accInfo.color, fontSize: 14, fontWeight: 500 }}>
            🎯 {accInfo.label}
            {watchIdRef.current !== null && (
              <span style={{ marginLeft: "auto", display: "inline-block", animation: "spin 1s linear infinite" }}>⏳</span>
            )}
          </div>
        )}

        {status === "success" && address && (
          <div style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid #e5e7eb", background: "#f9fafb" }}>
            <div style={{ fontSize: 11, color: "#9ca3af", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>📍 Manzil</div>
            <div style={{ fontSize: 13, color: "#111827", lineHeight: 1.5 }}>{address}</div>
            {coords && (
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
                {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)}
              </div>
            )}
          </div>
        )}

        {status === "error" && (
          <div style={{ padding: "10px 14px", borderRadius: 12, border: "1px solid #fecaca", background: "#fef2f2", fontSize: 13, color: "#dc2626" }}>
            ⚠️ {errorMsg}
          </div>
        )}

        <button
          onClick={handleLocate}
          style={{
            width: "100%",
            height: 56,
            borderRadius: 16,
            border: "none",
            cursor: status === "loading" && !accuracy ? "not-allowed" : "pointer",
            fontSize: 16,
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            transition: "all 0.15s",
            background: status === "loading" && !accuracy ? "#e5e7eb" : status === "success" ? "#22c55e" : "#2563eb",
            color: status === "loading" && !accuracy ? "#9ca3af" : "white",
          }}
        >
          {status === "loading" && !accuracy
            ? "⏳ GPS qidirilmoqda..."
            : status === "success"
            ? "✅ Yangilash"
            : "📍 Joylashuvimni aniqla"}
        </button>
      </div>
    </div>
  );
}