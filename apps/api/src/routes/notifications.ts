import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { requireAuth } from "../plugins/auth.js";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../lib/errors.js";

async function notificationsRoutes(app: FastifyInstance) {
  app.get("/api/v1/notifications", async (request) => {
    const user = requireAuth(request);
    const cursor = (request.query as { cursor?: string }).cursor;
    const limit = 30;

    const rows = await prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor
        ? {
            cursor: { id: cursor },
            skip: 1,
          }
        : {}),
    });

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    return {
      notifications: items.map((n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        body: n.body,
        payload: n.payload,
        read_at: n.readAt?.toISOString() ?? null,
        created_at: n.createdAt.toISOString(),
      })),
      next_cursor: hasMore ? items[items.length - 1]?.id ?? null : null,
    };
  });

  app.get("/api/v1/notifications/unread-count", async (request) => {
    const user = requireAuth(request);
    const count = await prisma.notification.count({
      where: { userId: user.id, readAt: null },
    });
    return { count };
  });

  app.post("/api/v1/notifications/:id/read", async (request) => {
    const user = requireAuth(request);
    const { id } = request.params as { id: string };
    const notification = await prisma.notification.findFirst({
      where: { id, userId: user.id },
    });
    if (!notification) throw new AppError(404, "not_found", "Notification not found");
    await prisma.notification.update({
      where: { id },
      data: { readAt: new Date() },
    });
    return { ok: true };
  });

  app.post("/api/v1/notifications/read-all", async (request) => {
    const user = requireAuth(request);
    await prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  });
}

export default fp(notificationsRoutes, { name: "notifications-routes" });
