"use client";

import { useId } from "react";
import { Input } from "../../../components/ui/Field";

function listZones(): string[] {
  try {
    return (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone") ?? [];
  } catch {
    return [];
  }
}

// Computed once per page load; the browser's zone list does not change.
let cachedZones: string[] | null = null;
function getZones(): string[] {
  cachedZones ??= listZones();
  return cachedZones;
}

/** Free-text IANA zone input with a datalist of the browser's named zones. The API validates it. */
export function TimeZoneInput({ id, value, onChange }: { id?: string; value: string; onChange: (value: string) => void }) {
  const listId = useId();
  return (
    <>
      <Input id={id} list={listId} value={value} onChange={(e) => onChange(e.target.value)} placeholder="Asia/Kolkata" />
      <datalist id={listId}>
        {getZones().map((z) => (
          <option key={z} value={z} />
        ))}
      </datalist>
    </>
  );
}
