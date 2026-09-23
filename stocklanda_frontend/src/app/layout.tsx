import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Header from "./components/Header";
import Sidebar from "./components/Sidebar";
import MobileNav from "./components/MobileNav";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "StockForge",
  description: "On-chain options and basket ETFs",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${spaceGrotesk.variable} ${jetBrainsMono.variable} antialiased bg-void text-white flex flex-col min-h-screen`}
      >
        <Header />

        <div className="flex flex-1 min-h-0">
          <Sidebar />

          <main className="flex-1 p-4 md:p-8 pb-24 md:pb-8 overflow-y-auto">
            {children}
          </main>
        </div>

        <MobileNav />
      </body>
    </html>
  );
}