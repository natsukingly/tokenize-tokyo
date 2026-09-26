import { notFound } from "next/navigation";
import TransactionExplorer from "@/components/TransactionExplorer";
import { isTxHash } from "@/lib/wallet";
export default async function Page({
  params,
}: {
  params: Promise<{ hash: string }>;
}) {
  const { hash } = await params;
  if (!isTxHash(hash)) notFound();
  return <TransactionExplorer hash={hash} />;
}
