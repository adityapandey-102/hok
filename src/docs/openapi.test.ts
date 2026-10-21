import { describe, expect, it } from "vitest";
import type { Router } from "express";
import { openApiDocument } from "./openapi";
import { ROLES } from "../domain";
import { authRouter } from "../modules/auth/api/auth.routes";
import { usersRouter } from "../modules/users/api/users.routes";
import { clientsRouter } from "../modules/clients/api/clients.routes";
import { CLIENT_STATUSES, SOCIAL_PLATFORMS } from "../modules/clients/domain/client.entity";
import { stageTemplatesRouter } from "../modules/stage-templates/api/stage-templates.routes";
import { eventsRouter } from "../modules/events/api/events.routes";
import { personalEventsRouter } from "../modules/personal-events/api/personal-events.routes";
import { calendarFeedPublicRouter, calendarRouter } from "../modules/calendar/api/calendar.routes";
import { teamMembersRouter } from "../modules/team-members/api/team-members.routes";
import { EVENT_STATES, EVENT_TYPES } from "../modules/events/domain/event.entity";
import { assetsRouter } from "../modules/assets/api/assets.routes";
import { ASSET_TYPES } from "../modules/assets/domain/asset.entity";
import { staffTasksRouter } from "../modules/staff-tasks/api/staff-tasks.routes";
import { STAFF_TASK_PRIORITIES, STAFF_TASK_STATUSES, STAFF_TASK_UPDATE_KINDS } from "../modules/staff-tasks/domain/staff-task.entity";
import { clientTodosByClientRouter, clientTodosRouter } from "../modules/client-todos/api/client-todos.routes";
import { CLIENT_TODO_PRIORITIES, CLIENT_TODO_STATUSES } from "../modules/client-todos/domain/client-todo.entity";
import { notificationsRouter } from "../modules/notifications/api/notifications.routes";
import { portalLinksRouter } from "../modules/portal/api/portal-links.routes";
import { portalPublicRouter } from "../modules/portal/api/portal-public.routes";
import { clientCommentsRouter, portalCommentsRouter } from "../modules/client-comments/api/client-comments.routes";
import { dashboardRouter } from "../modules/dashboard/api/dashboard.routes";
import { activityRouter } from "../modules/activity/api/activity.routes";
import { searchRouter } from "../modules/search/api/search.routes";
import { reportsRouter } from "../modules/reports/api/reports.routes";
import { COMMENT_STATUSES } from "../modules/client-comments/domain/client-comment.entity";
import { NOTIFICATION_TYPES } from "../modules/notifications/domain/notification.entity";

/**
 * openapi.yaml is hand-maintained, so it can silently drift from the code.
 * These pin (1) the enums that change with the business -- a new role (and
 * later: event states, comment and task statuses) that isn't documented fails
 * CI instead of shipping a wrong contract, as in needleye -- and (2) the route
 * list: every method + path a mounted router serves must be documented.
 * Add each new module's router to MOUNTED below, with its app.ts prefix.
 */
type Schemas = Record<string, { enum?: string[]; properties?: Record<string, unknown> }>;
const doc = openApiDocument as { components: { schemas: Schemas }; paths: Record<string, Record<string, unknown>> };
const schemas = doc.components.schemas;

const MOUNTED: [string, Router][] = [
  ["/api/v1/auth", authRouter],
  ["/api/v1/users", usersRouter],
  ["/api/v1/clients/:clientId/todos", clientTodosByClientRouter],
  ["/api/v1/clients", clientsRouter],
  ["/api/v1/stage-templates", stageTemplatesRouter],
  ["/api/v1/events", eventsRouter],
  ["/api/v1/personal-events", personalEventsRouter],
  ["/api/v1/calendar", calendarRouter],
  ["/api/v1/calendar-feed", calendarFeedPublicRouter],
  ["/api/v1/team-members", teamMembersRouter],
  ["/api/v1/assets", assetsRouter],
  ["/api/v1/staff-tasks", staffTasksRouter],
  ["/api/v1/client-todos", clientTodosRouter],
  ["/api/v1/notifications", notificationsRouter],
  ["/api/v1/portal-links", portalLinksRouter],
  ["/api/v1/client-comments", clientCommentsRouter],
  ["/api/v1/dashboard", dashboardRouter],
  ["/api/v1/activity", activityRouter],
  ["/api/v1/search", searchRouter],
  ["/api/v1/reports", reportsRouter],
  ["/api/v1/portal/{token}", portalCommentsRouter],
  ["/api/v1/portal/{token}", portalPublicRouter],
];

