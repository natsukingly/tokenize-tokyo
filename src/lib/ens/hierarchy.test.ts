import { afterEach, expect, it, vi } from "vitest";
import { ACTORS, demoState } from "../demo";
import {
  filterNamespaces,
  flattenNamespaces,
  namespaceHierarchy,
  PREVIEW_PARENT,
} from "./hierarchy";

afterEach(() => vi.unstubAllGlobals());
function fixture() {
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn() });
  return demoState(ACTORS["Investor B"]);
}
it("builds multiple scopes and right leaves under one asset, not duplicate buildings", () => {
  const state = fixture();
  state.rights.push({
    ...state.rights[0],
    id: "1000",
    scope: 1,
    kind: "Usage Right",
  });
  const root = namespaceHierarchy(state.assets, state.rights);
  const nodes = flattenNamespaces(root);
  expect(root.name).toBe(PREVIEW_PARENT);
  expect(nodes.filter((n) => n.kind === "Asset")).toHaveLength(
    state.assets.length,
  );
  const building = nodes.find((n) => n.kind === "Asset" && n.assetId === "1")!;
  expect(building.children.map((n) => n.label)).toEqual([
    "rooftop",
    "interior",
  ]);
  expect(building.children[1].children[0].name).toBe(
    "right-1000.interior.building-1.chuo.tokenizetokyo.eth",
  );
  expect(building).not.toHaveProperty("owner");
  expect(building).not.toHaveProperty("registered");
});
it("search retains the complete path to matching rights and distinguishes empty results", () => {
  const state = fixture();
  const root = namespaceHierarchy(state.assets, state.rights);
  const result = filterNamespaces(root, "building-3.taito.tokenizetokyo.eth")!;
  const nodes = flattenNamespaces(result);
  expect(nodes.map((n) => n.kind)).toEqual([
    "City",
    "District",
    "Asset",
    "Space",
    "Right",
  ]);
  expect(nodes.at(-1)?.name).toBe(
    "right-3.interior.building-3.taito.tokenizetokyo.eth",
  );
  expect(filterNamespaces(root, "not-a-matching-space")).toBeNull();
  expect(filterNamespaces(root, "")).toEqual(root);
});
it("handles unissued assets and non-ASCII districts without fabricating right leaves", () => {
  const state = fixture();
  const asset = { ...state.assets[0], id: "99", district: "千代田区" };
  const nodes = flattenNamespaces(namespaceHierarchy([asset], []));
  expect(nodes.map((n) => n.kind)).toEqual([
    "City",
    "District",
    "Asset",
    "Space",
  ]);
  expect(nodes.at(-1)?.name).toMatch(
    /^rooftop\.building-99\.district-[a-f0-9]{8}\.tokenizetokyo\.eth$/,
  );
  expect(
    namespaceHierarchy([{ ...asset, id: "0.bad" }], []).children,
  ).toHaveLength(0);
});
