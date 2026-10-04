import type { Metadata, Viewport } from "next";
import { APP_NAME } from "@/lib/content";
import "./app.css";

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} — AI study workspace`,
    template: `%s · ${APP_NAME}`,
  },
  description:
    "AI workspace for generating, practising and reviewing quizzes. Frontend foundation phase.",
};

export const viewport: Viewport = {
  themeColor: "#0c0c0e",
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}