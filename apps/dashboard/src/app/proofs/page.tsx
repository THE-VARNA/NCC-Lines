import { ProofsPage } from "@/components/ProofsPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Proof Explorer | Native Collateral Credit Lines",
  description: "Explore on-chain FHE computation proofs and dWallet signing records.",
};

export default function Proofs() {
  return <ProofsPage />;
}
