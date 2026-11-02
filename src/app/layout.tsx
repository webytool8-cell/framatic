import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Framatic — AI creative production studio", template: "%s · Framatic" },
  description: "Turn your store, product or app into scroll-stopping video ads, written, storyboarded and set to music by AI.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-paper text-ink antialiased">{children}</body>
    </html>
  );
}
