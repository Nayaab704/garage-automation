const cancelledStatuses = new Set(["cancelled", "canceled"]);

export function isCancelledStatus(status) {
  return cancelledStatuses.has(String(status ?? "").trim().toLowerCase());
}

export function getCancellationAuditValues(
  record,
  currentProfileId,
  cancelledAt = new Date().toISOString()
) {
  if (isCancelledStatus(record?.status)) {
    return {};
  }

  return {
    cancelled_at: record?.cancelled_at ?? cancelledAt,
    cancelled_by: record?.cancelled_by ?? currentProfileId ?? null,
  };
}
