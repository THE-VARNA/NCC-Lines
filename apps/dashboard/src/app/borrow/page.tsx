import { BorrowPage } from "@/components/BorrowPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Open Credit Line | Native Collateral Credit Lines",
  description: "Open a confidential BTC-backed USDC credit line with FHE-encrypted LTV checks.",
};

export default function Borrow() {
  return <BorrowPage />;
}
