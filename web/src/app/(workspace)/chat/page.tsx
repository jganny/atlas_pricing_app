"use client";

import { Suspense } from "react";
import { TeamChat } from "@/components/chat/TeamChat";

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <TeamChat />
    </Suspense>
  );
}
