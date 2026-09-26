import {
  ArrowRight,
  ArrowDownToLine,
  Landmark,
  LockKeyhole,
} from "lucide-react";
import styles from "./LendingPreview.module.css";

export function ComingSoonBadge() {
  return <span className={styles.badge}>Coming soon</span>;
}

export default function LendingPreview({
  onPreview,
}: {
  onPreview?: () => void;
}) {
  if (onPreview)
    return (
      <section className={styles.teaser} aria-label="Upcoming asset tools">
        <Landmark className={styles.icon} size={24} aria-hidden="true" />
        <div>
          <div className={styles.titleRow}>
            <h2>Lending &amp; borrowing</h2>
            <ComingSoonBadge />
          </div>
          <p>
            More ways to use your tokens and tokenized rights. Planned for a
            future release.
          </p>
        </div>
        <button className={styles.previewButton} onClick={onPreview}>
          Preview lending <ArrowRight size={15} aria-hidden="true" />
        </button>
      </section>
    );

  return (
    <section className={styles.preview} aria-label="Lending preview">
      <header>
        <div className={styles.titleRow}>
          <Landmark className={styles.icon} size={24} aria-hidden="true" />
          <h2>Lending</h2>
          <ComingSoonBadge />
        </div>
        <p>A planned credit market for tokens and tokenized rights.</p>
      </header>
      <div className={styles.options}>
        <article>
          <ArrowDownToLine size={24} aria-hidden="true" />
          <h3>Lend tokens</h3>
          <p>
            Supply eligible tokens to future lending markets and manage your
            lending positions alongside your other assets.
          </p>
          <button disabled>Lending — coming soon</button>
        </article>
        <article>
          <LockKeyhole size={24} aria-hidden="true" />
          <h3>Borrow against rights</h3>
          <p>
            Explore borrowing against eligible tokenized rights. Supported
            collateral and borrowing terms will be defined before launch.
          </p>
          <button disabled>Borrowing — coming soon</button>
        </article>
      </div>
      <p className={styles.availability}>
        Lending deposits and loans are not available yet.
      </p>
    </section>
  );
}
