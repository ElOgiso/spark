import React, { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import {
  CHARACTER_GENRE_OPTIONS,
  normalizeCharacterGenre,
  type CharacterGenreId,
} from "../../domain/characterGenre";

interface CharacterGenrePickerProps {
  selected?: string | null;
  onSelect: (id: CharacterGenreId) => void;
  compact?: boolean;
  allowTypeIn?: boolean;
}

export function CharacterGenrePicker({
  selected,
  onSelect,
  compact = false,
  allowTypeIn = true,
}: CharacterGenrePickerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedId = normalizeCharacterGenre(selected) || "realistic";
  const selectedIdx = Math.max(
    0,
    CHARACTER_GENRE_OPTIONS.findIndex((g) => g.id === selectedId),
  );
  const [activeIdx, setActiveIdx] = useState(selectedIdx);
  const [typed, setTyped] = useState("");

  const scrollTo = (idx: number) => {
    const el = scrollRef.current;
    if (!el) return;
    const card = el.children[idx] as HTMLElement | undefined;
    if (card) {
      el.scrollTo({
        left: card.offsetLeft - (el.clientWidth - card.clientWidth) / 2,
        behavior: "smooth",
      });
    }
    setActiveIdx(idx);
  };

  useEffect(() => {
    scrollTo(selectedIdx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handler = () => {
      const center = el.scrollLeft + el.clientWidth / 2;
      let closest = 0;
      for (let i = 0; i < el.children.length; i++) {
        const c = el.children[i] as HTMLElement;
        const cc = el.children[closest] as HTMLElement;
        if (
          Math.abs(c.offsetLeft + c.clientWidth / 2 - center) <
          Math.abs(cc.offsetLeft + cc.clientWidth / 2 - center)
        ) {
          closest = i;
        }
      }
      setActiveIdx(closest);
    };
    el.addEventListener("scroll", handler, { passive: true });
    return () => el.removeEventListener("scroll", handler);
  }, []);

  const commitTyped = () => {
    const resolved = normalizeCharacterGenre(typed);
    if (resolved) {
      onSelect(resolved);
      setTyped("");
    }
  };

  const cardW = compact ? 148 : 280;
  const cardH = compact ? 168 : 280;

  return (
    <div className="space-y-3">
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto no-bar py-1"
        style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" } as React.CSSProperties}
      >
        {CHARACTER_GENRE_OPTIONS.map((g, i) => {
          const mood = g.referenceImages[0];
          const isOn = selectedId === g.id;
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => {
                onSelect(g.id);
                scrollTo(i);
              }}
              className="flex-shrink-0 rounded-2xl overflow-hidden relative border-2 transition-all duration-200 text-left"
              style={{
                width: compact ? cardW : "72vw",
                maxWidth: cardW,
                height: cardH,
                scrollSnapAlign: "center",
                borderColor: isOn ? "#F018FF" : "transparent",
                boxShadow: isOn ? "0 0 24px rgba(240,24,255,0.5)" : "0 0 0 1px rgba(255,255,255,0.08)",
              }}
            >
              {mood ? (
                <img src={mood} alt="" className="absolute inset-0 w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 bg-white/5" />
              )}
              <div
                className="absolute inset-0"
                style={{
                  background: "linear-gradient(to top,rgba(0,0,0,0.85) 0%,rgba(0,0,0,0.18) 55%,transparent 100%)",
                }}
              />
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <p className={`${compact ? "text-sm" : "text-base"} font-bold text-white`}>{g.label}</p>
                <p className="text-[11px] text-white/55 mt-0.5 line-clamp-2">{g.desc}</p>
              </div>
              {isOn && (
                <div
                  className="absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center"
                  style={{ background: "#F018FF" }}
                >
                  <Check className="w-3.5 h-3.5 text-white" />
                </div>
              )}
            </button>
          );
        })}
      </div>
      <div className="flex justify-center gap-1.5">
        {CHARACTER_GENRE_OPTIONS.map((g, i) => (
          <button
            key={g.id}
            type="button"
            onClick={() => scrollTo(i)}
            className="rounded-full transition-all duration-200"
            style={{
              width: i === activeIdx ? 16 : 6,
              height: 6,
              background: i === activeIdx ? "#F018FF" : "rgba(255,255,255,0.2)",
            }}
          />
        ))}
      </div>
      {allowTypeIn && (
        <div className="flex gap-2">
          <input
            type="text"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitTyped();
              }
            }}
            placeholder="Type a genre (3D, anime, realistic…)"
            className="flex-1 bg-white/[0.03] text-foreground border border-white/10 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-purple-500"
          />
          <button
            type="button"
            onClick={commitTyped}
            disabled={!normalizeCharacterGenre(typed)}
            className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-white disabled:opacity-40"
          >
            Use
          </button>
        </div>
      )}
    </div>
  );
}
