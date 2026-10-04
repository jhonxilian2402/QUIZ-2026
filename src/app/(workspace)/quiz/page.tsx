import type { Metadata } from "next";
import { QuizWorkspace } from "@/components/quiz/QuizWorkspace";

export const metadata: Metadata = {
  title: "Quiz",
};

export default function QuizPage() {
  return <QuizWorkspace />;
}