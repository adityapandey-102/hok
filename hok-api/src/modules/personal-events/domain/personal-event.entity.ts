/** A manager's own calendar entry (FR-CAL-02/03): not a client event; optionally linked to one of their clients. */
export interface PersonalEventEntity {
  id: string;
  ownerId: string;
  ownerName: string;
  clientId: string | null;
  clientName: string | null;
  title: string;
  /** UTC ISO instants. */
  startsAt: string;
  endsAt: string;
  /** The IANA zone it was planned in (defaults to the owner's profile zone). */
  timeZone: string;
  description: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}
