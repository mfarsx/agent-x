import Link from "next/link";
import styles from "./app-shell.module.css";

export function Brand() {
  return (
    <Link href="/" className={styles.brand}>
      <span className={styles.brandMark} aria-hidden="true">
        AX
      </span>
      <span className={styles.brandText}>Agent X</span>
    </Link>
  );
}
