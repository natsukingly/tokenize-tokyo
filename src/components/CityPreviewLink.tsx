import { Globe2 } from "lucide-react";
import styles from "./CityPreviewLink.module.css";

export default function CityPreviewLink() {
  return (
    <a
      href="/cities"
      className={styles.link}
      title="City preview"
      aria-label="City preview"
    >
      <Globe2 size={18} aria-hidden="true" />
      <span>City preview</span>
    </a>
  );
}
