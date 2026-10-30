"use client";

import { useState } from "react";
import { joinPhone, phoneCountries, splitPhone } from "../../lib/domain";
import { Input } from "./Field";
import { Select } from "./Select";
import { useInBrowser } from "../../lib/hooks/useInBrowser";

/**
 * A phone number with its country code: pick the country (common ones
 * first), type the local number. `onChange` gets one international string,
 * "+971 50 123 4567", or "" when the number is empty. A number pasted with
 * its own "+code" is kept as pasted. hok-api validates the result.
 */
export function PhoneInput({
  id,
  value,
  onChange,
  "aria-label": ariaLabel,
  placeholder = "Phone number",
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  "aria-label"?: string;
  placeholder?: string;
}) {
  // The country is kept here: several share a code (+1 is the US, Canada, …), so it can't always be read back from the number.
  const [start] = useState(() => splitPhone(value));
  const [iso, setIso] = useState(start.iso);
  const [local, setLocal] = useState(start.local);
  const label = ariaLabel ?? "Phone";
  // Country names come from the runtime's own database (Intl.DisplayNames), which
  // can word or order them differently on the server and in the browser. Until
  // the page is interactive both render only the chosen code, so they match.
  const inBrowser = useInBrowser();
  const countries = inBrowser ? phoneCountries() : phoneCountries().filter((c) => c.iso === iso);
  const code = phoneCountries().find((c) => c.iso === iso)?.code;

  return (
    <div className="flex min-w-0 gap-1.5">
      {/* Closed, the picker shows just "+971"; open, the list names each country.
          The native select stays (keyboard, screen readers, phone pickers); its
          own text is hidden behind the short label. */}
      <div className="relative w-[5.5rem] shrink-0">
        <Select
          aria-label={`${label} country code`}
          value={iso}
          onChange={(e) => {
            setIso(e.target.value);
            onChange(joinPhone(e.target.value, local));
          }}
          className="pr-6! pl-3! text-transparent!"
        >
          {/* An old number saved without a code: say so rather than guess one. */}
          {start.iso === "" && <option value="">No code</option>}
          {countries.map((c) => (
            <option key={c.iso} value={c.iso} className="text-text-primary">
              {inBrowser ? `+${c.code} ${c.name}` : `+${c.code}`}
            </option>
          ))}
        </Select>
        <span aria-hidden className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-[15px] text-text-primary sm:text-sm">
          {code ? `+${code}` : "—"}
        </span>
      </div>
      <Input
        id={id}
        aria-label={label}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder={placeholder}
        value={local}
        onChange={(e) => {
          setLocal(e.target.value);
          onChange(joinPhone(iso, e.target.value));
        }}
        className="min-w-0 flex-1"
      />
    </div>
  );
}

