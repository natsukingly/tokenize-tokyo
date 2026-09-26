"use client";

import { useEffect, useRef } from "react";
import { ArrowUpRight, X } from "lucide-react";
import { formatEther } from "viem";
import type { Asset, Listing, Right } from "@/lib/model";
import { parseMetadata } from "@/lib/model";
import MapThumbnail from "./MapThumbnail";
import styles from "./AssetDetailsDialog.module.css";

export default function AssetDetailsDialog({
  asset,
  rights,
  listings,
  status,
  onClose,
  onView,
}: {
  asset: Asset;
  rights: Right[];
  listings: Listing[];
  status: string;
  onClose: () => void;
  onView: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const backdropPress = useRef(false);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const opener = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = "hidden";
    title.current?.focus();
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
      opener?.focus({ preventScroll: true });
    };
  }, []);
  const date = (seconds: number) =>
    new Date(seconds * 1000).toISOString().slice(0, 10);
  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby="directory-asset-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onPointerDown={(event) => {
        backdropPress.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (backdropPress.current && event.target === event.currentTarget)
          onClose();
        backdropPress.current = false;
      }}
    >
      <div className={styles.surface}>
        <header>
          <MapThumbnail
            coordinates={asset.coordinates}
            kind={asset.kind}
            compact
          />
          <div>
            <p>{asset.district}</p>
            <h2 id="directory-asset-title" ref={title} tabIndex={-1}>
              {asset.name}
            </h2>
            <p>
              {asset.kind} · {asset.area.toLocaleString()} m² · {status}
            </p>
          </div>
          <button
            className="icon-button"
            aria-label="Close space details"
            onClick={onClose}
          >
            <X size={20} />
          </button>
        </header>
        <div className={styles.body}>
          <section>
            <h3>About this space</h3>
            <p className={styles.description}>
              {asset.description ||
                "No project description has been added yet."}
            </p>
          </section>
          <section>
            <h3>Rights & offers</h3>
            {rights.length ? (
              rights.map((right) => {
                const offers = listings.filter(
                  (listing) =>
                    listing.rightId === right.id &&
                    !listing.cancelled &&
                    BigInt(listing.remaining) > 0n,
                );
                const terms = parseMetadata(right.termsURI);
                return (
                  <article className={styles.right} key={right.id}>
                    <strong>
                      {right.kind} <small>#{right.id}</small>
                    </strong>
                    <span>
                      {right.status} · {date(right.startAt)} –{" "}
                      {date(right.endAt)} (UTC)
                    </span>
                    <p>
                      {typeof terms.description === "string"
                        ? terms.description
                        : right.kind === "Revenue Share"
                          ? "A share of income deposited by this project. Returns are not guaranteed."
                          : "Permission to use this space under the right’s terms."}
                    </p>
                    {offers.length ? (
                      offers.map((offer) => (
                        <div className={styles.offer} key={offer.id}>
                          <b>
                            {Number(
                              formatEther(BigInt(offer.unitPrice)),
                            ).toLocaleString("en")}{" "}
                            mJPY <small>/ unit</small>
                          </b>
                          <span>{offer.remaining} units available</span>
                        </div>
                      ))
                    ) : (
                      <span>No active offer</span>
                    )}
                  </article>
                );
              })
            ) : (
              <p>No rights have been issued for this space yet.</p>
            )}
          </section>
          <p className={styles.note}>
            Test asset · Simulated verification · mJPY has no monetary value.
          </p>
        </div>
        <footer>
          <span>Explore the location and review available actions.</span>
          <button onClick={onView}>
            View on map <ArrowUpRight size={16} />
          </button>
        </footer>
      </div>
    </dialog>
  );
}
