import { GETUsersByRole, POSTUserByRole } from "@/lib/api-handlers";

export async function GET() {
  return GETUsersByRole("manager");
}

export async function POST(request: Request) {
  return POSTUserByRole(request, "manager");
}
