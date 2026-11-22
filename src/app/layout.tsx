import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Returned Parts Scorecard",
  description: "Triage returned parts and sync diagnosis status to Part Documentation.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
