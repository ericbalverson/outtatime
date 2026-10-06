import { Dashboard } from "@/components/Dashboard";
import { getDashboard } from "@/lib/dashboard";
import { getActiveInstance, requireOnboardedUser } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireOnboardedUser();
  const instance = await getActiveInstance(user.id);
  const data = await getDashboard(user.id, instance.id, user.timezone);
  return (
    <Dashboard
      {...data}
      timezone={user.timezone}
      instance={{ id: instance.id, name: instance.name, startedAt: instance.startedAt.toISOString() }}
    />
  );
}
