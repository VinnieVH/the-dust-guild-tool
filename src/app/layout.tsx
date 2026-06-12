import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "The Dust — Guild Tool",
  description: "Raid signups, soft-reserves, and achievements for the guild.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/*
         * Side-gutter scenery. Fixed behind everything, only shown once the
         * viewport is wide enough that empty space opens beside the centered
         * content column (max-w-5xl = 64rem). Each panel is the width of one
         * gutter; the fel atmosphere fades inward so it never competes with the
         * content. Decorative: no pointer events, hidden from the a11y tree.
         */}
        <div
          aria-hidden
          className="pointer-events-none fixed inset-0 -z-10 hidden justify-between xl:flex"
        >
          <div className="fel-gutter fel-gutter--left h-full w-[max(0px,calc((100vw-64rem)/2))]" />
          <div className="fel-gutter fel-gutter--right h-full w-[max(0px,calc((100vw-64rem)/2))]" />
        </div>
        <SiteHeader />
        <main className="flex-1">{children}</main>
      </body>
    </html>
  );
}
