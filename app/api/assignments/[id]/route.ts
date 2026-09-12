import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { assignments } from "@/db/schema";
import { routeError, userIdFrom } from "../../helpers";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const numericId = Number(id);
    if (!Number.isInteger(numericId)) return Response.json({ error: "Invalid assignment." }, { status: 400 });
    const [assignment] = await getDb().update(assignments)
      .set({ status: "complete", completedAt: new Date().toISOString() })
      .where(and(eq(assignments.id, numericId), eq(assignments.userId, userIdFrom(request))))
      .returning();
    if (!assignment) return Response.json({ error: "Assignment not found." }, { status: 404 });
    return Response.json({ assignment });
  } catch (error) {
    return routeError(error);
  }
}
