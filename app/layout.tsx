import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Round Table - AI Discussion Platform",
  description: "Multi-agent AI discussions on any topic",
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
