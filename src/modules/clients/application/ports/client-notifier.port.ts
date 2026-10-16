import type { ClientReassignedNotice } from "./clients-repository.port";

/**
 * Notifications the Clients module raises (M9, FR-NTF-03). Called AFTER the
 * change has committed; the bell entry itself was already written inside the
 * change's transaction (`ClientChanges.reassignedNotice`), so this only sends
 * the web push. The adapter is built in api/clients.routes.ts from the
 * Notifications module's `notifier`; this module never imports it directly
 * (docs/adr/0003). Implementations never throw.
 */
export interface ClientNotifier {
  clientReassigned(notice: ClientReassignedNotice): Promise<void>;
}

export const noopClientNotifier: ClientNotifier = {
  clientReassigned: () => Promise.resolve(),
};
