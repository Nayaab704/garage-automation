function firstNonEmpty(values) {
  return values.find((value) => String(value ?? "").trim()) ?? "";
}

function cleanDisplayValue(value) {
  const cleanValue = String(value ?? "").trim();
  const mailtoMatch = cleanValue.match(/^\[([^\]]+)\]\(mailto:[^)]+\)$/i);

  return mailtoMatch?.[1] ?? cleanValue;
}

function getFirstToken(value) {
  return cleanDisplayValue(value).split(/\s+/).filter(Boolean)[0] ?? "";
}

function getEmailUserName(value) {
  const email = cleanDisplayValue(value);

  if (!email.includes("@")) {
    return "";
  }

  const [userName] = email.split("@");
  return userName ? userName.replace(/[._-]+/g, " ") : "";
}

function isGenericDisplayName(value) {
  return [
    "admin",
    "admin user",
    "ordering",
    "ordering user",
    "owner",
    "owner user",
    "sales",
    "sales user",
    "technician",
    "technician user",
    "user",
  ].includes(String(value ?? "").trim().toLowerCase());
}

export function formatUserFirstName(profileOrName) {
  if (!profileOrName) {
    return "User";
  }

  if (typeof profileOrName === "string") {
    const emailUserName = getEmailUserName(profileOrName);

    return getFirstToken(emailUserName || profileOrName) || "User";
  }

  const metadataName = firstNonEmpty([
    profileOrName.user_metadata?.full_name,
    profileOrName.user_metadata?.name,
    profileOrName.user_metadata?.display_name,
    profileOrName.raw_user_meta_data?.full_name,
    profileOrName.raw_user_meta_data?.name,
    profileOrName.raw_user_meta_data?.display_name,
    profileOrName.name,
  ]);
  const fullName = firstNonEmpty([profileOrName.full_name]);
  const emailUserName = getEmailUserName(profileOrName.email);
  const displayName = isGenericDisplayName(fullName) && (metadataName || emailUserName)
    ? firstNonEmpty([metadataName, emailUserName])
    : firstNonEmpty([fullName, metadataName, emailUserName]);
  const fallbackDisplayName = getEmailUserName(displayName) || displayName;

  return getFirstToken(fallbackDisplayName) || fallbackDisplayName || "User";
}

export function formatUserAction(label, profileOrName) {
  if (!profileOrName) {
    return "";
  }

  return `${label} by ${formatUserFirstName(profileOrName)}`;
}
