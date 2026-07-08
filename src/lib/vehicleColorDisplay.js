const fallbackColor = {
  borderColor: "#94A3B8",
  dotColor: "#CBD5E1",
  textColor: "#64748B",
};

const vehicleColorTokens = {
  beige: {
    dotColor: "#D6C6A8",
    textColor: "#854D0E",
  },
  black: {
    dotColor: "#111827",
    textColor: "#111827",
  },
  blue: {
    dotColor: "#2563EB",
    textColor: "#2563EB",
  },
  brown: {
    dotColor: "#92400E",
    textColor: "#92400E",
  },
  gold: {
    dotColor: "#CA8A04",
    textColor: "#A16207",
  },
  gray: {
    dotColor: "#9CA3AF",
    textColor: "#6B7280",
  },
  green: {
    dotColor: "#16A34A",
    textColor: "#15803D",
  },
  grey: {
    dotColor: "#9CA3AF",
    textColor: "#6B7280",
  },
  orange: {
    dotColor: "#EA580C",
    textColor: "#C2410C",
  },
  purple: {
    dotColor: "#7C3AED",
    textColor: "#6D28D9",
  },
  red: {
    dotColor: "#DC2626",
    textColor: "#DC2626",
  },
  silver: {
    dotColor: "#94A3B8",
    textColor: "#64748B",
  },
  white: {
    borderColor: "#94A3B8",
    dotColor: "#F8FAFC",
    textColor: "#64748B",
  },
  yellow: {
    dotColor: "#CA8A04",
    textColor: "#A16207",
  },
};

const tokenAliases = {
  charcoal: "black",
  gray: "gray",
  grey: "grey",
  pearl: "white",
};

function titleCase(value) {
  return String(value)
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function normalizeVehicleColorName(color) {
  return String(color ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ");
}

function getColorToken(normalizedColor) {
  if (!normalizedColor) {
    return "";
  }

  if (vehicleColorTokens[normalizedColor]) {
    return normalizedColor;
  }

  const matchedToken = normalizedColor
    .split(" ")
    .find((token) => vehicleColorTokens[token] || tokenAliases[token]);

  return tokenAliases[matchedToken] ?? matchedToken ?? "";
}

export function getVehicleColorDisplay(color) {
  const normalizedColor = normalizeVehicleColorName(color);
  const colorToken = getColorToken(normalizedColor);
  const colorStyle = vehicleColorTokens[colorToken] ?? fallbackColor;
  const label = normalizedColor ? titleCase(normalizedColor) : "Color n/a";
  const borderColor = colorStyle.borderColor ?? colorStyle.dotColor;

  return {
    dotStyle: {
      backgroundColor: colorStyle.dotColor,
      borderColor,
    },
    label,
    textStyle: {
      color: colorStyle.textColor,
    },
  };
}
