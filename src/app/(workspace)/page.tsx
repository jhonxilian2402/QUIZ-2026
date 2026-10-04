import type { Metadata } from "next";
import { ChatHome } from "@/components/chat/ChatHome";

export const metadata: Metadata = {
  title: "Home",
};

export default function HomePage() {
  return <ChatHome />;
}