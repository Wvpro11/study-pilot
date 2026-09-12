export function userIdFrom(request: Request) {
  return request.headers.get("oai-authenticated-user-id") ?? "local-owner";
}

export function routeError(error: unknown) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  const missingTable = message.includes("no such table");
  return Response.json(
    { error: missingTable ? "Your planner storage is still being prepared. Please try again shortly." : "Could not save that change. Please try again." },
    { status: 500 },
  );
}
