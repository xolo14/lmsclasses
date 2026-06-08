import { auth } from "@/lib/auth";
import { DashboardPage } from "@/components/pages/DashboardPage";

export default async function Page() {
  const session = await auth();
  return <DashboardPage scope="global" userRole={session?.user.role} />;
}
