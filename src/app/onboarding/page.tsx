import { redirect } from "next/navigation";
import { TimezoneForm } from "@/components/TimezoneForm";
import { requireUser } from "@/lib/session";

export default async function Onboarding() {
  const user = await requireUser();
  if (user.timezone) redirect("/dashboard");

  return (
    <main className="flex min-h-dvh items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900/60 p-8 shadow-2xl">
        <h1 className="text-xl font-semibold text-zinc-50">Welcome{user.name ? `, ${user.name.split(" ")[0]}` : ""}!</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Choose your default timezone. Work weeks (Monday–Sunday) and report timestamps use it. You can change it later
          in Settings.
        </p>
        <div className="mt-6">
          <TimezoneForm submitLabel="Continue" next="/dashboard" />
        </div>
      </div>
    </main>
  );
}
