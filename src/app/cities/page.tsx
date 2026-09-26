import type { Metadata } from "next";
import CityShowcase from "@/components/CityShowcase";

export const metadata: Metadata = {
  title: "Beyond Tokyo — TOKENIZE TOKYO",
  description:
    "Explore Tokyo, New York and Hong Kong. A preview of how urban spaces and programmable rights could connect communities across cities.",
};

export default function CitiesPage() {
  return <CityShowcase />;
}
