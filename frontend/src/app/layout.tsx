import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "@/components/SessionProvider";
import { ThemeToggle } from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "TubeSync — Watch Together",
  description:
    "Create a watch party room, share the 6-letter code, and enjoy YouTube videos in perfect sync with friends.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col">
        <SessionProvider>
          <ThemeToggle />
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}
