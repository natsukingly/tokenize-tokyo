import { ArrowRight, Wallet, LoaderCircle } from "lucide-react";
import styles from "./AccountGate.module.css";

export default function AccountGate({
  connected,
  loading,
  error = "",
  title = "Your assets, in one place",
  description = "See what you own, collect available income, and manage your listings.",
  onConnect,
  onRetry,
}: {
  connected: boolean;
  loading: boolean;
  error?: string;
  title?: string;
  description?: string;
  onConnect: () => void;
  onRetry: () => void;
}) {
  return (
    <section className={styles.gate} aria-label="Account access">
      {connected && loading ? (
        <LoaderCircle
          size={26}
          className="spin"
          aria-label="Loading your holdings"
        />
      ) : (
        <Wallet size={26} aria-hidden="true" />
      )}
      <h2>
        {connected
          ? error
            ? "Your assets could not be loaded"
            : "Loading your assets"
          : title}
      </h2>
      <p>
        {connected
          ? error ||
            "Checking the connected address. Your holdings will appear here."
          : description}
      </p>
      {connected ? (
        <button className="secondary" onClick={onRetry} disabled={loading}>
          {loading ? "Checking holdings…" : "Try again"}
        </button>
      ) : (
        <button className="secondary" onClick={onConnect}>
          Connect wallet to continue <ArrowRight size={16} />
        </button>
      )}
      {!connected && (
        <small>Connecting is free. It does not buy or transfer anything.</small>
      )}
    </section>
  );
}
