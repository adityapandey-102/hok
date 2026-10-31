"use client";

import { useRouter } from "next/navigation";
import { clientsApi, type CreateClientPayload } from "../api/clientsApi";
import { useToast } from "../../../components/ui/Toast";
import { ButtonLink } from "../../../components/ui/Button";
import { Icon } from "../../../components/ui/Icon";
import { ClientForm } from "./ClientForm";

/** New client form. The creator becomes the owner; Admin may pick another owner. */
export function NewClientClient({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  const { showToast } = useToast();
  async function handleCreate(payload: object): Promise<string | null> {
    try {
      const { client } = await clientsApi.create(payload as CreateClientPayload);
      showToast(`${client.businessName} created.`, "success");
      router.push(`/app/clients/${client.id}`);
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : "Failed to create the client";
    }
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">New client</h1>
          <p className="text-sm text-text-muted">Add the business, its contact and its contract. You can change any of it later.</p>
        </div>
        <div className="page-actions">
          <ButtonLink href="/app/clients" variant="outline">
            <Icon name="chevron-right" size={15} className="rotate-180" /> All clients
          </ButtonLink>
        </div>
      </header>
      <ClientForm canPickOwner={isAdmin} submitLabel="Create client" onSubmit={handleCreate} />
    </div>
  );
}
