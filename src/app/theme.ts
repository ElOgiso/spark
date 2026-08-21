export type ThemeMode = "violet" | "slate" | "light" | "spark_media";

export const THEME_KEY = "spark_app_theme";

export const THEME_OPTIONS: { id: ThemeMode; name: string; desc: string; previewColor: string }[] = [
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
  {
    id: "spark_media",
    name: "Spark Media",
    desc: "Mobile Home uses the Spark Media layout.",
    previewColor: "bg-gradient-to-r from-fuchsia-600 via-purple-700 to-cyan-500",
  },
];

export function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "violet";
  try {
    const stored = localStorage.getItem(THEME_KEY);
    if (stored === "system") {
      localStorage.setItem(THEME_KEY, "violet");
      return "violet";
    }
    if (stored && ["violet", "slate", "light", "spark_media"].includes(stored)) {
      return stored as ThemeMode;
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

  const effectiveTheme: ThemeMode = (theme as string) === "system" ? "violet" : theme;

  if (effectiveTheme === "violet" || effectiveTheme === "spark_media") {
    root.classList.add("theme-violet", "dark");
  } else if (effectiveTheme === "slate") {
    root.classList.add("theme-slate", "dark");
  } else if (effectiveTheme === "light") {
    root.classList.add("theme-light", "light");
  }

  try {
    localStorage.setItem(THEME_KEY, effectiveTheme);
  } catch (e) {
    console.warn("Could not save theme preference:", e);
  }
}
