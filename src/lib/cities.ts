export const CITIES = [
  {
    id: "tokyo",
    name: "Tokyo",
    localName: "東京",
    country: "Japan",
    district: "Marunouchi · Chiyoda",
    coordinates: [139.7655, 35.6805] as [number, number],
    zoom: 15.3,
    bearing: -28,
    opportunity: "A new life for the rooftop.",
    description:
      "An unused roof becomes a community solar project. Define the space, fund the installation and share the revenue it generates.",
    useCases: ["Rooftop solar", "Community spaces", "Revenue sharing"],
    stage: "The starting point",
  },
  {
    id: "new-york",
    name: "New York",
    localName: "NYC",
    country: "United States",
    district: "Lower Manhattan",
    coordinates: [-74.0086, 40.7069] as [number, number],
    zoom: 15.2,
    bearing: -25,
    opportunity: "More possibility in every block.",
    description:
      "Imagine neighborhood rooftops funding shared energy, or an empty storefront becoming a space the community can use and support.",
    useCases: ["Shared energy", "Pop-up spaces", "Usage rights"],
    stage: "Expansion preview",
  },
  {
    id: "hong-kong",
    name: "Hong Kong",
    localName: "香港",
    country: "Hong Kong",
    district: "Central · Hong Kong Island",
    coordinates: [114.1588, 22.2819] as [number, number],
    zoom: 15.4,
    bearing: -30,
    opportunity: "Let every square meter do more.",
    description:
      "Imagine underused terraces and commercial spaces becoming bookable places, with clear usage rights and shared project revenue.",
    useCases: ["Shared terraces", "Flexible spaces", "Revenue sharing"],
    stage: "Expansion preview",
  },
] as const;

export type ShowcaseCity = (typeof CITIES)[number];
