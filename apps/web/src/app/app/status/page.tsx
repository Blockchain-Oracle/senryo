import type { Metadata } from "next";
import { StatusBoard } from "@/features/status/StatusBoard";

export const metadata: Metadata = { title: "Status" };

export default function StatusPage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
      <h1 className="font-semibold text-page-title">Status</h1>
      <StatusBoard />
    </div>
  );
}
