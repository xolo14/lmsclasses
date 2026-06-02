import { auth } from "@/lib/auth";

export async function useCurrentUser() {
  const session = await auth();
  return session?.user ?? null;
}
