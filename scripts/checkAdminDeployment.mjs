#!/usr/bin/env node
/**
 * Safe production smoke test for the operator console.
 * Uses GET endpoints only; never sends credentials or modifies game data.
 */
const defaultOrigin = "https://court-legacy.utiltoools.workers.dev";
const origin = (
  process.argv[2] ??
  process.env.COURT_LEGACY_URL ??
  defaultOrigin
).replace(/\/+$/, "");

function stop(message, code = 1) {
  console.error(`[admin:check] ${message}`);
  process.exitCode = code;
}

async function inspect(path) {
  const url = new URL(path, `${origin}/`);
  const response = await fetch(url, {
    method: "GET",
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(12000),
    redirect: "error",
  });
  const type = response.headers.get("content-type") ?? "";
  let body = null;
  if (type.includes("application/json")) {
    try {
      body = await response.json();
    } catch {
      // Invalid response is handled by the caller.
    }
  }
  return { status: response.status, body, type };
}

try {
  const health = await inspect("/api/health");
  if (health.status !== 200 || health.body?.status !== "ok") {
    stop(
      `公開Workerの応答が不正です（/api/health: HTTP ${health.status}）。Cloudflareの公開URLとデプロイを確認してください。`,
    );
  } else {
    console.log("[admin:check] Worker API: 正常");
    const session = await inspect("/api/admin/session");
    if (
      session.status === 404 ||
      (session.type.includes("text/html") && session.status === 200)
    ) {
      stop(
        "管理APIが公開されていません。main の最新デプロイを確認してください。",
        3,
      );
    } else if (
      session.status === 503 &&
      session.body?.error?.code === "admin_not_configured"
    ) {
      stop(
        "管理APIは配信済みですが、CloudflareのADMIN_PASSWORD / ADMIN_SESSION_SECRETが未設定です。",
        2,
      );
    } else if (
      session.status !== 200 ||
      session.body?.authenticated !== false
    ) {
      stop(`管理者セッションAPIの応答が想定外です（HTTP ${session.status}）。`);
    } else {
      console.log("[admin:check] 管理者セッションAPI: 正常（秘密設定あり）");
      const blocked = await inspect("/api/admin/overview");
      if (
        blocked.status !== 401 ||
        blocked.body?.error?.code !== "admin_unauthorized"
      ) {
        stop(
          `管理APIの未認証アクセス制御を確認してください（HTTP ${blocked.status}）。`,
        );
      } else {
        console.log("[admin:check] 管理集計APIの未認証ブロック: 正常");
        console.log("[admin:check] 公開環境の基本確認が完了しました。");
      }
    }
  }
} catch (error) {
  stop(
    `公開Workerに接続できません（${error instanceof Error ? error.name : "unknown error"}）。公開URL、ネットワーク、Cloudflareの状態を確認してください。`,
  );
}
