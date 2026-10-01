import { isDatabaseUp } from "@/server/health";

export const dynamic = "force-dynamic";

export async function GET() {
  if (await isDatabaseUp()) {
    return Response.json({ status: "ok", database: "up" });
  }
  return Response.json({ status: "error", database: "down" }, { status: 503 });
}
