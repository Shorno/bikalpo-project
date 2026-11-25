/**
 * Batch details entered when stock comes in (Phase 5, client review
 * 2026-11-24): expiry is tracked per batch, so products with expiry
 * tracking on need a batch number and an expiry date on every stock-in.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type BatchFields = {
  batchNo?: string | null;
  /** Maker's lot code on the pack ("Manufactured", e.g. XXL099). */
  manufacturedCode?: string | null;
  manufactureDate?: string | null;
  expiryDate?: string | null;
};

export type CleanBatchFields = {
  batchNo: string | null;
  manufacturedCode: string | null;
  manufactureDate: string | null;
  expiryDate: string | null;
};

const blankToNull = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

/** Trims the fields and turns blanks into null. */
export function cleanBatchFields(fields: BatchFields): CleanBatchFields {
  return {
    batchNo: blankToNull(fields.batchNo),
    manufacturedCode: blankToNull(fields.manufacturedCode),
    manufactureDate: blankToNull(fields.manufactureDate),
    expiryDate: blankToNull(fields.expiryDate),
  };
}

function isRealDate(value: string) {
  if (!ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

/**
 * Problems with one stock-in line's batch details, worded for the person
 * entering stock. `label` names the line ("Rice 5 KG").
 */
export function batchFieldErrors(
  fields: BatchFields,
  options: { expiryEnabled: boolean; label: string },
): string[] {
  const clean = cleanBatchFields(fields);
  const errors: string[] = [];
  for (const [name, value] of [
    ["Manufacture date", clean.manufactureDate],
    ["Expiry date", clean.expiryDate],
  ] as const) {
    if (value && !isRealDate(value)) {
      errors.push(`${options.label}: ${name} is not a valid date`);
    }
  }
  if (options.expiryEnabled) {
    if (!clean.batchNo) errors.push(`${options.label}: enter a batch number`);
    if (!clean.expiryDate) errors.push(`${options.label}: enter an expiry date`);
  }
  if (
    clean.manufactureDate &&
    clean.expiryDate &&
    isRealDate(clean.manufactureDate) &&
    isRealDate(clean.expiryDate) &&
    clean.expiryDate < clean.manufactureDate
  ) {
    errors.push(`${options.label}: expiry date is before the manufacture date`);
  }
  return errors;
}
