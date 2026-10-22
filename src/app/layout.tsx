import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "채팅방 분석기",
  description: "카카오톡 대화를 요약하고 방장 할 일을 정리합니다",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
