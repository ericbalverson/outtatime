import Link from "next/link";
import { CONTACT_EMAIL, LEGAL_UPDATED } from "@/lib/site";

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-300">
        ← OuttaTime
      </Link>
      <h1 className="mt-4 text-3xl font-semibold text-zinc-50">{title}</h1>
      <p className="mt-1 text-sm text-zinc-500">Last updated {LEGAL_UPDATED}</p>
      <div className="mt-8 space-y-5 text-[15px] leading-relaxed text-zinc-300 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-zinc-100 [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">
        {children}
        {CONTACT_EMAIL && (
          <>
            <h2>Contact</h2>
            <p>
              Questions or requests:{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-blue-400 hover:underline">
                {CONTACT_EMAIL}
              </a>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
