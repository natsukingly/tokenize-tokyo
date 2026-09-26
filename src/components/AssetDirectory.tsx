"use client";

import { useState } from "react";
import { ArrowUpRight, Search, ShieldCheck, X } from "lucide-react";
import { formatEther } from "viem";
import { ASSET_KINDS } from "@/lib/catalog";
import type { Asset, Listing, Right } from "@/lib/model";
import MapThumbnail from "./MapThumbnail";
import AssetDetailsDialog from "./AssetDetailsDialog";
import styles from "./AssetDirectory.module.css";

export type DirectoryFilters = {
  search: string;
  kind: string;
  status: string;
  sort: string;
};
export const DEFAULT_DIRECTORY_FILTERS: DirectoryFilters = {
  search: "",
  kind: "All types",
  status: "All states",
  sort: "name",
};

export default function AssetDirectory({
  assets,
  rights,
  filters,
  onFiltersChange,
  listingsFor,
  stage,
  onView,
  demo,
}: {
  assets: Asset[];
  rights: Right[];
  filters: DirectoryFilters;
  onFiltersChange: (filters: DirectoryFilters) => void;
  listingsFor: (asset: Asset) => Listing[];
  stage: (asset: Asset) => string;
  onView: (id: string) => void;
  demo: boolean;
}) {
  const [detailId, setDetailId] = useState<string | null>(null);
  const detailAsset = assets.find((asset) => asset.id === detailId);
  const search = filters.search.trim().toLocaleLowerCase();
  const rows = assets
    .map((asset) => {
      const assetRights = rights.filter((right) => right.assetId === asset.id);
      const listings = listingsFor(asset);
      const price = listings.reduce<bigint | null>((minimum, listing) => {
        const value = BigInt(listing.unitPrice);
        return minimum === null || value < minimum ? value : minimum;
      }, null);
      const secondary = listings.some((listing) => {
        const right = assetRights.find((right) => right.id === listing.rightId);
        return (
          right && listing.seller.toLowerCase() !== right.issuer.toLowerCase()
        );
      });
      return {
        asset,
        rights: [...new Set(assetRights.map((right) => right.kind))],
        status: asset.status === "Verified" ? stage(asset) : asset.status,
        price,
        secondary,
      };
    })
    .filter(
      ({ asset, status, secondary }) =>
        (!search ||
          `${asset.name} ${asset.district}`
            .toLocaleLowerCase()
            .includes(search)) &&
        (filters.kind === "All types" || asset.kind === filters.kind) &&
        (filters.status === "All states" ||
          status === filters.status ||
          (filters.status === "Secondary Market" && secondary)),
    )
    .sort((a, b) => {
      if (filters.sort !== "name") {
        // Assets without an offer stay at the end in either price direction.
        if (a.price === null && b.price !== null) return 1;
        if (b.price === null && a.price !== null) return -1;
        if (a.price !== null && b.price !== null && a.price !== b.price) {
          const order = a.price < b.price ? -1 : 1;
          return filters.sort === "price-asc" ? order : -order;
        }
      }
      return a.asset.name.localeCompare(b.asset.name);
    });
  const hasFilters =
    !!filters.search ||
    filters.kind !== "All types" ||
    filters.status !== "All states";

  return (
    <section className={styles.directory} aria-label="Asset directory">
      <div className={styles.toolbar}>
        <label className={styles.search}>
          <span>Find a space</span>
          <div>
            <Search size={16} aria-hidden="true" />
            <input
              aria-label="Find a space"
              type="search"
              placeholder="Name or district"
              value={filters.search}
              onChange={(e) =>
                onFiltersChange({ ...filters, search: e.target.value })
              }
            />
          </div>
        </label>
        <label>
          <span>Asset type</span>
          <select
            aria-label="Asset type"
            value={filters.kind}
            onChange={(e) =>
              onFiltersChange({ ...filters, kind: e.target.value })
            }
          >
            <option>All types</option>
            {ASSET_KINDS.map((kind) => (
              <option key={kind}>{kind}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Asset state</span>
          <select
            aria-label="Asset state"
            value={filters.status}
            onChange={(e) =>
              onFiltersChange({ ...filters, status: e.target.value })
            }
          >
            {[
              "All states",
              "Available",
              "Funding",
              "Funded",
              "Active",
              "Secondary Market",
              "Dormant",
              "Draft",
              "Pending verification",
              "Rejected",
            ].map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </label>
        <label>
          <span>Sort by</span>
          <select
            aria-label="Sort by"
            value={filters.sort}
            onChange={(e) =>
              onFiltersChange({ ...filters, sort: e.target.value })
            }
          >
            <option value="name">Name A–Z</option>
            <option value="price-asc">Price: low to high</option>
            <option value="price-desc">Price: high to low</option>
          </select>
        </label>
      </div>
      <div className={styles.summary}>
        <p aria-live="polite">
          <strong>{rows.length}</strong> of {assets.length} registered spaces
        </p>
        {hasFilters ? (
          <button
            onClick={() =>
              onFiltersChange({
                ...DEFAULT_DIRECTORY_FILTERS,
                sort: filters.sort,
              })
            }
          >
            <X size={13} /> Clear filters
          </button>
        ) : (
          <span>
            {demo
              ? "Demo assets · simulated verification"
              : "Market data · MultiBaas"}
          </span>
        )}
      </div>
      {rows.length ? (
        <table className={styles.table} aria-label="Registered assets">
          <thead>
            <tr>
              <th scope="col">Space</th>
              <th scope="col">Rights</th>
              <th scope="col">State</th>
              <th scope="col">Offer price</th>
              <th scope="col">
                <span className={styles.srOnly}>View details</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ asset, rights, status, price }) => (
              <tr
                key={asset.id}
                className={styles.clickableRow}
                onClick={(event) => {
                  if ((event.target as HTMLElement).closest("button, a"))
                    return;
                  if (window.getSelection()?.toString()) return;
                  event.currentTarget
                    .querySelector("button")
                    ?.focus({ preventScroll: true });
                  setDetailId(asset.id);
                }}
              >
                <td className={styles.space}>
                  <div className={styles.identity}>
                    <MapThumbnail
                      coordinates={asset.coordinates}
                      kind={asset.kind}
                      compact
                    />
                    <div>
                      <button
                        className={styles.detailLink}
                        aria-label={`View details for ${asset.name}`}
                        onClick={() => setDetailId(asset.id)}
                      >
                        <strong>{asset.name}</strong>
                      </button>
                      <span>{asset.district}</span>
                      <small>
                        {asset.kind} · {asset.area.toLocaleString()} m²
                        {asset.simulated ? " · Demo" : ""}
                      </small>
                    </div>
                  </div>
                </td>
                <td className={styles.rights} data-label="Rights">
                  {rights.length ? rights.join(" / ") : "Not issued yet"}
                </td>
                <td className={styles.state} data-label="State">
                  <span className={styles.stateName}>{status}</span>
                  {asset.status === "Verified" && (
                    <small>
                      <ShieldCheck size={12} />{" "}
                      {demo ? "Demo verified" : "Asset verified"}
                    </small>
                  )}
                </td>
                <td className={styles.price} data-label="Offer price">
                  {price === null ? (
                    <span className={styles.unlisted}>Not listed</span>
                  ) : (
                    <>
                      <strong>
                        <small>From </small>
                        {Number(formatEther(price)).toLocaleString("en-US", {
                          maximumFractionDigits: 2,
                        })}
                      </strong>
                      <small>mJPY / right unit</small>
                    </>
                  )}
                </td>
                <td className={styles.action}>
                  <button
                    aria-label={`View ${asset.name} on map`}
                    onClick={() => onView(asset.id)}
                  >
                    View on map <ArrowUpRight size={15} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className={styles.empty}>
          <Search size={24} />
          <h2>
            {assets.length
              ? "No spaces match these filters."
              : "No registered spaces yet."}
          </h2>
          <p>
            {assets.length
              ? "Try another name, district or asset type."
              : "Registered spaces will appear here as they are added."}
          </p>
          {hasFilters && (
            <button onClick={() => onFiltersChange(DEFAULT_DIRECTORY_FILTERS)}>
              Clear filters
            </button>
          )}
        </div>
      )}
      {detailAsset && (
        <AssetDetailsDialog
          asset={detailAsset}
          rights={rights.filter((right) => right.assetId === detailAsset.id)}
          listings={listingsFor(detailAsset)}
          status={
            detailAsset.status === "Verified"
              ? stage(detailAsset)
              : detailAsset.status
          }
          onClose={() => setDetailId(null)}
          onView={() => {
            setDetailId(null);
            onView(detailAsset.id);
          }}
        />
      )}
      <p className={styles.note}>
        Prices are for the listed rights, not ownership of the building. Open a
        space to review its period, purpose and transfer terms.
      </p>
      <p className={styles.attribution}>
        Map data: ©{" "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          OpenStreetMap
        </a>
        {" · "}
        <a href="https://openmaptiles.org" target="_blank" rel="noreferrer">
          OpenMapTiles
        </a>
        {" · "}
        <a href="https://openfreemap.org" target="_blank" rel="noreferrer">
          OpenFreeMap
        </a>
      </p>
    </section>
  );
}
