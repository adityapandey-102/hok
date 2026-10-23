import { env } from "../../../config/env";
import { ForbiddenError } from "../../../common/errors/app-error";
import { generateOpaqueToken, hashToken } from "../../../common/crypto/credentials";
import { AUDIT_ACTIONS, AUDIT_ENTITIES } from "../../../common/audit/audit-actions";
import { auditLogger as defaultAuditLogger } from "../../../common/audit/drizzle-audit-logger";
import type { AuditLogger } from "../../../common/audit/audit-logger";
import { getCapabilityScope, type Role } from "../../../domain";
import { assertCanIssueLink, assertClientManageable, assertLead, portalUrl, type PortalScope } from "../domain/portal.rules";
import type { PortalLinkEntity } from "../domain/portal.entity";
import type { PortalLinksRepositoryPort } from "./ports/portal-repositories.port";

export interface PortalCaller {
  userId: string;
  role: Role;
}

/**
 * Staff side of the client portal (FR-POR-01/02): generate (or regenerate --
 * the same action: the old link stops working at once), view and disable a
 * client's link. portal:manage: anyone on the client's team sees the link;
 * only its lead (or the Admin) generates or disables it (403 PORTAL_LEAD_ONLY);
 * a client off the caller's team is a 404.
 * The token is returned ONCE, in the generate response; only its SHA-256 is
 * stored, and neither is ever logged or audited.
 */
export class PortalLinksService {
  constructor(
    private readonly repo: PortalLinksRepositoryPort,
    private readonly audit: AuditLogger = defaultAuditLogger,
    private readonly webAppUrl: string = env.WEB_APP_URL,
  ) {}

  private scopeOf(caller: PortalCaller): PortalScope {
    const scope = getCapabilityScope(caller.role, "portal:manage");
    if (scope === true) return { kind: "all" };
    if (scope === "own") return { kind: "own", userId: caller.userId };
    throw new ForbiddenError("Your role can't manage portal links");
  }

  async get(caller: PortalCaller, clientId: string): Promise<PortalLinkEntity | null> {
    assertClientManageable(this.scopeOf(caller), await this.repo.findClient(clientId));
    return this.repo.findCurrent(clientId);
  }

  async generate(caller: PortalCaller, clientId: string): Promise<{ link: PortalLinkEntity; token: string; url: string }> {
    const scope = this.scopeOf(caller);
    assertLead(scope, assertClientManageable(scope, await this.repo.findClient(clientId)));
    const token = generateOpaqueToken();
    const link = await this.repo.replace(clientId, hashToken(token), caller.userId, (locked) => {
      // Re-checked on the locked client: it may have been archived or reassigned since.
      assertLead(scope, assertClientManageable(scope, locked));
      assertCanIssueLink(locked);
    });
    await this.audit.record({ action: AUDIT_ACTIONS.PORTAL_LINK_GENERATED, entityType: AUDIT_ENTITIES.PORTAL_LINK, entityId: link.id, metadata: { clientId } });
    return { link, token, url: portalUrl(this.webAppUrl, token) };
  }

  /** Idempotent: disabling a client with no active link is fine. Returns the link as it now stands. */
  async disable(caller: PortalCaller, clientId: string): Promise<PortalLinkEntity | null> {
    const scope = this.scopeOf(caller);
    assertLead(scope, assertClientManageable(scope, await this.repo.findClient(clientId)));
    if (await this.repo.revoke(clientId)) {
      await this.audit.record({ action: AUDIT_ACTIONS.PORTAL_LINK_DISABLED, entityType: AUDIT_ENTITIES.PORTAL_LINK, metadata: { clientId } });
    }
    return this.repo.findCurrent(clientId);
  }
}
