import { notFound } from "next/navigation";
import { z } from "zod";
import CardOrderStatus from "@/components/CardOrderStatus";
export const metadata = {
  title: "Your card purchase · TOKENIZE TOKYO",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ cancelled?: string }>;
}) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  return (
    <CardOrderStatus
      id={id}
      returned={(await searchParams).cancelled === "1"}
    />
  );
}
