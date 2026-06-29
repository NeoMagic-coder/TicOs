import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ticosclaw — AI Marketing Platform",
  description: "AI-powered marketing management platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}