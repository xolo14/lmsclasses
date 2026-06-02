import { GETClassRecordings, POSTClassRecording } from "@/lib/api-trash-recordings";

export async function GET(request: Request) {
  return GETClassRecordings(request);
}

export async function POST(request: Request) {
  return POSTClassRecording(request);
}
