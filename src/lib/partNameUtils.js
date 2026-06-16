const typoCorrections = new Map([
  ["handel", "handle"],
  ["handels", "handles"],
  ["ligth", "light"],
  ["ligths", "lights"],
  ["miror", "mirror"],
  ["mirrorss", "mirrors"],
  ["bumpr", "bumper"],
  ["bumber", "bumper"],
  ["fenderliner", "fender liner"],
]);

const ignoredTokens = new Set(["a", "an", "the"]);

export function normalizePartName(input) {
  const normalized = String(input ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[\s/_+\\|-]+/g, " ")
    .replace(/[^a-z0-9 ]+/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return "";
  }

  return normalized
    .split(" ")
    .filter(Boolean)
    .map((token) => typoCorrections.get(token) ?? token)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenizePartName(input) {
  return [
    ...new Set(
      normalizePartName(input)
        .split(" ")
        .map((token) => token.trim())
        .filter((token) => token.length > 1 && !ignoredTokens.has(token))
    ),
  ];
}

export function getPartSearchTerms(input) {
  const normalizedPartName = normalizePartName(input);
  const tokens = tokenizePartName(normalizedPartName);

  return [
    ...new Set(
      [
        normalizedPartName,
        ...tokens,
        tokens.length > 1 ? tokens.join(" ") : "",
      ].filter(Boolean)
    ),
  ];
}
