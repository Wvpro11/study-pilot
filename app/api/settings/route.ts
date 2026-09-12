import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { plannerSettings } from "@/db/schema";
import { routeError, userIdFrom } from "../helpers";

const defaults = { availableMinutes: 120, sessionMinutes: 35 };

export async function GET(request: Request) {
  try {
    const [settings] = await getDb().select().from(plannerSettings)
      .where(eq(plannerSettings.userId, userIdFrom(request))).limit(1);
    return Response.json({ settings: settings ?? defaults });
  } catch (error) {
    return routeError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const payload = await request.json() as { availableMinutes?: number; sessionMinutes?: number };
    const availableMinutes = Math.min(720, Math.max(15, Number(payload.availableMinutes) || 120));
    const sessionMinutes = Math.min(120, Math.max(15, Number(payload.sessionMinutes) || 35));
    const userId = userIdFrom(request);
    const [settings] = await getDb().insert(plannerSettings).values({ userId, availableMinutes, sessionMinutes })
      .onConflictDoUpdate({ target: plannerSettings.userId, set: { availableMinutes, sessionMinutes, updatedAt: new Date().toISOString() } })
      .returning();
    return Response.json({ settings });
  } catch (error) {
    return routeError(error);
  }
}
