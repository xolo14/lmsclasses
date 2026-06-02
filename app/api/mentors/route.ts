import { GETUsersByRole, POSTUserByRole } from "@/lib/api-handlers";

export async function GET() {
  return GETUsersByRole("mentor");
}

export async function POST(request: Request) {
  return POSTUserByRole(request, "mentor");
}
