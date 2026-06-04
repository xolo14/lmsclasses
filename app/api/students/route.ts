import { GETStudents, POSTStudent } from "@/lib/api-handlers";

export const runtime = "nodejs";
export const maxDuration = 60;

export const GET = GETStudents;
export const POST = POSTStudent;
