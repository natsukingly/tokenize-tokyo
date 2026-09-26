# Beyond Tokyo — closing demo

Open **City preview** in the app sidebar, or go directly to `/cities`.

- **Tokyo / New York / Hong Kong** select real OpenFreeMap city maps with OSM building geometry. Drag to explore, use +/− to zoom and **Reset map view** to restore the presentation camera.
- **Play city tour** shows Tokyo → New York → Hong Kong, spending nine seconds per city and stopping after Hong Kong. Manual selection or leaving the tab pauses the tour.
- Direct links: `/cities#tokyo`, `/cities#new-york`, `/cities#hong-kong`. Reload and browser history preserve the chosen city. Arrow keys, Home and End work on the city tabs; reduced-motion preferences disable camera animation.
- **Explore Tokyo demo** returns to the wallet-free simulator. The preview itself does not connect a wallet, send transactions, register ENS names or change demo holdings.

## Suggested closing (20–25 seconds)

Start the tour after the Tokyo asset lifecycle demo:

> We started in Tokyo, but the building blocks can travel. A rooftop in New York, or an underused space in Hong Kong, could use the same approach: identify the space, give its rights a readable ENS identity, and connect capital to productive use. These cities are expansion previews. Tokyo is our starting point.

日本語:

> 今回は東京から始めました。でも、この仕組みは他の都市にも応用できます。ニューヨークの屋上にも、香港の空きスペースにも。場所を特定し、ENSで権利に読める名前を付け、活用するための資金につなげる。海外は今後の展開イメージです。東京は、その出発点です。

## What the preview demonstrates

The map is global, and the registry represents locations through `geoReference` and metadata rather than a hardcoded city. The preview supplies city camera settings and illustrative use cases. It does **not** supply overseas asset listings, verified ownership, registered overseas ENS namespaces or deployed overseas markets. Building geometry and heights depend on OpenStreetMap coverage. Each launch still needs local assets, operators and terms.

Relevant code:

- Route and metadata: `src/app/cities/page.tsx`
- City switching, deep links and tour: `src/components/CityShowcase.tsx`
- Map rendering and recovery: `src/components/CityShowcaseMap.tsx`
- City presets: `src/lib/cities.ts`
- Sidebar entry: `src/components/CityPreviewLink.tsx`
- Interaction tests: `tests/cities.spec.ts`

The route needs internet access for map tiles. Rehearse each city once before presenting. If tiles fail, the city explanation stays available and **Retry map** reloads the map.

Validation: `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 npx playwright test tests/cities.spec.ts`. Automated interaction tests mock the remote map style for determinism; verify real city geometry separately in a browser before presenting.
