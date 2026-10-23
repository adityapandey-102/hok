"use client";

import { useState } from "react";
import { joinPhone, phoneCountries, splitPhone } from "../../lib/domain";
import { Input } from "./Field";
import { Select } from "./Select";

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

  return (
    <div className="flex min-w-0 gap-1.5">
      <Select
        aria-label={`${label} country code`}
        value={iso}
        onChange={(e) => {
          setIso(e.target.value);
          onChange(joinPhone(e.target.value, local));
        }}
        className="w-24! shrink-0 truncate px-2!"
      >
        {phoneCountries().map((c) => (
          <option key={c.iso} value={c.iso}>
            +{c.code} {c.name}
          </option>
        ))}
      </Select>
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
