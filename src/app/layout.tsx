import type { Metadata } from "next";
import { Open_Sans } from "next/font/google";
import "./globals.css";
import { AppSidebar } from "@/components/layout/app-sidebar";

const openSans = Open_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "HyperCRM",
  description: "Premium CRM SaaS platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${openSans.variable} h-full antialiased dark`}
    >
      <body className="min-h-full flex bg-background text-foreground font-sans">
        <AppSidebar />
        <main className="flex-1 h-screen overflow-y-auto p-6 md:p-8">{children}</main>
      </body>
    </html>
  );
}
