"use client";

import { useState, type ReactNode } from "react";
import { formatEther } from "viem";
import type { Asset, Listing, Right } from "@/lib/model";
import CardPaymentOption from "./CardPaymentOption";
import styles from "./AssetDetailsDialog.module.css";

export type AssetDetailsActions = {
  account: string;
  ready: boolean;
  demo: boolean;
  busy: boolean;
  canVerifyAsset: boolean;
  canVerifyRight: boolean;
  balances: Record<string, string>;
  walletControl: ReactNode;
  feedback: ReactNode;
  onConnect: () => void;
  onPurchase: (
    listing: Listing,
    quantity: string,
    accepted: boolean,
  ) => Promise<boolean>;
  onRequestVerification: (asset: Asset) => Promise<boolean>;
  onReviewAsset: (asset: Asset, approved: boolean) => Promise<boolean>;
  onReviewRight: (right: Right, approved: boolean) => Promise<boolean>;
  onActivateRight: (right: Right) => Promise<boolean>;
};

function ReviewDecision({
  kind,
  busy,
  onReview,
}: {
  kind: "asset" | "right";
  busy: boolean;
  onReview: (approved: boolean) => Promise<boolean>;
}) {
  const [reviewed, setReviewed] = useState(false);
  return (
    <div className={styles.actions}>
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={reviewed}
          disabled={busy}
          onChange={(event) => setReviewed(event.target.checked)}
        />
        {kind === "asset"
          ? "I have reviewed the asset details and evidence."
          : "I have reviewed the right terms, scope and period."}
      </label>
      <div className={styles.buttons}>
        <button
          className="primary"
          disabled={busy || !reviewed}
          onClick={() => onReview(true)}
        >
          Approve {kind}
        </button>
        <button
          className="secondary"
          disabled={busy || !reviewed}
          onClick={() => onReview(false)}
        >
          Reject {kind}
        </button>
      </div>
    </div>
  );
}

export function AssetReview({
  asset,
  actions,
}: {
  asset: Asset;
  actions: AssetDetailsActions;
}) {
  if (
    asset.status === "Draft" &&
    actions.account.toLowerCase() === asset.issuer.toLowerCase()
  )
    return (
      <button
        className="primary"
        disabled={actions.busy || !actions.ready}
        onClick={() => actions.onRequestVerification(asset)}
      >
        Submit for verification
      </button>
    );
  if (asset.status !== "Pending verification") return null;
  return actions.canVerifyAsset ? (
    <ReviewDecision
      key={`${actions.account}:${asset.id}:${asset.metadataURI}`}
      kind="asset"
      busy={actions.busy || !actions.ready}
      onReview={(approved) => actions.onReviewAsset(asset, approved)}
    />
  ) : (
    <p>Awaiting review by an authorized asset verifier.</p>
  );
}

export function RightReview({
  right,
  actions,
  assetVerified,
}: {
  right: Right;
  actions: AssetDetailsActions;
  assetVerified: boolean;
}) {
  if (right.status === "Pending verification")
    return actions.canVerifyRight && assetVerified ? (
      <ReviewDecision
        key={`${actions.account}:${right.id}:${right.termsHash}`}
        kind="right"
        busy={actions.busy || !actions.ready}
        onReview={(approved) => actions.onReviewRight(right, approved)}
      />
    ) : (
      <p>
        Awaiting review by an authorized rights verifier after asset approval.
      </p>
    );
  if (right.status === "Verified" && actions.canVerifyRight && assetVerified)
    return (
      <button
        className="secondary"
        disabled={actions.busy || !actions.ready}
        onClick={() => actions.onActivateRight(right)}
      >
        Activate right
      </button>
    );
  return null;
}

// The parent keys this form by account, terms hash and offer price. Consent never carries
// across a wallet switch or a changed offer, including the card-checkout path.
export function OfferPurchase({
  listing,
  actions,
}: {
  listing: Listing;
  actions: AssetDetailsActions;
}) {
  const [quantity, setQuantity] = useState("1");
  const [accepted, setAccepted] = useState(false);
  const valid =
    /^[1-9]\d{0,11}$/.test(quantity) &&
    BigInt(quantity) <= BigInt(listing.remaining);
  const own =
    !!actions.account &&
    actions.account.toLowerCase() === listing.seller.toLowerCase();
  return (
    <div className={styles.actions}>
      <label className={styles.quantity}>
        Purchase quantity
        <input
          type="number"
          min="1"
          max={listing.remaining}
          step="1"
          value={quantity}
          disabled={actions.busy}
          onChange={(event) => setQuantity(event.target.value)}
        />
      </label>
      <div className={styles.offer}>
        <span>Total</span>
        <b>
          {valid
            ? formatEther(BigInt(listing.unitPrice) * BigInt(quantity))
            : "—"}{" "}
          mJPY
        </b>
      </div>
      {!valid && <p>Choose a whole quantity from 1 to {listing.remaining}.</p>}
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={accepted}
          disabled={actions.busy || own}
          onChange={(event) => setAccepted(event.target.checked)}
        />
        I have reviewed this right and its terms.
      </label>
      <CardPaymentOption
        listing={listing}
        quantity={quantity}
        account={actions.account}
        accepted={accepted}
        demo={actions.demo}
        busy={actions.busy || (!!actions.account && !actions.ready)}
        onConnect={actions.onConnect}
      >
        <button
          className="primary"
          disabled={
            actions.busy ||
            own ||
            !valid ||
            (!!actions.account && (!accepted || !actions.ready))
          }
          onClick={async () => {
            if (!actions.account) return actions.onConnect();
            if (await actions.onPurchase(listing, quantity, accepted)) {
              setAccepted(false);
              setQuantity("1");
            }
          }}
        >
          {!actions.account
            ? "Connect wallet to buy"
            : own
              ? "Your listing"
              : "Acquire right"}
        </button>
      </CardPaymentOption>
    </div>
  );
}
