import { Router } from "express";
import { requireAuth } from "../../../common/middleware/auth.middleware";
import { requireCapability } from "../../../common/middleware/capability.middleware";
import { asyncHandler } from "../../../common/http/async-handler";
import { validateQuery } from "../../../common/http/validate.middleware";
import { TeamMembersService } from "../application/team-members.service";
import { DrizzleTeamMembersRepository } from "../infrastructure/drizzle-team-members.repository";
import { teamMemberQueryDtoSchema, type TeamMemberQueryDto } from "./dto/team-member-query.dto";
import type { TeamMemberEntity } from "../domain/team-member.entity";

/** Composition root for the Team-members module (read-only). */
const service = new TeamMembersService(new DrizzleTeamMembersRepository());

/** Entity -> response DTO: exactly { id, fullName, role }. */
const present = (m: TeamMemberEntity) => ({ id: m.id, fullName: m.fullName, role: m.role });

export const teamMembersRouter = Router();

// The Admin and SMM / MM (anyone who can create events and pick their team);
// task-only staff 403. Account management stays on /users (users:manage).
teamMembersRouter.use(requireAuth, requireCapability("events:write"));

teamMembersRouter.get(
  "/",
  validateQuery(teamMemberQueryDtoSchema),
  asyncHandler(async (req, res) => {
    const result = await service.list(req.query as unknown as TeamMemberQueryDto);
    res.json({ ...result, members: result.members.map(present) });
  }),
);
