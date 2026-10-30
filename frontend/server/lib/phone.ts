/**
 * Phone normalization tuned for Indian numbers, producing E.164 where possible.
 * Returns null when the input cannot be interpreted as a phone number.
 */
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const digitsOnly = input.replace(/[^\d+]/g, "");
  if (!digitsOnly) return null;
  let digits = digitsOnly.startsWith("+") ? digitsOnly.slice(1) : digitsOnly;
  digits = digits.replace(/\D/g, "");
  if (digits.startsWith("0091")) digits = digits.slice(4);
  else if (digits.startsWith("00")) digits = digits.slice(2);

  if (digits.length === 10 && /^[6-9]/.test(digits)) return `+91${digits}`;
  if (digits.length === 11 && digits.startsWith("0") && /^[6-9]/.test(digits[1])) {
    return `+91${digits.slice(1)}`;
  }
  if (digits.length === 12 && digits.startsWith("91") && /^[6-9]/.test(digits[2])) {
    return `+${digits}`;
  }
  // Other international numbers: accept 8-15 digits as E.164 when they had a + prefix.
  if (digitsOnly.startsWith("+") && digits.length >= 8 && digits.length <= 15) return `+${digits}`;
  return null;
}

/** WhatsApp sends wa_id without a plus sign (e.g. "919876543210"). */
export function waIdToE164(waId: string | null | undefined): string | null {
  if (!waId) return null;
  const digits = waId.replace(/\D/g, "");
  if (digits.length < 8) return null;
  return `+${digits}`;
}

export function formatPhoneForDisplay(e164: string | null | undefined): string {
  if (!e164) return "";
  if (e164.startsWith("+91") && e164.length === 13) {
    return `+91 ${e164.slice(3, 8)} ${e164.slice(8)}`;
  }
  return e164;
}
