import type { Metadata } from "next";
import EnsShowcase from "@/components/EnsShowcase";
export const metadata: Metadata = {
  title: "Space permissions — TOKENIZE TOKYO",
  description:
    "ENSv2 on Sepolia: delegate rooftop rights, restrict energy reporting to one record, and revoke access.",
};
export default function EnsPage() {
  return <EnsShowcase />;
}
