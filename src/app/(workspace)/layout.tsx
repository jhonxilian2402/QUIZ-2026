import { AppShell } from "@/components/layout/AppShell";
import { SettingsProvider } from "@/components/settings/SettingsProvider";
import { ToastProvider } from "@/components/ui/Toast";
import { SessionProvider } from "@/components/auth/SessionProvider";
import { AuthGate } from "@/components/auth/AuthGate";

/**
 * App-wide providers.
 *
 * Order matters: the toast provider is outermost so both the session and
 * settings layers can report outcomes; the session resolves before settings,
 * which loads the signed-in user's document; and the auth gate wraps the shell
 * so an unauthenticated visitor sees the sign-in screen instead of the
 * workspace. Authorization itself is enforced by the API.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <SessionProvider>
        <SettingsProvider>
          <AuthGate>
            <AppShell>{children}</AppShell>
          </AuthGate>
        </SettingsProvider>
      </SessionProvider>
    </ToastProvider>
  );
}