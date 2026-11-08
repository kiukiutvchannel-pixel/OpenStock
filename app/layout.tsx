import type { Metadata } from "next";
import { Plus_Jakarta_Sans, IBM_Plex_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import {Toaster} from "@/components/ui/sonner";
import OntoLaunchCard from "@/components/OntoLaunchCard";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-jakarta",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: {
    default: "穩步 SteadyTrade",
    template: "%s | 穩步",
  },
  description: "穩步 SteadyTrade 是基於 OpenStock（AGPL-3.0）修改的看盤工具。模擬交易只供練習，不是券商，也不是投資建議。",
  applicationName: "穩步 SteadyTrade",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icons/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export default function RootLayout({
                                       children,
                                   }: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="zh-Hant" className="dark">
            <body
                className={`${jakarta.variable} ${plexMono.variable} font-sans antialiased`}
            >
                {children}
                <Toaster/>
                <OntoLaunchCard />
                <Analytics />
            </body>
        </html>
    );
}
