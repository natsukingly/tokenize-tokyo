"use client";

import { useEffect, useRef } from "react";
import { ArrowUpRight, X } from "lucide-react";
import { formatEther } from "viem";
import type { Asset, Listing, Right } from "@/lib/model";
import { parseMetadata } from "@/lib/model";
import MapThumbnail from "./MapThumbnail";
import { useWalletConnection } from "./WalletConnection";
import {
  AssetReview,
  RightReview,
  OfferPurchase,
  type AssetDetailsActions,
} from "./AssetDetailsActions";
import styles from "./AssetDetailsDialog.module.css";

export default function AssetDetailsDialog({
  asset,
  rights,
  listings,
  status,
  onClose,
  onView,
  actions,
}: {
  asset: Asset;
  rights: Right[];
  listings: Listing[];
  status: string;
  onClose: () => void;
  onView: () => void;
  actions: AssetDetailsActions;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const backdropPress = useRef(false);
  const wallet = useWalletConnection();
  const walletModalOpen = wallet.access?.modalOpen === true;
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const opener = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
      opener?.focus({ preventScroll: true });
    };
  }, []);
  // Native dialogs sit above portals. Temporarily yield the top layer to Privy
  // for login/signing, then restore the same review form when it closes.
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (walletModalOpen) element.close();
    else if (!element.open) {
      element.showModal();
      title.current?.focus();
    }
  }, [walletModalOpen]);
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
          <div className={styles.account}>{actions.walletControl}</div>
          <div className={styles.feedback}>{actions.feedback}</div>
          <section>
            <h3>About this space</h3>
            <p className={styles.description}>
              {asset.description ||
                "No project description has been added yet."}
            </p>
            <details className={styles.evidence}>
              <summary>Asset evidence & issuer</summary>
              <p>
                {String(
                  parseMetadata(asset.metadataURI).evidence ||
                    "No evidence reference provided.",
                )}
              </p>
              <code>{asset.issuer}</code>
            </details>
            <AssetReview asset={asset} actions={actions} />
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
                      {typeof terms.purpose === "string"
                        ? terms.purpose
                        : typeof terms.description === "string"
                          ? terms.description
                          : right.kind === "Revenue Share"
                            ? "A share of income deposited by this project. Returns are not guaranteed."
                            : "Permission to use this space under the right’s terms."}
                    </p>
                    <dl className={styles.terms}>
                      <div>
                        <dt>Scope</dt>
                        <dd>
                          {[
                            "Rooftop",
                            "Interior",
                            "Wall",
                            "Land",
                            "Whole asset",
                          ][right.scope] || "Unspecified"}{" "}
                          · {right.exclusive ? "Exclusive" : "Non-exclusive"}
                        </dd>
                      </div>
                      <div>
                        <dt>Transfer policy</dt>
                        <dd>{right.policy}</dd>
                      </div>
                      <div>
                        <dt>Total supply</dt>
                        <dd>{right.supply} units</dd>
                      </div>
                    </dl>
                    <details className={styles.evidence}>
                      <summary>Full terms & evidence</summary>
                      {Object.entries(terms).map(([key, value]) => (
                        <p key={key}>
                          <b>{key}:</b>{" "}
                          {typeof value === "string"
                            ? value
                            : JSON.stringify(value)}
                        </p>
                      ))}
                      <p>
                        Issuer: <code>{right.issuer}</code>
                      </p>
                      <p>
                        Terms hash: <code>{right.termsHash}</code>
                      </p>
                      {!Object.keys(terms).length && (
                        <p>
                          Terms reference: <code>{right.termsURI}</code>
                        </p>
                      )}
                    </details>
                    {actions.ready && (
                      <p>
                        You hold {actions.balances[`rights:${right.id}`] || "0"}{" "}
                        {actions.balances[`rights:${right.id}`] === "1"
                          ? "unit"
                          : "units"}{" "}
                        of this right.
                      </p>
                    )}
                    <RightReview
                      right={right}
                      actions={actions}
                      assetVerified={asset.status === "Verified"}
                    />
                    {offers.length ? (
                      offers.map((offer) => (
                        <div className={styles.offerCard} key={offer.id}>
                          <div className={styles.offer}>
                            <b>
                              {Number(
                                formatEther(BigInt(offer.unitPrice)),
                              ).toLocaleString("en")}{" "}
                              mJPY <small>/ unit</small>
                            </b>
                            <span>
                              {offer.remaining}{" "}
                              {offer.remaining === "1" ? "unit" : "units"}{" "}
                              available
                            </span>
                          </div>
                          <p className={styles.seller}>
                            Seller: <code>{offer.seller}</code>
                          </p>
                          <OfferPurchase
                            key={`${actions.account}:${offer.id}:${offer.unitPrice}:${right.termsHash}`}
                            listing={offer}
                            actions={actions}
                          />
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
          <span>Explore this space in its neighborhood.</span>
          <button onClick={onView}>
            View on map <ArrowUpRight size={16} />
          </button>
        </footer>
      </div>
    </dialog>
  );
}
