import type { Metadata } from "next";
import "./globals.css";
import WalletProviders from "@/components/WalletProviders";

export const metadata: Metadata = {
  title: "StockForge — Options & Basket ETFs on Tokenised Stocks",
  description:
    "P2P options desk and custom basket ETFs for tokenised equities on Solana.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <WalletProviders>{children}</WalletProviders>
      </body>
    </html>
  );
}
