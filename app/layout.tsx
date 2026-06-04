import type { Metadata } from "next";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { fontSans, fontMono } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "LMS Platform",
  description: "Learning Management System",
  icons: {
    icon: "/lms-logo.png",
    apple: "/lms-logo.png",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover" as const,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${fontSans.variable} ${fontMono.variable}`}>
      <body className="font-sans antialiased">
        <AuthProvider>
          <QueryProvider>{children}</QueryProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
