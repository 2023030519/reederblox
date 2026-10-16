import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/header";
import { Feedback } from "@/components/feedback";
import { RegisterSW } from "@/components/register-sw";
import { PullToRefresh } from "@/components/pull-to-refresh";
import { FormMemory } from "@/components/form-memory";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: "readerblox",
  description: "Lector de manga y webtoons de obras propias",
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "readerblox" },
};
export const viewport: Viewport = { themeColor: "#be123c" };

// Apply the saved theme and accent before paint to avoid a flash.
const themeScript = `try{var t=localStorage.getItem("theme");if(t)document.documentElement.dataset.theme=t;var a=localStorage.getItem("accent");if(a)document.documentElement.dataset.accent=a}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning className={geist.variable}>
      <head>
        {/* Plain inline script: it runs before first paint, unlike next/script, which can land after it. */}
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-[100dvh]">
        <Header />
        <Feedback />
        <RegisterSW />
        <PullToRefresh />
        <FormMemory />
        <main className="mx-auto max-w-[1100px] px-4 pb-24 pt-6 sm:pb-8 sm:pt-8">{children}</main>
      </body>
    </html>
  );
}
