"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { StatusPill } from "@/components/ui/StatusPill";
import { BrandMark } from "@/components/layout/BrandMark";
import { authService } from "@/lib/api/services";
import { ApiError } from "@/lib/api/client";
import { APP_NAME } from "@/lib/content";
import { useSession } from "./SessionProvider";
import { useToast } from "@/components/ui/Toast";
import styles from "./AuthScreen.module.css";

type Mode = "signin" | "register";

/**
 * Sign-in and registration screen.
 *
 * Uses the same visual language as the workspace: restrained surfaces, the
 * product wordmark and shared controls. Credentials are posted to the API; the
 * session is established by an HTTP-only cookie, so nothing is stored in
 * localStorage.
 */
export function AuthScreen() {
  const { refresh } = useSession();
  const { notify } = useToast();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      if (mode === "register") {
        await authService.register({ email, password, displayName });
        notify({ tone: "success", title: "Account created" });
      } else {
        await authService.login({ email, password });
      }
      // Re-read the session so the shell switches on the server's answer.
      refresh();
    } catch (cause) {
      setError(
        cause instanceof ApiError ? cause.message : "Could not complete that request."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.root}>
      <div className={styles.panel}>
        <div className={styles.brand}>
          <BrandMark size={26} />
          <span className={styles.brandName}>{APP_NAME}</span>
        </div>

        <div className={styles.heading}>
          <h1 className={styles.title}>
            {mode === "signin" ? "Sign in" : "Create your account"}
          </h1>
          <p className={styles.description}>
            {mode === "signin"
              ? "Your conversations, quizzes and preferences are stored on your account."
              : "An account is required to store conversations, quizzes and preferences."}
          </p>
        </div>

        <form className={styles.form} onSubmit={onSubmit} noValidate>
          {mode === "register" ? (
            <Field label="Display name" htmlFor="auth-name">
              <Input
                id="auth-name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Your name"
                autoComplete="name"
                required
              />
            </Field>
          ) : null}

          <Field label="Email" htmlFor="auth-email">
            <Input
              id="auth-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              autoComplete="email"
              required
              autoFocus
            />
          </Field>

          <Field
            label="Password"
            htmlFor="auth-password"
            hint={mode === "register" ? "At least 10 characters." : undefined}
          >
            <Input
              id="auth-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Your password"
              autoComplete={mode === "register" ? "new-password" : "current-password"}
              required
            />
          </Field>

          {error ? (
            <p className={styles.error} role="alert">
              {error}
            </p>
          ) : null}

          <Button
            type="submit"
            variant="primary"
            size="md"
            fullWidth
            loading={submitting}
          >
            {mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <div className={styles.switch}>
          <span className={styles.switchText}>
            {mode === "signin"
              ? "No account yet?"
              : "Already have an account?"}
          </span>
          <button
            type="button"
            className={styles.switchAction}
            onClick={() => {
              setMode(mode === "signin" ? "register" : "signin");
              setError(null);
            }}
          >
            {mode === "signin" ? "Create one" : "Sign in"}
          </button>
        </div>

        <div className={styles.footer}>
          <StatusPill tone="muted" dot>
            Sessions use secure HTTP-only cookies
          </StatusPill>
        </div>
      </div>
    </div>
  );
}