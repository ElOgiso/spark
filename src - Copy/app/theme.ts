export type ThemeMode = "system" | "violet" | "slate" | "light";

export const THEME_KEY = "spark_app_theme";

export const THEME_OPTIONS: { id: ThemeMode; name: string; desc: string; previewColor: string }[] = [
  {
    id: "system",
    name: "System Preference",
    desc: "Automatically syncs with your operating system's light or dark preference",
    previewColor: "bg-gradient-to-r from-blue-500 via-indigo-600 to-purple-600",
  },
  {
    id: "violet",
    name: "Obsidian & Electric Violet (Dark)",
    desc: "Deep obsidian canvas with luminous purple & electric violet accents",
    previewColor: "bg-gradient-to-r from-purple-600 via-fuchsia-600 to-indigo-600",
  },
  {
    id: "slate",
    name: "Classic Media OS Slate (Dark)",
    desc: "Clean dark neutral slate with high contrast monochrome & blue highlights",
    previewColor: "bg-gradient-to-r from-slate-700 via-zinc-800 to-neutral-900",
  },
  {
    id: "light",
    name: "Studio Light (Light)",
    desc: "Clean off-white studio layout with dark crisp typography and subtle borders",
    previewColor: "bg-gradient-to-r from-neutral-100 via-stone-200 to-zinc-300",
  },
];

export function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "violet";
  try {
    const stored = localStorage.getItem(THEME_KEY) as ThemeMode | null;
    if (stored && ["system", "violet", "slate", "light"].includes(stored)) {
      return stored;
    }
  } catch (e) {
    console.warn("Could not read stored theme:", e);
  }
  return "violet";
}

export function applyTheme(theme: ThemeMode) {
  if (typeof window === "undefined") return;
  const root = document.documentElement;
  
  // Remove existing theme classes
  root.classList.remove("theme-violet", "theme-slate", "theme-light", "dark", "light");

  if (theme === "system") {
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (prefersDark) {
      root.classList.add("theme-violet", "dark");
    } else {
      root.classList.add("theme-light", "light");
    }
  } else if (theme === "violet") {
    root.classList.add("theme-violet", "dark");
  } else if (theme === "slate") {
    root.classList.add("theme-slate", "dark");
  } else if (theme === "light") {
    root.classList.add("theme-light", "light");
  }

  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (e) {
    console.warn("Could not save theme preference:", e);
  }
}
