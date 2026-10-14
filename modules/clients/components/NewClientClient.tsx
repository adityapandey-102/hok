"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { clientsApi, type CreateClientPayload } from "../api/clientsApi";
import type { UserAccount } from "../../admin-users/api/usersApi";
import { useToast } from "../../../components/ui/Toast";
import { ButtonLink } from "../../../components/ui/Button";
import { Icon } from "../../../components/ui/Icon";
import { ClientForm } from "./ClientForm";

/** New client form. The creator becomes the owner; Admin may pick another owner. */
export function NewClientClient({ isAdmin }: { isAdmin: boolean }) {
  const router = useRouter();
  const { showToast } = useToast();
  const [owners, setOwners] = useState<UserAccount[]>([]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    clientsApi
      .listOwnerCandidates()
      .then((o) => {
        if (!cancelled) setOwners(o);
      })
      .catch(() => {
        // Without the list the owner defaults to the Admin themselves.
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

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
    <div className="mx-auto max-w-4xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="page-title">New client</h1>
        <ButtonLink href="/app/clients" variant="outline">
          <Icon name="chevron-right" size={15} className="rotate-180" /> All clients
        </ButtonLink>
      </div>
      <ClientForm owners={isAdmin ? owners : undefined} submitLabel="Create client" onSubmit={handleCreate} />
    </div>
  );
}
