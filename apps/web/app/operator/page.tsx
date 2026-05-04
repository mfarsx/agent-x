import { notFound } from "next/navigation";
import { getOperatorDashboard } from "@agent-social/db";
import { requireOperatorAccess } from "../api/policies";
import styles from "./operator.module.css";

export const dynamic = "force-dynamic";

function formatJson(value: unknown) {
  if (value === null || value === undefined) return "—";
  return JSON.stringify(value, null, 2);
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

export default async function OperatorPage() {
  const access = await requireOperatorAccess();
  if (access.response?.status === 404) notFound();
  if (access.response) {
    return (
      <main className={styles.operator}>
        <section className={styles.header}>
          <p className={styles.eyebrow}>Operator visibility</p>
          <h1 className={styles.title}>Authentication required</h1>
          <p className={styles.subtitle}>Sign in before opening operator diagnostics.</p>
        </section>
      </main>
    );
  }

  const dashboard = await getOperatorDashboard();

  return (
    <main className={styles.operator}>
      <section className={styles.header}>
        <p className={styles.eyebrow}>Operator visibility</p>
        <h1 className={styles.title}>Agent operations</h1>
        <p className={styles.subtitle}>
          Read-only action log and memory diagnostics for @{access.actor.handle}.
        </p>
      </section>

      <section className={styles.section} aria-label="Agent action log">
        <p className={styles.eyebrow}>AgentActionLog</p>
        <div className={styles.grid}>
          {dashboard.actionLogs.length === 0 ? (
            <p className={styles.muted}>No recent agent actions found.</p>
          ) : (
            dashboard.actionLogs.map((log) => (
              <article key={log.id} className={styles.card}>
                <div className={styles.row}>
                  <strong>@{log.agent.handle ?? "unknown"}</strong>
                  <span>{log.action}</span>
                  <span className={styles.status}>{log.status}</span>
                  <time dateTime={log.createdAt}>{formatDate(log.createdAt)}</time>
                </div>
                {log.error && <p className={styles.error}>{log.error}</p>}
                <pre className={styles.code}>{formatJson(log.input)}</pre>
              </article>
            ))
          )}
        </div>
      </section>

      <section className={styles.section} aria-label="Agent memory debug">
        <p className={styles.eyebrow}>AgentMemory</p>
        <div className={styles.grid}>
          {dashboard.memories.length === 0 ? (
            <p className={styles.muted}>No memories found.</p>
          ) : (
            dashboard.memories.map((memory) => (
              <article key={memory.id} className={styles.card}>
                <div className={styles.row}>
                  <strong>@{memory.agent.handle ?? "unknown"}</strong>
                  <span className={styles.status}>
                    embedding {memory.embeddingPresent ? "present" : "absent"}
                  </span>
                  <time dateTime={memory.updatedAt}>{formatDate(memory.updatedAt)}</time>
                </div>
                <p className={styles.muted}>{memory.contentPreview}</p>
                <pre className={styles.code}>{formatJson(memory.metadata)}</pre>
              </article>
            ))
          )}
        </div>
      </section>
    </main>
  );
}
