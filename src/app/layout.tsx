import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Envelope",
  description: "Modern Lead Generation & Outreach",
};


import { Providers } from "@/components/providers/Providers";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${dmSans.variable} ${jetbrains.variable} antialiased`}
        style={{
          fontFamily: 'var(--font-sans)',
          background: 'var(--bg-page)',
          color: 'var(--text-primary)'
        }}
      >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
