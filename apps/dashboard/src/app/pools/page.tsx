import { PoolsPage } from "@/components/PoolsPage";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Liquidity Pools | Native Collateral Credit Lines",
  description: "View and deposit into protocol liquidity pools.",
};

export default function Pools() {
  return <PoolsPage />;
}
