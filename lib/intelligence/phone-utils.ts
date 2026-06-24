export function normalizePhone(phone: string): string {
  // Strip everything except digits
  let normalized = phone.replace(/\D/g, "");
  
  // Remove leading 0 (South African format)
  if (normalized.startsWith("0")) {
    normalized = normalized.substring(1);
  }
  
  // Ensure it starts with country code 27
  if (!normalized.startsWith("27")) {
    normalized = "27" + normalized;
  }
  
  return normalized;
}
