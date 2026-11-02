/** Emails allowed to see /admin pages: FRAMATIC_ADMIN_EMAILS, comma-separated. */
export function isAdminEmail(email: string | null | undefined): boolean {
  const list = (process.env.FRAMATIC_ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return !!email && list.includes(email.toLowerCase());
}
