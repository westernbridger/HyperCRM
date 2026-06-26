"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isBookingPage = pathname.startsWith("/book");

  if (isBookingPage) {
    return (
      <div className="fixed inset-0 z-[9999] bg-background overflow-y-auto">
        {children}
        <div className="py-6 text-center">
          <Link
            href="/login"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Powered by HyperCRM
          </Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
