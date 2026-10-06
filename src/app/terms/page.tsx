import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Terms of Service · OuttaTime" };

export default function Terms() {
  return (
    <LegalPage title="Terms of Service">
      <p>By signing in to OuttaTime you agree to these terms.</p>

      <h2>The service</h2>
      <p>
        OuttaTime lets you track time across projects and export reports. It is provided free of charge, “as is”,
        without warranties of any kind. Features may change or be discontinued.
      </p>

      <h2>Your account</h2>
      <p>
        You sign in with your Google account and are responsible for activity under it. Use the app only for lawful
        purposes and don’t attempt to access other users’ data or disrupt the service.
      </p>

      <h2>Your data</h2>
      <p>
        You own the information you enter. We store it only to provide the service, as described in the{" "}
        <a href="/privacy" className="text-blue-400 hover:underline">
          Privacy Policy
        </a>
        . Keep your own copies of important reports; we are not liable for lost data.
      </p>

      <h2>Limitation of liability</h2>
      <p>
        To the extent permitted by law, the app owner is not liable for any indirect or consequential damages arising
        from use of the service, including reliance on time totals or reports.
      </p>

      <h2>Changes</h2>
      <p>These terms may be updated. Continuing to use the app after changes means you accept them.</p>
    </LegalPage>
  );
}
