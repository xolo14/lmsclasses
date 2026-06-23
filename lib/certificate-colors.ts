const NAMED_COLORS: Record<string, string> = {
  white: "#ffffff",
  black: "#000000",
  red: "#ff0000",
  green: "#008000",
  blue: "#0000ff",
  navy: "#000080",
  teal: "#008080",
  cyan: "#00ffff",
  gray: "#808080",
  grey: "#808080",
  silver: "#c0c0c0",
  maroon: "#800000",
  olive: "#808000",
  lime: "#00ff00",
  aqua: "#00ffff",
  yellow: "#ffff00",
  fuchsia: "#ff00ff",
  purple: "#800080",
  orange: "#ffa500",
};

/** Normalize CSS color names / hex for PDF and canvas preview. */
export function parseCssColor(value: string | null | undefined, fallback = "#000000"): string {
  if (!value?.trim()) return fallback;
  const v = value.trim().toLowerCase();
  if (NAMED_COLORS[v]) return NAMED_COLORS[v];
  if (/^#[0-9a-f]{3}$/i.test(v)) {
    const [, r, g, b] = v.match(/^#(.)(.)(.)$/)!;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  if (/^#[0-9a-f]{6}$/i.test(v)) return v;
  if (/^#[0-9a-f]{8}$/i.test(v)) return v.slice(0, 7);
  return fallback;
}

/** Extract up to two hex colors from a CSS linear-gradient string. */
export function extractGradientColors(value: string): [string, string] {
  const hexMatches = value.match(/#[0-9a-fA-F]{3,8}/g) ?? [];
  if (hexMatches.length >= 2) {
    return [parseCssColor(hexMatches[0], "#0f172a"), parseCssColor(hexMatches[1], "#1e293b")];
  }
  if (hexMatches.length === 1) {
    return [parseCssColor(hexMatches[0], "#0f172a"), "#1e293b"];
  }
  return ["#0f172a", "#1e293b"];
}

export function resolveCanvasBackground(
  background: { type: string; value: string; underlayColor?: string }
): string {
  const v = background.value?.trim() ?? "";
  if (background.type === "image") {
    return parseCssColor(background.underlayColor, "#ffffff");
  }
  if (background.type === "gradient" || v.includes("gradient(")) {
    return v || "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)";
  }
  return parseCssColor(v, "#ffffff");
}

export function resolveCanvasBackgroundStyle(background: {
  type: string;
  value: string;
  underlayColor?: string;
}): Record<string, string> {
  if (background.type === "image" && background.value) {
    return {
      backgroundColor: parseCssColor(background.underlayColor, "#ffffff"),
      backgroundImage: `url(${background.value})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
      backgroundRepeat: "no-repeat",
    };
  }
  if (background.type === "gradient" || background.value.includes("gradient(")) {
    return {
      background: background.value || "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
    };
  }
  return {
    backgroundColor: parseCssColor(background.value, "#ffffff"),
  };
}
