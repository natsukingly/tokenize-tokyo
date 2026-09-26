"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Globe2,
  MapPin,
  Network,
  Pause,
  Play,
  Layers3,
  RotateCcw,
} from "lucide-react";
import BrandPlate from "./BrandPlate";
import { CITIES } from "@/lib/cities";
import styles from "./CityShowcase.module.css";

const CityShowcaseMap = dynamic(() => import("./CityShowcaseMap"), {
  ssr: false,
  loading: () => <div className={styles.mapNotice}>Preparing the map…</div>,
});

export default function CityShowcase() {
  const [selected, setSelected] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [cameraReset, setCameraReset] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const city = CITIES[selected];

  useEffect(() => {
    const readCity = () => {
      const index = CITIES.findIndex(
        (item) => `#${item.id}` === window.location.hash,
      );
      setSelected(Math.max(0, index));
      setPlaying(false);
    };
    readCity();
    window.addEventListener("hashchange", readCity);
    window.addEventListener("popstate", readCity);
    const stopWhenHidden = () => {
      if (document.hidden) setPlaying(false);
    };
    document.addEventListener("visibilitychange", stopWhenHidden);
    return () => {
      window.removeEventListener("hashchange", readCity);
      window.removeEventListener("popstate", readCity);
      document.removeEventListener("visibilitychange", stopWhenHidden);
    };
  }, []);

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => {
      if (selected === CITIES.length - 1) {
        setPlaying(false);
      } else {
        const next = selected + 1;
        setSelected(next);
        window.history.replaceState(null, "", `#${CITIES[next].id}`);
      }
    }, 9000);
    return () => window.clearTimeout(timer);
  }, [playing, selected]);

  function selectCity(index: number) {
    setPlaying(false);
    setSelected(index);
    setCameraReset((value) => value + 1);
    const hash = `#${CITIES[index].id}`;
    if (window.location.hash !== hash) window.history.pushState(null, "", hash);
  }

  function onTabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const next =
      event.key === "ArrowRight"
        ? (index + 1) % CITIES.length
        : event.key === "ArrowLeft"
          ? (index + CITIES.length - 1) % CITIES.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? CITIES.length - 1
              : null;
    if (next === null) return;
    event.preventDefault();
    selectCity(next);
    tabs.current[next]?.focus();
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <a href="/" aria-label="TOKENIZE TOKYO home">
          <BrandPlate width={180} />
        </a>
        <span className={styles.headerLabel}>
          <Globe2 size={15} /> Expansion preview
        </span>
        <a href="/" className={styles.back}>
          <ArrowLeft size={16} /> <span>Back to app</span>
        </a>
      </header>

      <main className={styles.main}>
        <section className={styles.story} aria-labelledby="showcase-heading">
          <p className={styles.eyebrow}>
            <span /> Built in Tokyo. Designed to travel.
          </p>
          <h1 id="showcase-heading">
            From Tokyo
            <br /> to the <em>world.</em>
          </h1>
          <p className={styles.intro}>
            Every city has untapped space.
            <br /> Give it a name, a purpose and a way to participate.
          </p>

          <div className={styles.steps}>
            <div>
              <MapPin size={18} />
              <p>
                <strong>Start with a space</strong>
                <span>Locate rooftops, rooms and unused places.</span>
              </p>
            </div>
            <div>
              <Network size={18} />
              <p>
                <strong>Give its rights a name</strong>
                <span>ENS connects a readable identity to onchain rights.</span>
              </p>
            </div>
            <div>
              <Layers3 size={18} />
              <p>
                <strong>Connect capital to use</strong>
                <span>Fund projects, manage rights and track revenue.</span>
              </p>
            </div>
          </div>

          <div className={styles.closing}>
            <p>
              Different cities.
              <br />
              <strong>The same building blocks.</strong>
            </p>
            <a href="/demo">
              Explore Tokyo demo <ArrowUpRight size={18} />
            </a>
          </div>
        </section>

        <section
          className={styles.mapPanel}
          aria-label="City expansion preview"
        >
          <CityShowcaseMap city={city} cameraReset={cameraReset} />
          <div className={styles.mapShade} aria-hidden="true" />

          <div className={styles.mapTop}>
            <div
              className={styles.tabs}
              role="tablist"
              aria-label="Choose a city"
            >
              {CITIES.map((item, index) => (
                <button
                  key={item.id}
                  ref={(node) => {
                    tabs.current[index] = node;
                  }}
                  role="tab"
                  id={`tab-${item.id}`}
                  aria-selected={selected === index}
                  aria-controls="city-panel"
                  tabIndex={selected === index ? 0 : -1}
                  onClick={() => selectCity(index)}
                  onKeyDown={(event) => onTabKey(event, index)}
                >
                  <span className={styles.tabNumber}>0{index + 1}</span>
                  {item.name}
                </button>
              ))}
            </div>
            <div className={styles.mapActions}>
              <button
                aria-label={playing ? "Pause city tour" : "Play city tour"}
                className={styles.tour}
                onClick={() => {
                  if (playing) {
                    setPlaying(false);
                    return;
                  }
                  setSelected(0);
                  setCameraReset((value) => value + 1);
                  window.history.replaceState(null, "", "#tokyo");
                  setPlaying(true);
                }}
              >
                {playing ? <Pause size={14} /> : <Play size={14} />}
                <span>{playing ? "Pause tour" : "Play city tour"}</span>
              </button>
              <button
                className={styles.reset}
                aria-label="Reset map view"
                title="Reset map view"
                onClick={() => setCameraReset((value) => value + 1)}
              >
                <RotateCcw size={15} />
              </button>
            </div>
          </div>

          <div
            id="city-panel"
            role="tabpanel"
            aria-labelledby={`tab-${city.id}`}
            className={styles.cityPanel}
          >
            <div
              className={styles.cityIdentity}
              aria-live="polite"
              aria-atomic="true"
            >
              <p className={styles.cityStage}>
                <span /> {city.stage}{" "}
                <span className={styles.cityCount}>0{selected + 1} / 03</span>
              </p>
              <h2>
                {city.name}
                <span aria-hidden="true">{city.localName}</span>
              </h2>
              <p className={styles.district}>
                <MapPin size={14} /> {city.district}
              </p>
            </div>
            <div className={styles.opportunity}>
              <p className={styles.exampleLabel}>Illustrative use case</p>
              <h3>{city.opportunity}</h3>
              <p>{city.description}</p>
              <div className={styles.chips}>
                {city.useCases.map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
      <div className={styles.footer}>
        <span>
          <Globe2 size={13} /> One framework. More possibilities.
        </span>
        <p>
          Overseas markets are not live. Each launch needs local assets,
          operators and terms.
        </p>
      </div>
    </div>
  );
}
