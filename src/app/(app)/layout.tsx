import { NavLinks } from "@/components/NavLinks";
import { requireOnboardedUser } from "@/lib/session";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireOnboardedUser();
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-zinc-800/80 bg-zinc-950/85 backdrop-blur print:hidden">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
          <span className="text-sm font-semibold tracking-tight text-zinc-50">
            Outta<span className="text-blue-400">Time</span>
          </span>
          <NavLinks />
          <div className="ml-auto flex items-center gap-2">
            {user.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.image} alt="" className="h-7 w-7 rounded-full" referrerPolicy="no-referrer" />
            ) : (
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 text-xs text-zinc-300">
                {(user.name ?? user.email ?? "?").slice(0, 1).toUpperCase()}
              </span>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 has-[[data-fit]]:max-w-none sm:py-8">{children}</main>
    </div>
  );
}
