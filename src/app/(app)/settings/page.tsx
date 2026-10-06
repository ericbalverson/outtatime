import { signOutAction } from "@/app/actions";
import { TimezoneForm } from "@/components/TimezoneForm";
import { requireOnboardedUser } from "@/lib/session";

export default async function Settings() {
  const user = await requireOnboardedUser();
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="text-2xl font-semibold text-zinc-50">Settings</h1>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <h2 className="text-sm font-medium text-zinc-200">Account</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Signed in as <span className="text-zinc-200">{user.email}</span>
        </p>
        <form action={signOutAction} className="mt-4">
          <button className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 transition hover:border-zinc-500 hover:text-zinc-50">
            Sign out
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
        <h2 className="text-sm font-medium text-zinc-200">Default timezone</h2>
        <p className="mb-4 mt-1 text-sm text-zinc-400">
          Used for Monday–Sunday work weeks and report timestamps. Existing reports keep the timezone they were created
          with.
        </p>
        <TimezoneForm current={user.timezone} submitLabel="Save timezone" />
      </section>
    </div>
  );
}
