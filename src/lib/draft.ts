import "server-only";
import { cookies } from "next/headers";
import { Brief, type Brief as BriefT } from "@/lib/brief";

/**
 * The landing-page brief survives the sign-in step in a short-lived,
 * httpOnly cookie, then /start turns it into a project.
 */
const NAME = "framatic_draft";

export async function saveDraft(brief: BriefT) {
  (await cookies()).set(NAME, JSON.stringify(brief), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24,
  });
}

export async function readDraft(): Promise<BriefT | null> {
  const raw = (await cookies()).get(NAME)?.value;
  if (!raw) return null;
  try {
    const parsed = Brief.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function clearDraft() {
  (await cookies()).delete(NAME);
}
