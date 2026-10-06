import type { Metadata } from "next";
import { LegalPage } from "@/components/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy · OuttaTime" };

export default function Privacy() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        OuttaTime is a personal time tracker. This page explains what information it stores and how that information is
        used.
      </p>

      <h2>Information we collect</h2>
      <ul>
        <li>
          <strong>From Google sign-in:</strong> your name, email address, and profile picture. We do not receive your
          Google password and do not access any other Google data.
        </li>
        <li>
          <strong>Information you enter:</strong> your timezone, project names, time entries (start and stop times),
          and the reports you generate.
        </li>
      </ul>

      <h2>How we use it</h2>
      <p>
        Your information is used only to run the app: to sign you in, keep your data separate from other users, show
        your timers across browsers and devices, and build your reports. We do not sell your information, use it for
        advertising, or share it with third parties, except the service providers that host the app (Vercel) and its
        database (Neon).
      </p>

      <h2>Who can see your data</h2>
      <p>Your projects, time entries, and reports are private to your account. Other users cannot see them.</p>

      <h2>Cookies</h2>
      <p>OuttaTime uses a single sign-in cookie to keep you logged in. It does not use tracking or advertising cookies.</p>

      <h2>Keeping and deleting data</h2>
      <p>
        Your data is kept while you use the app. You can delete individual reports, projects, and time entries at any
        time. To delete your account and all of its data, contact the app owner.
      </p>

      <h2>Changes</h2>
      <p>If this policy changes, the date at the top of this page will be updated.</p>
    </LegalPage>
  );
}
