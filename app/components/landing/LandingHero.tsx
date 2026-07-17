"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { createGlobeScene, type GlobeSceneHandle } from "./globe-scene";
import { LANDING_LOCATIONS } from "./locations";
import "./landing.css";

export default function LandingHero() {
  const rootRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const glRef = useRef<HTMLDivElement>(null);
  const hotLabelRef = useRef<HTMLDivElement>(null);
  const loaderRef = useRef<HTMLDivElement>(null);
  const loaderCountRef = useRef<HTMLDivElement>(null);
  const loaderBarRef = useRef<HTMLElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const heroInnerRef = useRef<HTMLDivElement>(null);
  const heroStatRef = useRef<HTMLDivElement>(null);
  const heroRailRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<GlobeSceneHandle | null>(null);
  const panelTlRef = useRef<gsap.core.Timeline | null>(null);

  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeLocation, setActiveLocation] = useState(LANDING_LOCATIONS[0]);

  const reduced =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const fillContent = useCallback((index: number) => {
    setActiveLocation(LANDING_LOCATIONS[index]);
    setFocusedIndex(index);
  }, []);

  const openPanel = useCallback(() => {
    const panel = panelRef.current;
    if (!panel) return;
    gsap.set(panel, { yPercent: window.innerWidth > 900 ? -50 : 0 });
    setPanelOpen(true);
    panel.setAttribute("aria-hidden", "false");
    if (panelTlRef.current) panelTlRef.current.kill();
    panelTlRef.current = gsap
      .timeline()
      .fromTo(
        panel,
        {
          clipPath: "inset(0 0 100% 0 round 1.4rem)",
          y: 36,
          opacity: 0,
        },
        {
          clipPath: "inset(0 0 0% 0 round 1.4rem)",
          y: 0,
          opacity: 1,
          duration: reduced ? 0.25 : 1.05,
          ease: "power4.out",
          delay: reduced ? 0 : 0.4,
        }
      )
      .fromTo(
        panel.querySelectorAll(".lp-loc-swap > *, .lp-loc-foot > *"),
        { y: 16, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.6,
          ease: "power3.out",
          stagger: 0.06,
          clearProps: "all",
        },
        "-=.55"
      );
  }, [reduced]);

  const closePanel = useCallback(() => {
    const panel = panelRef.current;
    if (!panel) return;
    panel.setAttribute("aria-hidden", "true");
    if (panelTlRef.current) panelTlRef.current.kill();
    panelTlRef.current = gsap
      .timeline()
      .to(panel, {
        clipPath: "inset(0 0 100% 0 round 1.4rem)",
        y: 24,
        opacity: 0,
        duration: 0.5,
        ease: "power3.in",
      })
      .add(() => setPanelOpen(false));
  }, []);

  const handleFocus = useCallback(
    (index: number, viaSwitch: boolean) => {
      fillContent(index);
      if (!viaSwitch) openPanel();
    },
    [fillContent, openPanel]
  );

  const handleUnfocus = useCallback(() => {
    setFocusedIndex(null);
    closePanel();
  }, [closePanel]);

  const switchTo = useCallback(
    (index: number) => {
      const globe = globeRef.current;
      if (!globe) return;
      if (globe.getFocused() < 0) {
        globe.switchTo(index);
        return;
      }
      if (index === globe.getFocused()) return;
      const dir = index > globe.getFocused() ? 1 : -1;
      const swap = panelRef.current?.querySelector(".lp-loc-swap");
      if (!swap) {
        globe.switchTo(index);
        return;
      }
      gsap.to(swap, {
        y: -10 * dir,
        opacity: 0,
        duration: 0.22,
        ease: "power2.in",
        overwrite: "auto",
        onComplete: () => {
          globe.switchTo(index);
          fillContent(index);
          gsap.fromTo(
            swap,
            { y: 12 * dir, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.55, ease: "power3.out" }
          );
        },
      });
    },
    [fillContent]
  );

  useEffect(() => {
    const wrap = glRef.current;
    const hero = heroRef.current;
    const hotLabel = hotLabelRef.current;
    const heroInner = heroInnerRef.current;
    const heroStat = heroStatRef.current;
    const heroRail = heroRailRef.current;
    if (!wrap || !hero || !hotLabel || !heroInner) return;

    const dimTargets = [heroInner, heroStat, heroRail].filter(
      Boolean
    ) as HTMLElement[];

    globeRef.current = createGlobeScene({
      wrap,
      hero,
      hotLabel,
      dimTargets,
      gsap,
      onFocus: handleFocus,
      onUnfocus: handleUnfocus,
    });

    return () => {
      globeRef.current?.destroy();
      globeRef.current = null;
    };
  }, [handleFocus, handleUnfocus]);

  useEffect(() => {
    const loader = loaderRef.current;
    const count = loaderCountRef.current;
    const bar = loaderBarRef.current;
    if (!loader || !count || !bar) return;

    const heroIntro = gsap.timeline({ paused: true });
    heroIntro
      .fromTo(
        "#lpHeroTitle .lp-u-line-in",
        { yPercent: 115, rotate: 3 },
        {
          yPercent: 0,
          rotate: 0,
          duration: 1.3,
          ease: "power4.out",
          stagger: 0.12,
        }
      )
      .fromTo(
        ".lp-hero-eyebrow",
        { opacity: 0, y: 16 },
        { opacity: 1, y: 0, duration: 0.8, ease: "power3.out" },
        "-=.9"
      )
      .fromTo(
        "#lpHeroSub",
        { opacity: 0, y: 26 },
        { opacity: 1, y: 0, duration: 0.9, ease: "power3.out" },
        "-=.8"
      )
      .fromTo(
        "#lpHeroCtas",
        { opacity: 0, y: 26 },
        { opacity: 1, y: 0, duration: 0.9, ease: "power3.out" },
        "-=.75"
      )
      .fromTo(
        "#lpHeroCoords",
        { opacity: 0 },
        { opacity: 1, duration: 0.8 },
        "-=.6"
      )
      .fromTo(
        "#lpHeroStat",
        { opacity: 0, y: 30, rotate: 8 },
        { opacity: 1, y: 0, rotate: 4, duration: 1, ease: "power3.out" },
        "-=.7"
      )
      .fromTo(
        ".lp-nav",
        { opacity: 0, y: -18 },
        { opacity: 1, y: 0, duration: 0.8, ease: "power3.out" },
        "-=.9"
      );

    if (reduced) {
      gsap.set(loader, { display: "none" });
      heroIntro.progress(1);
      return;
    }

    const counter = { v: 0 };
    const boot = gsap.timeline();
    boot
      .to(counter, {
        v: 100,
        duration: 1.5,
        ease: "power2.inOut",
        onUpdate: () => {
          count.textContent = String(Math.round(counter.v)).padStart(2, "0");
        },
      })
      .to(bar, { scaleX: 1, duration: 1.5, ease: "power2.inOut" }, 0)
      .to(".lp-loader-mark", { yPercent: -110, duration: 0.7, ease: "power3.in" }, "+=0.15")
      .to([".lp-loader-count", ".lp-loader-tag"], { opacity: 0, duration: 0.4 }, "<")
      .to(
        loader,
        { clipPath: "inset(0 0 100% 0)", duration: 1, ease: "power4.inOut" },
        "-=.25"
      )
      .set(loader, { display: "none" })
      .add(() => heroIntro.play(), "-=.55");

    return () => {
      boot.kill();
      heroIntro.kill();
    };
  }, [reduced]);

  return (
    <div ref={rootRef} className="landing-root">
      <div ref={loaderRef} className="lp-loader" id="lpLoader">
        <div className="lp-loader-mark">
          Lok<span className="lp-accent">á</span>l
        </div>
        <div className="lp-loader-tag">
          şehir küratörü
          <br />
          yükleniyor
        </div>
        <div ref={loaderCountRef} className="lp-loader-count">
          00
        </div>
        <div className="lp-loader-bar">
          <i ref={loaderBarRef} />
        </div>
      </div>

      <div className="lp-grain" aria-hidden="true" />

      <header className="lp-nav">
        <Link href="/" className="lp-nav-logo">
          Lokál<sup style={{ fontSize: "0.5em" }}>®</sup>
        </Link>
        <Link href="/kesfet" className="lp-nav-cta">
          Keşfet
        </Link>
      </header>

      <main>
        <section ref={heroRef} className="lp-hero" id="lpHero">
          <div ref={glRef} className="lp-gl" aria-hidden="true" />
          <div className="lp-hero-veil" aria-hidden="true" />

          <div ref={heroStatRef} className="lp-hero-stat" id="lpHeroStat">
            <b>12.400+</b>
            <span>
              tek kullanımlık rota
              <br />
              her gün yeniden
            </span>
          </div>

          <div ref={heroRailRef} className="lp-hero-rail">
            Şehir seninle nefes alıyor
          </div>

          <div ref={heroInnerRef} className="lp-hero-inner">
            <p className="lp-eyebrow lp-hero-eyebrow">
              Yapay zekâ destekli şehir küratörü
            </p>
            <h1 className="lp-hero-title" id="lpHeroTitle">
              <span className="lp-u-line">
                <span className="lp-u-line-in">Şehir sabit.</span>
              </span>
              <span className="lp-u-line">
                <span className="lp-u-line-in">
                  <em className="lp-it">Sen değilsin.</em>
                </span>
              </span>
              <span className="lp-u-line">
                <span className="lp-u-line-in">
                  Rota da <span className="lp-outline">öyle.</span>
                </span>
              </span>
            </h1>
            <div className="lp-hero-foot">
              <p className="lp-hero-sub" id="lpHeroSub">
                Lokál; <strong>konumunu, modunu ve yanındakileri</strong> okuyup
                o âna özel rotalar ve deneyimler kurgular. Aynı şehir, her
                seferinde başka bir hikâye.
              </p>
              <div className="lp-hero-ctas" id="lpHeroCtas">
                <Link href="/kesfet" className="lp-btn lp-btn-solid">
                  Rotamı Oluştur <span className="lp-arr">→</span>
                </Link>
              </div>
              <div className="lp-hero-coords" id="lpHeroCoords">
                <span>41.0082° N — 28.9784° E</span>
                <span className="lp-live">İstanbul · canlı</span>
              </div>
            </div>
          </div>

          <div className="lp-gl-hint" aria-hidden="true">
            <i /> kürede 5 odak noktası — dokun ve keşfet
          </div>
          <div ref={hotLabelRef} className="lp-hot-label" aria-hidden="true" />

          <aside
            ref={panelRef}
            className={`lp-loc-panel${panelOpen ? " show" : ""}`}
            role="dialog"
            aria-modal="false"
            aria-hidden={panelOpen ? "false" : "true"}
            aria-label="Odak noktası detayı"
          >
            <button
              className="lp-loc-close"
              type="button"
              aria-label="Kapat"
              onClick={() => globeRef.current?.unfocus()}
            >
              ×
            </button>
            <div className="lp-loc-swap">
              <p className="lp-loc-eyebrow">
                <span>{activeLocation.no}</span>&nbsp;·&nbsp;
                <span>{activeLocation.tag}</span>
              </p>
              <h3 className="lp-loc-title">{activeLocation.title}</h3>
              <p className="lp-loc-coords">{activeLocation.coords}</p>
              <p className="lp-loc-desc">{activeLocation.desc}</p>
            </div>
            <div className="lp-loc-foot">
              <Link href="/kesfet" className="lp-loc-cta">
                Bu şehir için rota oluştur <span className="lp-arr">→</span>
              </Link>
              <div className="lp-loc-nav">
                <button
                  className="lp-loc-arrow"
                  type="button"
                  aria-label="Önceki nokta"
                  onClick={() => {
                    const i =
                      focusedIndex === null
                        ? 0
                        : (focusedIndex + LANDING_LOCATIONS.length - 1) %
                          LANDING_LOCATIONS.length;
                    switchTo(i);
                  }}
                >
                  ←
                </button>
                <div className="lp-loc-dots">
                  {LANDING_LOCATIONS.map((loc, i) => (
                    <button
                      key={loc.id}
                      type="button"
                      className={`lp-loc-dot${focusedIndex === i ? " on" : ""}`}
                      aria-label={loc.title}
                      onClick={() => switchTo(i)}
                    />
                  ))}
                </div>
                <button
                  className="lp-loc-arrow"
                  type="button"
                  aria-label="Sonraki nokta"
                  onClick={() => {
                    const i =
                      focusedIndex === null
                        ? 0
                        : (focusedIndex + 1) % LANDING_LOCATIONS.length;
                    switchTo(i);
                  }}
                >
                  →
                </button>
              </div>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
