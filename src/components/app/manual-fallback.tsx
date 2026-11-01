"use client";
import { useTransition } from "react";
import { startManualBrand } from "@/app/actions/projects";
import { Button } from "@/components/ui/button";

export function ManualFallbackButton({ projectId, label = "Enter brand details manually" }: { projectId: string; label?: string }) {
  const [pending, start] = useTransition();
  return (
    <Button variant="secondary" size="lg" disabled={pending} onClick={() => start(() => startManualBrand(projectId))}>
      {pending ? "Opening…" : label}
    </Button>
  );
}
