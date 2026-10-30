/**
 * Country calling codes for the phone pickers. A number is stored as one
 * international string ("+971 50 123 4567"); the picker splits it into the
 * country code and the local part for editing, and joins them back.
 * Country names come from the browser (Intl.DisplayNames), so only the
 * ISO code and calling code are listed here.
 */

/** ISO 3166 code → calling code. The countries HOK's clients are most likely in come first in the menu (see COMMON). */
const CODES: Record<string, string> = {
  AE: "971", AF: "93", AL: "355", AM: "374", AO: "244", AR: "54", AT: "43", AU: "61", AZ: "994",
  BA: "387", BD: "880", BE: "32", BG: "359", BH: "973", BN: "673", BO: "591", BR: "55", BT: "975", BW: "267", BY: "375",
  CA: "1", CD: "243", CH: "41", CI: "225", CL: "56", CM: "237", CN: "86", CO: "57", CR: "506", CU: "53", CY: "357", CZ: "420",
  DE: "49", DK: "45", DO: "1", DZ: "213",
  EC: "593", EE: "372", EG: "20", ES: "34", ET: "251",
  FI: "358", FJ: "679", FR: "33",
  GB: "44", GE: "995", GH: "233", GR: "30", GT: "502",
  HK: "852", HN: "504", HR: "385", HU: "36",
  ID: "62", IE: "353", IL: "972", IN: "91", IQ: "964", IR: "98", IS: "354", IT: "39",
  JM: "1", JO: "962", JP: "81",
  KE: "254", KG: "996", KH: "855", KR: "82", KW: "965", KZ: "7",
  LA: "856", LB: "961", LK: "94", LT: "370", LU: "352", LV: "371", LY: "218",
  MA: "212", MD: "373", ME: "382", MG: "261", MK: "389", MM: "95", MN: "976", MO: "853", MT: "356", MU: "230", MV: "960", MX: "52", MY: "60", MZ: "258",
  NA: "264", NG: "234", NI: "505", NL: "31", NO: "47", NP: "977", NZ: "64",
  OM: "968",
  PA: "507", PE: "51", PH: "63", PK: "92", PL: "48", PR: "1", PS: "970", PT: "351", PY: "595",
  QA: "974",
  RO: "40", RS: "381", RU: "7", RW: "250",
  SA: "966", SD: "249", SE: "46", SG: "65", SI: "386", SK: "421", SN: "221", SO: "252", SV: "503", SY: "963",
  TH: "66", TN: "216", TR: "90", TT: "1", TW: "886", TZ: "255",
  UA: "380", UG: "256", US: "1", UY: "598", UZ: "998",
  VE: "58", VN: "84",
  YE: "967",
  ZA: "27", ZM: "260", ZW: "263",
};

/** Listed first in the menu, in this order. */
const COMMON = ["IN", "AE", "SA", "QA", "KW", "OM", "BH", "GB", "US", "CA", "AU", "SG", "PK", "BD", "NP", "LK"];

/** Where HOK is: new numbers start with this country selected. */
export const DEFAULT_PHONE_COUNTRY = "IN";

export interface PhoneCountry {
  iso: string;
  code: string;
  name: string;
}

let names: Intl.DisplayNames | null = null;
function countryName(iso: string): string {
  try {
    names ??= new Intl.DisplayNames(["en"], { type: "region" });
    return names.of(iso) ?? iso;
  } catch {
    return iso;
  }
}

let countries: PhoneCountry[] | null = null;
/** Common countries first, then the rest alphabetically. */
export function phoneCountries(): PhoneCountry[] {
  if (!countries) {
    const all = Object.entries(CODES).map(([iso, code]) => ({ iso, code, name: countryName(iso) }));
    const first = COMMON.map((iso) => all.find((c) => c.iso === iso)!);
    const rest = all.filter((c) => !COMMON.includes(c.iso)).sort((a, b) => a.name.localeCompare(b.name));
    countries = [...first, ...rest];
  }
  return countries;
}

/**
 * "+971 50 123 4567" → { iso: "AE", local: "50 123 4567" }. The longest
 * matching calling code wins ("+1 242…" is +1, "+971" beats "+97"). A number
 * without "+" (saved before the code picker existed) gets no country (iso "")
 * and keeps the text as typed, so it's never silently given +91; `preferIso`
 * picks between countries sharing a code (+1: US / Canada / …, +7: Russia / Kazakhstan).
 */
export function splitPhone(value: string, preferIso = DEFAULT_PHONE_COUNTRY): { iso: string; local: string } {
  const text = value.trim();
  const m = /^\+\s*(\d+)/.exec(text);
  if (!m) return { iso: text ? "" : preferIso, local: text };
  const digits = m[1]!;
  for (let len = Math.min(3, digits.length); len >= 1; len--) {
    const code = digits.slice(0, len);
    const matches = Object.keys(CODES).filter((iso) => CODES[iso] === code);
    if (matches.length) {
      const iso = matches.includes(preferIso) ? preferIso : (COMMON.find((c) => matches.includes(c)) ?? matches[0]!);
      const rest = text.replace(/^\+\s*/, "").slice(len).trim();
      return { iso, local: rest };
    }
  }
  return { iso: preferIso, local: text };
}

/**
 * { iso: "AE", local: "50 123 4567" } → "+971 50 123 4567"; an empty local part is "".
 * A local part typed with its own "+" (or "00", the international prefix) keeps that code; no country (iso "") keeps the text as typed.
 */
export function joinPhone(iso: string, local: string): string {
  const number = local.trim();
  if (!number) return "";
  if (number.startsWith("+")) return number;
  if (number.startsWith("00")) return `+${number.slice(2).trimStart()}`;
  if (!iso) return number;
  const national = number.replace(/^0+/, "");
  if (!national) return "";
  // A leading trunk 0 ("050 …") is dropped in international form.
  return `+${CODES[iso] ?? CODES[DEFAULT_PHONE_COUNTRY]} ${national}`;
}
