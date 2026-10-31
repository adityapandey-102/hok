import { Router } from "express";
import { requireAuth } from "../../../common/middleware/auth.middleware";
import { authRateLimiter, loginEmailRateLimiter, loginIpEmailRateLimiter, resetEmailRateLimiter } from "../../../common/middleware/rate-limit.middleware";
import { issueDeviceToken } from "../../../common/auth/trusted-device";
import { asyncHandler } from "../../../common/http/async-handler";
import { validateBody } from "../../../common/http/validate.middleware";
import { AuthService } from "../application/auth.service";
import { DrizzleAuthRepository } from "../infrastructure/drizzle-auth.repository";
import { bootstrapDtoSchema, type BootstrapDto } from "./dto/bootstrap.dto";
import { loginDtoSchema, type LoginDto } from "./dto/login.dto";
import { refreshDtoSchema, type RefreshDto } from "./dto/refresh.dto";
import { passwordResetRequestDtoSchema } from "./dto/password-reset-request.dto";
import { passwordUpdateDtoSchema, type PasswordUpdateDto } from "./dto/password-update.dto";
import { exchangeCodeDtoSchema, type ExchangeCodeDto } from "./dto/exchange-code.dto";
import { updateOwnProfileDtoSchema, type UpdateOwnProfileDto } from "./dto/update-own-profile.dto";
import { authProvider } from "../../../common/auth/supabase-auth-provider";

/** Composition root for the Auth module -- wires the concrete (Infrastructure) adapter into the Application service. */
const authService = new AuthService(new DrizzleAuthRepository(authProvider));

export const authRouter = Router();

authRouter.get("/me", requireAuth, (req, res) => {
  res.json({ profile: req.profile });
});

/** The caller edits their own name / phone / time zone / photo URL (FR-AUTH-05). Any authenticated role. */
authRouter.patch(
  "/me",
  requireAuth,
  validateBody(updateOwnProfileDtoSchema),
  asyncHandler(async (req, res) => {
    res.json({ profile: await authService.updateOwnProfile(req.authUserId!, req.body as UpdateOwnProfileDto) });
  }),
);

authRouter.get(
  "/bootstrap-status",
  asyncHandler(async (_req, res) => {
    res.json(await authService.getBootstrapStatus());
  }),
);

authRouter.post(
  "/bootstrap",
  authRateLimiter,
  validateBody(bootstrapDtoSchema),
  asyncHandler(async (req, res) => {
    await authService.bootstrap(req.body as BootstrapDto);
    res.status(201).json({ ok: true });
  }),
);

authRouter.post(
  "/login",
  authRateLimiter,
  loginIpEmailRateLimiter,
  loginEmailRateLimiter,
  validateBody(loginDtoSchema),
  asyncHandler(async (req, res) => {
    const dto = req.body as LoginDto;
    // hok-web keeps deviceToken in an httpOnly cookie and sends it back on later logins (trusted-device.ts).
    res.json({ ...(await authService.login(dto)), deviceToken: issueDeviceToken(dto.email) });
  }),
);

authRouter.post(
  "/refresh",
  authRateLimiter,
  validateBody(refreshDtoSchema),
  asyncHandler(async (req, res) => {
    res.json(await authService.refresh(req.body as RefreshDto));
  }),
);

authRouter.post(
  "/logout",
  requireAuth,
  asyncHandler(async (req, res) => {
    await authService.logout(req.accessToken!);
    res.status(204).send();
  }),
);

authRouter.post(
  "/password-reset-request",
  authRateLimiter,
  resetEmailRateLimiter,
  validateBody(passwordResetRequestDtoSchema),
  (_req, res) => {
    // Turned off (security audit run 2): a Supabase recovery link is a full session for whoever
    // reads the mailbox, which bypasses the Admin-issues-passwords model. Still 204 for any email,
    // so old clients keep working and nothing about accounts is revealed.
    res.status(204).send();
  },
);

authRouter.post(
  "/password-update",
  authRateLimiter,
  requireAuth,
  validateBody(passwordUpdateDtoSchema),
  asyncHandler(async (req, res) => {
    await authService.updatePassword(req.authUserId!, req.body as PasswordUpdateDto);
    res.status(204).send();
  }),
);

authRouter.post(
  "/exchange-code",
  authRateLimiter,
  validateBody(exchangeCodeDtoSchema),
  asyncHandler(async (req, res) => {
    res.json(await authService.exchangeCode(req.body as ExchangeCodeDto));
  }),
);