/** Express 4 keeps each route on its router's stack as { route: { path, methods } }. */
function routesOf(prefix: string, router: Router): string[] {
  const stack = (router as unknown as { stack: { route?: { path: string; methods: Record<string, boolean> } }[] }).stack;
  return stack.flatMap((layer) => {
    if (!layer.route) return [];
    const path = `${prefix}${layer.route.path === "/" ? "" : layer.route.path}`.replace(/:(\w+)/g, "{$1}");
    return Object.keys(layer.route.methods).map((method) => `${method.toUpperCase()} ${path}`);
  });
}

describe("openapi.yaml stays in sync with the domain", () => {
  it("documents exactly the six roles, in order", () => {
    expect(schemas.Role?.enum).toEqual([...ROLES]);
  });

  it("documents the time zone on the profile the web reads from /auth/me", () => {
    expect(Object.keys(schemas.Profile?.properties ?? {})).toEqual(
      expect.arrayContaining(["id", "fullName", "email", "role", "timeZone", "phone", "avatarUrl", "active", "createdAt"]),
    );
  });
});

describe("openapi.yaml stays in sync with the Clients module", () => {
  it("documents exactly the client statuses, in order", () => {
    expect(schemas.ClientStatus?.enum).toEqual([...CLIENT_STATUSES]);
  });

  it("documents exactly the social platforms", () => {
    expect(Object.keys(schemas.SocialHandles?.properties ?? {})).toEqual([...SOCIAL_PLATFORMS]);
  });
});

describe("openapi.yaml stays in sync with the Events module", () => {
  it("documents exactly the event types and states, in order", () => {
    expect(schemas.EventType?.enum).toEqual([...EVENT_TYPES]);
    expect(schemas.EventState?.enum).toEqual([...EVENT_STATES]);
  });
});

describe("openapi.yaml stays in sync with the Assets module", () => {
  it("documents exactly the asset types, in order", () => {
    expect(schemas.AssetType?.enum).toEqual([...ASSET_TYPES]);
  });
});

describe("openapi.yaml stays in sync with the Staff tasks module", () => {
  it("documents exactly the task statuses, priorities and timeline kinds, in order", () => {
    expect(schemas.StaffTaskStatus?.enum).toEqual([...STAFF_TASK_STATUSES]);
    expect(schemas.StaffTaskPriority?.enum).toEqual([...STAFF_TASK_PRIORITIES]);
    expect(schemas.StaffTaskUpdateKind?.enum).toEqual([...STAFF_TASK_UPDATE_KINDS]);
  });
});

describe("openapi.yaml stays in sync with the Client to-dos module", () => {
  it("documents exactly the to-do statuses and priorities, in order", () => {
    expect(schemas.ClientTodoStatus?.enum).toEqual([...CLIENT_TODO_STATUSES]);
    expect(schemas.ClientTodoPriority?.enum).toEqual([...CLIENT_TODO_PRIORITIES]);
  });
});

describe("openapi.yaml stays in sync with the Notifications module", () => {
  it("documents exactly the notification types, in order", () => {
    expect(schemas.NotificationType?.enum).toEqual([...NOTIFICATION_TYPES]);
  });
});

describe("openapi.yaml: client comments", () => {
  it("documents exactly the comment statuses", () => {
    expect(schemas.CommentStatus?.enum).toEqual([...COMMENT_STATUSES]);
  });
});

describe("openapi.yaml documents every mounted route", () => {
  const documented = new Set(
    Object.entries(doc.paths).flatMap(([path, item]) => Object.keys(item).filter((k) => k !== "parameters").map((m) => `${m.toUpperCase()} ${path}`)),
  );

  for (const [prefix, router] of MOUNTED) {
    for (const route of routesOf(prefix, router)) {
      it(route, () => {
        expect(documented.has(route), `${route} is served but missing from openapi.yaml`).toBe(true);
      });
    }
  }
});
