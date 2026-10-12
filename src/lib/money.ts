// Amounts are stored as integer paise (₹1 = 100 paise). Never use floats for money.

/** Parse a user-supplied amount string ("1,234.56", "₹1250", "1250.5") into paise. Returns null if invalid. */
export function parseAmountToPaise(input: string | number): number | null {
  if (typeof input === "number") {
    if (!Number.isFinite(input)) return null;
    return Math.round(input * 100);
  }
  const cleaned = input.replace(/[₹,\s]/g, "");
  if (!/^\d*(?:\.\d{1,2})?$/.test(cleaned)) return null;
  if (cleaned === "" || cleaned === ".") return null;
  const [intPart = "", fracPart = ""] = cleaned.split(".");
  const rupees = intPart === "" ? 0 : parseInt(intPart, 10);
  const paise = fracPart === "" ? 0 : parseInt(fracPart.padEnd(2, "0"), 10);
  const total = rupees * 100 + paise;
  if (total > 9_999_999_999) return null; // sanity cap (~₹10 crore)
  return total;
}

/** Convert paise to a plain decimal string in rupees, e.g. 123456 -> "1234.56". */
export function paiseToDecimalString(paise: number): string {
  const negative = paise < 0;
  const abs = Math.abs(Math.round(paise));
  const rupees = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, "0");
  return `${negative ? "-" : ""}${rupees}.${frac}`;
}

/** Group an integer string Indian-style: 1234567 -> "12,34,567". */
function groupIndian(intStr: string): string {
  if (intStr.length <= 3) return intStr;
  const last3 = intStr.slice(-3);
  let rest = intStr.slice(0, -3);
  const groups: string[] = [];
  while (rest.length > 2) {
    groups.unshift(rest.slice(-2));
    rest = rest.slice(0, -2);
  }
  if (rest) groups.unshift(rest);
  return [...groups, last3].join(",");
}

/** Format paise as INR with Indian digit grouping, e.g. 123456789 -> "₹12,34,567.89". */
export function formatINR(
  paise: number,
  opts?: { decimals?: boolean }
): string {
  const negative = paise < 0;
  const abs = Math.abs(Math.round(paise));
  const rupees = Math.floor(abs / 100);
  const frac = opts?.decimals === false ? "" : `.${String(abs % 100).padStart(2, "0")}`;
  return `${negative ? "-" : ""}₹${groupIndian(String(rupees))}${frac}`;
}

/** Compact INR for chart axes: 150000 paise (₹1,500) -> "₹1.5k"; ₹1,20,000 -> "₹1.2L"; ₹2,00,00,000 -> "₹2Cr". */
export function formatINRCompact(paise: number): string {
  const rupees = paise / 100;
  const sign = rupees < 0 ? "-" : "";
  const abs = Math.abs(rupees);
  const fmt = (v: number, suffix: string) =>
    `${sign}₹${(Math.round(v * 10) / 10).toString().replace(/\.0$/, "")}${suffix}`;
  if (abs >= 1_00_00_000) return fmt(abs / 1_00_00_000, "Cr");
  if (abs >= 1_00_000) return fmt(abs / 1_00_000, "L");
  if (abs >= 1_000) return fmt(abs / 1_000, "k");
  return `${sign}₹${Math.round(abs)}`;
}
