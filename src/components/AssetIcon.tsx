import {
  Sun,
  House,
  Trees,
  ParkingSquare,
  Warehouse,
  PanelTop,
  Building2,
} from "lucide-react";
import type { AssetKind } from "@/lib/catalog";
export default function AssetIcon({
  kind,
  size = 20,
}: {
  kind: AssetKind;
  size?: number;
}) {
  const Icon = {
    Rooftop: Sun,
    "Vacant Home": House,
    "Idle Land": Trees,
    Parking: ParkingSquare,
    Storage: Warehouse,
    Advertising: PanelTop,
    Other: Building2,
  }[kind];
  return <Icon size={size} />;
}
