import { LoaderCircle, RefreshCw } from "lucide-react";
import styles from "./DataStatus.module.css";

export default function DataStatus({
  error,
  onRetry,
  compact = false,
}: {
  error: string;
  onRetry: () => void;
  compact?: boolean;
}) {
  return (
    <section
      className={`${styles.status} ${compact ? styles.compact : ""}`}
      role={error ? "alert" : "status"}
      aria-busy={!error}
    >
      {!error && (
        <LoaderCircle
          size={compact ? 18 : 28}
          className="spin"
          aria-hidden="true"
        />
      )}
      <div>
        <strong>
          {error ? "Market data could not be loaded" : "Loading market data…"}
        </strong>
        {!compact && (
          <p>
            {error ||
              "Fetching assets, listings, and activity. Figures will appear when the data is ready."}
          </p>
        )}
      </div>
      {error && (
        <button className="secondary" onClick={onRetry}>
          <RefreshCw size={14} /> Retry
        </button>
      )}
    </section>
  );
}
