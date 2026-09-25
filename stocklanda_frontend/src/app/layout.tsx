import type { Metadata } from "next";
import { Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "./components/Sidebar";
import Header from "./components/Header";
import MobileNav from "./components/MobileNav";
import WalletProvider from "./components/WalletProvider";

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono" });

export const metadata: Metadata = {
  title: "StockForge | Web3 Pre-IPO Derivatives",
  description: "Trade Pre-IPO equities on-chain with Solana.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} bg-void text-white antialiased`}>
        <WalletProvider>
          <div className="flex flex-col h-screen overflow-hidden">
            {/* Header spans the full width at the very top */}
            <Header />

            {/* Content row: Sidebar on the left, Main viewport on the right */}
            <div className="flex flex-1 min-h-0 overflow-hidden">
              <Sidebar />
              <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 pb-24 md:pb-8">
                {children}
              </main>
            </div>

            <MobileNav />
          </div>
        </WalletProvider>
      </body>
    </html>
  );
}