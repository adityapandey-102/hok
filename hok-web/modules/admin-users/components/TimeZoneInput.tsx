"use client";

import { SearchSelect } from "../../../components/ui/SearchSelect";
import { searchTimeZones, timeZoneLabel } from "../../../lib/domain";
import { useInBrowser } from "../../../lib/hooks/useInBrowser";

/**
 * Time zone picker: type a city ("London"), a country's zone name ("India",
 * "Gulf") or an offset ("+4", "GMT+5:30"). Opening it shows the common
 * zones. Replaces a pre-filled text box whose suggestions only matched the
 * text already in it, so other countries could not be found (2026-10-22).
 * The zone list is the browser's own, fixed, so it is searched locally.
 */
export function TimeZoneInput({ id, value, onChange }: { id?: string; value: string; onChange: (value: string) => void }) {
  const inBrowser = useInBrowser();
  return (
    <SearchSelect
      id={id}
      aria-label="Time zone"
      value={value || null}
      selectedLabel={value ? timeZoneLabel(value, undefined, inBrowser) : undefined}
      placeholder="Search a city, country or offset"
      emptyText="No time zone matches. Try a city, e.g. Dubai, or an offset, e.g. +4."
      load={(search) => Promise.resolve(searchTimeZones(search).map((z) => ({ id: z.id, label: `${z.city} (${z.offset})`, hint: z.name || z.id })))}
      onChange={(zone) => zone && onChange(zone)}
    />
  );
}
