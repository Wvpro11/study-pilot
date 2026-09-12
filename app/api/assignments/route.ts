import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { assignments } from "@/db/schema";
import { routeError, userIdFrom } from "../helpers";

export async function GET(request: Request) {
  try {
    const userId = userIdFrom(request);
    const rows = await getDb().select().from(assignments)
      .where(and(eq(assignments.userId, userId), eq(assignments.status, "open")))
      .orderBy(asc(assignments.dueDate), asc(assignments.id));
    return Response.json({ assignments: rows });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = await request.json() as { title?: string; course?: string; dueDate?: string; estimatedMinutes?: number };
    const title = payload.title?.trim() ?? "";
    const course = payload.course?.trim() ?? "";
    const dueDate = payload.dueDate ?? "";
    const estimatedMinutes = Math.min(480, Math.max(10, Number(payload.estimatedMinutes) || 30));
    if (!title || !course || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) {
      return Response.json({ error: "Assignment, class, and due date are required." }, { status: 400 });
    }
    const [assignment] = await getDb().insert(assignments).values({
      userId: userIdFrom(request), title, course, dueDate, estimatedMinutes,
    }).returning();
    return Response.json({ assignment }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
