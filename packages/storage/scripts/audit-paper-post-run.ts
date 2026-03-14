/**
 * Post-run audit: counts + engineState + logs by message.
 * ENV: GOOGLE_APPLICATION_CREDENTIALS, ENGINE_INSTANCE_ID
 */
import { readFileSync } from "fs";
import { cert, initializeApp, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

async function main(): Promise<void> {
  const path = process.env["GOOGLE_APPLICATION_CREDENTIALS"];
  const iid = process.env["ENGINE_INSTANCE_ID"] ?? "default";
  if (!path) throw new Error("GOOGLE_APPLICATION_CREDENTIALS");
  const k = JSON.parse(readFileSync(path, "utf8"));
  if (!getApps().length) initializeApp({ credential: cert(k) });
  const db = getFirestore();

  const es = await db.collection("engineState").doc(iid).get();
  console.log(JSON.stringify({ section: "engineState", exists: es.exists }, null, 0));
  if (es.exists) {
    const d = es.data()!;
    const lease = d["leaderLeaseUntil"] as { toMillis?: () => number } | undefined;
    const lbt = d["lastBarCloseTime"] as Record<string, unknown> | undefined;
    const keys = lbt ? Object.keys(lbt) : [];
    console.log(
      JSON.stringify(
        {
          leaderHolderId: d["leaderHolderId"],
          leaderLeaseUntil_ms: lease?.toMillis?.() ?? null,
          leaderLeaseUntil_future: lease?.toMillis ? lease.toMillis() > Date.now() : null,
          emergencyHalt: d["emergencyHalt"],
          lastBarCloseTime_keys: keys,
          lastBarCloseTime_sample: keys.slice(0, 5).reduce(
            (o, k) => ({ ...o, [k]: lbt![k] }),
            {} as Record<string, unknown>
          ),
        },
        null,
        2
      )
    );
  }

  async function countCollection(name: string): Promise<number> {
    const ag = await db.collection(name).count().get();
    return ag.data().count;
  }

  for (const col of ["logs", "orders", "fills", "positions", "idempotencyKeys"]) {
    const total = await countCollection(col);
    console.log(JSON.stringify({ collection: col, total_docs: total }, null, 0));
  }

  // Logs: message histogram (up to 2000 docs — enough for 3h if only bootstrap+fills)
  const logSnap = await db.collection("logs").orderBy("time", "desc").limit(500).get();
  const byMsg: Record<string, number> = {};
  let oldest: FirebaseFirestore.Timestamp | null = null;
  let newest: FirebaseFirestore.Timestamp | null = null;
  for (const doc of logSnap.docs) {
    const m = (doc.data() as { message?: string }).message ?? "?";
    byMsg[m] = (byMsg[m] ?? 0) + 1;
    const t = doc.data().time as FirebaseFirestore.Timestamp | undefined;
    if (t?.toMillis) {
      if (!newest) newest = t;
      oldest = t;
    }
  }
  console.log(
    JSON.stringify(
      {
        logs_sample_size: logSnap.size,
        logs_message_histogram: byMsg,
        logs_time_span_note: "newest=first in desc order; oldest=last in batch",
        logs_newest_ms: newest?.toMillis?.() ?? null,
        logs_oldest_in_batch_ms: oldest?.toMillis?.() ?? null,
      },
      null,
      2
    )
  );

  const paperFills = await db.collection("logs").where("message", "==", "paper_fill").limit(20).get();
  console.log(JSON.stringify({ paper_fill_log_docs_sample: paperFills.size }, null, 0));

  const barAuditMsgs = [
    "closed_4h_bar_detected",
    "bar_pipeline_duplicate_skip",
    "bar_processed",
    "paper_exit_placed",
    "strategy_hold_long",
    "paper_fill",
  ];
  const barCounts: Record<string, number> = {};
  for (const m of barAuditMsgs) {
    const c = await db.collection("logs").where("message", "==", m).count().get();
    barCounts[m] = c.data().count;
  }
  const esData = es.exists ? es.data()! : null;
  const lbtKeys = esData
    ? Object.keys((esData["lastBarCloseTime"] as Record<string, unknown>) ?? {})
    : [];
  const barProc = await db.collection("logs").where("message", "==", "bar_processed").limit(80).get();
  const outcomes: Record<string, number> = {};
  for (const doc of barProc.docs) {
    try {
      const j = JSON.parse(String((doc.data() as { contextJson?: string }).contextJson ?? "{}")) as {
        outcome?: string;
      };
      const o = j.outcome ?? "?";
      outcomes[o] = (outcomes[o] ?? 0) + 1;
    } catch {
      outcomes["parse_err"] = (outcomes["parse_err"] ?? 0) + 1;
    }
  }
  console.log(JSON.stringify({ bar_processed_outcome_histogram: outcomes }, null, 2));

  console.log(
    JSON.stringify(
      {
        bar_close_audit: {
          closed_4h_bar_detected_count: barCounts["closed_4h_bar_detected"],
          bar_processed_count: barCounts["bar_processed"],
          paper_fill_count: barCounts["paper_fill"],
          lastBarCloseTime_nonEmpty: lbtKeys.length > 0,
        },
        verdict:
          lbtKeys.length > 0 && barCounts["bar_processed"]! + barCounts["closed_4h_bar_detected"]! > 0
            ? "closed_bar_path_observed"
            : lbtKeys.length > 0
              ? "lastBarCloseTime_updated_maybe_older_run"
              : barCounts["closed_4h_bar_detected"]! > 0
                ? "detected_but_engineState_not_updated_yet"
                : "no_closed_bar_firestore_audit_yet",
      },
      null,
      2
    )
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
