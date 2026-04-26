import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { WalletProviders } from "@/components/WalletProviders";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Native Collateral Credit Lines | Confidential BTC Lending",
  description:
    "Institutional-grade confidential credit protocol. Borrow against BTC collateral with FHE-encrypted LTV checks and MPC-secured signing via Ika dWallet.",
  openGraph: {
    title: "Native Collateral Credit Lines",
    description: "Confidential BTC lending powered by Encrypt FHE + Ika dWallet on Solana",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <WalletProviders>{children}</WalletProviders>
      </body>
    </html>
  );
}
