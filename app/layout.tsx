import type { Metadata } from "next";
import "./globals.css";
import Navigation from "@/components/Navigation";

export const metadata: Metadata = {
  title: "圆桌 AI - 多智能体讨论平台",
  description: "让多个 AI 智能体围绕任意主题展开讨论",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <Navigation />
        {children}
      </body>
    </html>
  );
}
