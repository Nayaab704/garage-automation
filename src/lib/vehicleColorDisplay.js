const fallbackColor = {
  borderColor: "#94A3B8",
  dotColor: "#CBD5E1",
  textColor: "#64748B",
};

export const commonVehicleColorOptions = [
  { hex: "#F8FAFC", name: "White" },
  { hex: "#111827", name: "Black" },
  { hex: "#C0C0C0", name: "Silver" },
  { hex: "#6B7280", name: "Gray" },
  { hex: "#DC2626", name: "Red" },
  { hex: "#2563EB", name: "Blue" },
  { hex: "#16A34A", name: "Green" },
  { hex: "#92400E", name: "Brown" },
  { hex: "#D97706", name: "Gold" },
  { hex: "#CA8A04", name: "Yellow" },
  { hex: "#EA580C", name: "Orange" },
  { hex: "#D6B98C", name: "Beige" },
  { hex: "#7F1D1D", name: "Maroon" },
  { hex: "#7C3AED", name: "Purple" },
];

const vehicleColorTokens = {
  beige: {
    borderColor: "#B89462",
    dotColor: "#D6B98C",
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
    dotColor: "#D97706",
    textColor: "#A16207",
  },
  gray: {
    dotColor: "#6B7280",
    textColor: "#6B7280",
  },
  green: {
    dotColor: "#16A34A",
    textColor: "#15803D",
  },
  grey: {
    dotColor: "#6B7280",
    textColor: "#6B7280",
  },
  maroon: {
    dotColor: "#7F1D1D",
    textColor: "#7F1D1D",
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
    borderColor: "#94A3B8",
    dotColor: "#C0C0C0",
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
  cream: "beige",
  gray: "gray",
  grey: "grey",
  pearl: "white",
  tan: "beige",
  violet: "purple",
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

function hexToRgb(hexColor) {
  const normalizedHex = normalizeVehicleColorHex(hexColor);

  if (!normalizedHex) {
    return null;
  }

  return {
    blue: parseInt(normalizedHex.slice(5, 7), 16),
    green: parseInt(normalizedHex.slice(3, 5), 16),
    red: parseInt(normalizedHex.slice(1, 3), 16),
  };
}

function getRgbDistance(firstRgb, secondRgb) {
  return Math.sqrt(
    (firstRgb.red - secondRgb.red) ** 2 +
      (firstRgb.green - secondRgb.green) ** 2 +
      (firstRgb.blue - secondRgb.blue) ** 2
  );
}

function getLuminance(hexColor) {
  const rgb = hexToRgb(hexColor);

  if (!rgb) {
    return 0;
  }

  return (0.299 * rgb.red + 0.587 * rgb.green + 0.114 * rgb.blue) / 255;
}

function getReadableTextColorForHex(hexColor) {
  const normalizedHex = normalizeVehicleColorHex(hexColor);

  if (!normalizedHex) {
    return fallbackColor.textColor;
  }

  return getLuminance(normalizedHex) > 0.58
    ? fallbackColor.textColor
    : normalizedHex;
}

function getSwatchBorderColor(hexColor) {
  return getLuminance(hexColor) > 0.64 ? "#94A3B8" : hexColor;
}

export function normalizeVehicleColorHex(hexColor) {
  const normalizedHex = String(hexColor ?? "").trim();

  if (!normalizedHex) {
    return "";
  }

  const withHash = normalizedHex.startsWith("#")
    ? normalizedHex
    : `#${normalizedHex}`;

  return /^#[0-9a-f]{6}$/i.test(withHash) ? withHash.toUpperCase() : "";
}

export function getVehicleColorHexForName(color) {
  const normalizedColor = normalizeVehicleColorName(color);
  const colorToken = getColorToken(normalizedColor);

  return vehicleColorTokens[colorToken]?.dotColor ?? "";
}

export function getClosestVehicleColorName(hexColor) {
  const rgb = hexToRgb(hexColor);

  if (!rgb) {
    return "";
  }

  return commonVehicleColorOptions
    .map((option) => ({
      distance: getRgbDistance(rgb, hexToRgb(option.hex)),
      name: option.name,
    }))
    .sort((firstOption, secondOption) => firstOption.distance - secondOption.distance)[0]
    ?.name ?? "";
}

export function getVehicleColorDisplay(color, colorHex = "") {
  const normalizedColor = normalizeVehicleColorName(color);
  const colorToken = getColorToken(normalizedColor);
  const normalizedHex = normalizeVehicleColorHex(colorHex);
  const colorStyle = vehicleColorTokens[colorToken] ?? fallbackColor;
  const dotColor = normalizedHex || colorStyle.dotColor;
  const label = normalizedColor
    ? titleCase(normalizedColor)
    : normalizedHex
      ? getClosestVehicleColorName(normalizedHex) || "Custom color"
      : "Color n/a";
  const borderColor = normalizedHex
    ? getSwatchBorderColor(normalizedHex)
    : colorStyle.borderColor ?? colorStyle.dotColor;
  const textColor = normalizedHex
    ? colorToken
      ? colorStyle.textColor
      : getReadableTextColorForHex(normalizedHex)
    : colorStyle.textColor;

  return {
    dotStyle: {
      backgroundColor: dotColor,
      borderColor,
    },
    label,
    textStyle: {
      color: textColor,
    },
  };
}
