import { expect, test, type BrowserContext, type Page, type Request, type Response } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { Chess } from "chess.js";
import { loadEnvConfig } from "@next/env";
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";
import { resolveStagingAppOrigin } from "./staging-target";
import { redactedPreviewRequest, requireFreshPreviewOidcToken } from "./staging-preview-auth";

loadEnvConfig(process.cwd(), true);
const enabled = process.env.ROOKLINE_STAGING_E2E === "1" && process.env.ROOKLINE_STAGING_LATENCY_E2E === "1";
const stagingProject = "tyvczicinpjixmxgjhjn";
const previewOrigin = enabled ? resolveStagingAppOrigin(process.env.ROOKLINE_STAGING_APP_ORIGIN) : "http://127.0.0.1:3100";
// `vercel env run` injects a short-lived development OIDC token for protected Preview access.
// Send it to this deployment origin only; never attach it to Supabase requests or reports.
const previewToken = process.env.ROOKLINE_STAGING_VERCEL_OIDC_TOKEN || process.env.VERCEL_OIDC_TOKEN;
const previewHeaders: Record<string, string> = previewToken ? { "x-vercel-trusted-oidc-idp-token": previewToken } : {};
const moveCount = process.env.ROOKLINE_STAGING_LATENCY_DEBUG_MOVES === "4" ? 4 : 32;

type MoveSample = {
  ply: number;
  san: string;
  postMs: number;
  postServerAuthMs?: number | null;
  postServerGameMs?: number | null;
  postServerChecksMs?: number | null;
  postServerRulesMs?: number | null;
  postServerRpcMs?: number | null;
  postServerSnapshotMs?: number | null;
  senderBoardMs: number;
  opponentBoardMs: number;
  whiteRealtimeMs: number | null;
  blackRealtimeMs: number | null;
  responseHasSnapshot: boolean;
  opponentGetCount?: number;
  opponentFirstGetStartMs?: number | null;
  opponentFirstGetResponseMs?: number | null;
  opponentGetServerAuthMs?: number | null;
  opponentGetServerSnapshotMs?: number | null;
};

function serverDuration(header: string | undefined, metric: "auth" | "game" | "checks" | "rules" | "rpc" | "snapshot") {
  const value = header?.split(",").map((part) => part.trim())
    .find((part) => part.startsWith(`${metric};dur=`))?.slice(`${metric};dur=`.length);
  if (!value || !/^\d+(?:\.\d+)?$/.test(value)) return null;
  return Number(value);
}

function percentiles(values: number[]) {
  if (values.length === 0) return { n: 0, p50: null, p95: null, max: null };
  const sorted = [...values].sort((a, b) => a - b);
  const at = (percentile: number) => Math.round(sorted[Math.ceil(percentile * sorted.length) - 1]);
  return { n: sorted.length, p50: at(0.5), p95: at(0.95), max: Math.round(sorted[sorted.length - 1]) };
}

// Choose a deterministic, legal continuation; never finish early or depend on a remote opening book.
function preparedLine() {
  const chess = new Chess();
  const opening = ["e4", "e5", "Nf3", "Nc6", "Bb5", "a6", "Ba4", "Nf6", "O-O", "Be7", "Re1", "b5", "Bb3", "d6", "c3", "O-O"];
  const line: Array<{ from: string; to: string; promotion?: string; san: string }> = [];
  for (let ply = 0; ply < moveCount; ply += 1) {
    const moves = chess.moves({ verbose: true });
    const preferred = moves.find((move) => move.san === opening[ply]);
    const candidates = preferred ? [preferred] : moves;
    const choice = candidates.find((move) => {
      chess.move(move);
      const finished = chess.isGameOver();
      chess.undo();
      return !finished;
    });
    if (!choice) throw new Error(`Could not prepare a 32-ply nonterminal game at ply ${ply}`);
    chess.move(choice);
    line.push({ from: choice.from, to: choice.to, promotion: choice.promotion, san: choice.san });
  }
  return line;
}

test("measure 32 actual browser moves and two authenticated Realtime recipients on protected Preview", async ({ browser }) => {
  test.skip(!enabled, "Set ROOKLINE_STAGING_E2E=1 and ROOKLINE_STAGING_LATENCY_E2E=1 explicitly.");
  test.setTimeout(600_000);
  const origin = process.env.ROOKLINE_STAGING_APP_ORIGIN;
  if (!origin || !/^chessonline-[a-z0-9]+-hnquan\.vercel\.app$/.test(new URL(origin).hostname)) {
    throw new Error("Latency test requires an explicit immutable chessonline Preview deployment origin.");
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || new URL(supabaseUrl).hostname !== `${stagingProject}.supabase.co` || !anon || !secret) {
    throw new Error(`Latency test requires the dedicated ${stagingProject} staging credentials.`);
  }
  requireFreshPreviewOidcToken(previewToken);

  const admin = createClient(supabaseUrl, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const nonce = randomBytes(9).toString("hex");
  const password = `${randomBytes(26).toString("base64url")}A1!`;
  const emails = ["white", "black"].map((side) => `rookline-latency-${nonce}-${side}@example.com`);
  const users: string[] = [];
  const contexts: BrowserContext[] = [];
  const sockets: Array<{ removeAllChannels: () => Promise<unknown> }> = [];
  const samples: MoveSample[] = [];
  const received: Array<Map<number, number>> = [new Map(), new Map()];
  const socketStatus: string[][] = [[], []];
  const browserRoomRealtime = Array.from({ length: 2 }, () => ({
    opens: 0, joins: 0, joinOk: 0, changes: 0, closed: 0,
    joinBindings: [] as number[], joinHasAuth: [] as boolean[], replyBindings: [] as number[],
    replyStatuses: [] as string[], allChangeFrames: 0, authFramesSent: 0,
  }));
  let gameId: string | null = null;
  let outcome = "incomplete";
  const startedAt = new Date().toISOString();

  async function signIn(context: BrowserContext, email: string) {
    const page = await context.newPage();
    await page.goto("/login?next=%2Fplay%2Fonline");
    await page.getByRole("textbox", { name: "Email" }).fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Sign in", exact: true }).click();
    await expect(page).toHaveURL(/\/play\/online$/);
    return page;
  }

  function countBoardMoves(page: Page, ply: number) {
    return page.waitForFunction((expected) => {
      const history = document.querySelector('[aria-label="Move history"]');
      return history !== null && [...history.querySelectorAll("strong")].filter((node) => node.textContent?.trim()).length >= expected;
    }, ply, { timeout: 20_000 });
  }

  try {
    // Probe the exact deployment before creating remote users or game fixtures.
    const probe = await browser.newContext({ baseURL: previewOrigin });
    contexts.push(probe);
    const landing = await redactedPreviewRequest("login preflight", () =>
      probe.request.get("/login", { headers: previewHeaders, timeout: 12_000 }));
    const landingHtml = await redactedPreviewRequest("login body read", () => landing.text());
    if (landing.status() !== 200 || !landingHtml.includes("Rookline")) {
      const title = landingHtml.match(/<title[^>]*>([^<]{0,100})<\/title>/i)?.[1] ?? "unknown";
      const path = new URL(landing.url()).pathname;
      const protectedPage = /Vercel Authentication|Deployment Protection|_vercel\/sso|Login\s*[–—-]\s*Vercel/i.test(landingHtml);
      throw new Error(`Preview preflight failed: HTTP ${landing.status()}, path ${path}, title ${title}, protectionPage ${protectedPage}, oidcPresent ${Boolean(previewToken)}. No staging fixtures created.`);
    }
    await probe.close();
    contexts.pop();

    for (const email of emails) {
      const { data, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true, user_metadata: { display_name: "Rookline staging latency" },
      });
      if (error || !data.user) throw new Error(`Unable to create staging identity: ${error?.message ?? "no user"}`);
      users.push(data.user.id);
    }

    for (let i = 0; i < 2; i += 1) {
      const context = await browser.newContext({ baseURL: previewOrigin });
      contexts.push(context);
      if (previewToken) {
        await context.route("**/*", (route) => {
          if (new URL(route.request().url()).origin !== previewOrigin) return route.continue();
          return route.continue({ headers: { ...route.request().headers(), ...previewHeaders } });
        });
      }
    }
    const [white, black] = await Promise.all([signIn(contexts[0], emails[0]), signIn(contexts[1], emails[1])]);
    const created = await redactedPreviewRequest("game creation", () => contexts[0].request.post("/api/games", {
      headers: { ...previewHeaders, Origin: previewOrigin }, data: { control: "10+0" },
    }));
    expect(created.status(), "staging game create").toBe(201);
    gameId = (await created.json()).id as string;
    const joined = await redactedPreviewRequest("game join", () => contexts[1].request.post(`/api/games/${gameId}/join`, {
      headers: { ...previewHeaders, Origin: previewOrigin },
    }));
    expect(joined.status(), "staging game join").toBe(200);

    for (const [index, page] of [white, black].entries()) {
      page.on("websocket", (socket) => {
        if (!socket.url().includes("/realtime/v1/websocket")) return;
        const stats = browserRoomRealtime[index];
        stats.opens += 1;
        const safeEnvelope = (payload: string | Buffer) => {
          if (typeof payload !== "string") return null;
          try {
            const value = JSON.parse(payload);
            return {
              topic: Array.isArray(value) ? value[2] : value.topic,
              event: Array.isArray(value) ? value[3] : value.event,
              status: Array.isArray(value) ? value[4]?.status : value.payload?.status,
              // Inspect binding metadata only. Never record JWTs, frame bodies, or row values.
              joinBindingCount: Array.isArray(value) ? value[4]?.config?.postgres_changes?.length : value.payload?.config?.postgres_changes?.length,
              joinHasAuth: Boolean(Array.isArray(value) ? value[4]?.access_token : value.payload?.access_token),
              replyBindingCount: Array.isArray(value) ? value[4]?.response?.postgres_changes?.length : value.payload?.response?.postgres_changes?.length,
            };
          } catch { return null; }
        };
        socket.on("framesent", (frame) => {
          const event = safeEnvelope(frame.payload);
          if (event?.event === "access_token") stats.authFramesSent += 1;
          if (event?.event === "phx_join" && typeof event.topic === "string" && event.topic.includes("rookline-room-")) {
            stats.joins += 1;
            stats.joinBindings.push(event.joinBindingCount ?? -1);
            stats.joinHasAuth.push(event.joinHasAuth);
          }
        });
        socket.on("framereceived", (frame) => {
          const event = safeEnvelope(frame.payload);
          if (event?.event === "postgres_changes") stats.allChangeFrames += 1;
          if (!event || typeof event.topic !== "string" || !event.topic.includes("rookline-room-")) return;
          if (event.event === "phx_reply") {
            if (event.status === "ok") stats.joinOk += 1;
            stats.replyStatuses.push(event.status ?? "unknown");
            stats.replyBindings.push(event.replyBindingCount ?? -1);
          }
          if (event.event === "postgres_changes") stats.changes += 1;
        });
        socket.on("close", () => { stats.closed += 1; });
      });
    }

    await Promise.all([white.goto(`/game/${gameId}`), black.goto(`/game/${gameId}`)]);
    await Promise.all([
      expect(white.getByRole("heading", { name: "Your game room" })).toBeVisible(),
      expect(black.getByRole("heading", { name: "Your game room" })).toBeVisible(),
    ]);
    // Keep the benchmark comparable across all 32 moves: both browser rooms
    // must have joined with auth and a PostgreSQL change binding before play.
    await expect.poll(() => browserRoomRealtime.every((room) =>
      room.joinOk > 0 && room.joinBindings.includes(1) && room.joinHasAuth.includes(true)),
      { timeout: 15_000, intervals: [100, 200] }).toBe(true);

    for (let i = 0; i < 2; i += 1) {
      const client = createClient(supabaseUrl, anon, { auth: { persistSession: false, autoRefreshToken: false } });
      sockets.push(client);
      const { error } = await client.auth.signInWithPassword({ email: emails[i], password });
      if (error) throw new Error(`Realtime identity ${i} failed: ${error.message}`);
      const channel = client.channel(`rookline-latency-${nonce}-${i}`).on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${gameId}`,
      }, (payload) => {
        const ply = payload.new.ply;
        if (typeof ply === "number" && !received[i].has(ply)) received[i].set(ply, performance.now());
      });
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error(`Realtime subscription ${i} timed out`)), 15_000);
        channel.subscribe((status) => {
          socketStatus[i].push(status);
          if (status === "SUBSCRIBED") { clearTimeout(timeout); resolve(); }
          if (["CHANNEL_ERROR", "CLOSED", "TIMED_OUT"].includes(status)) {
            clearTimeout(timeout);
            reject(new Error(`Realtime subscription ${i}: ${status}`));
          }
        });
      });
    }

    for (const [index, move] of preparedLine().entries()) {
      const ply = index + 1;
      const sender = index % 2 === 0 ? white : black;
      const opponent = index % 2 === 0 ? black : white;
      const input = sender.getByLabel(/Keyboard move/);
      await expect(input, `turn at ply ${ply}`).toBeEnabled({ timeout: 15_000 });
      await input.fill(move.from + move.to + (move.promotion ?? ""));
      const responseReady = sender.waitForResponse((response) =>
        response.request().method() === "POST" && response.url().endsWith(`/api/games/${gameId}/move`), { timeout: 25_000 });
      // Record only anonymous timings, to distinguish missed Realtime wakeups
      // from a slow canonical read on the opponent's browser.
      const opponentReads: Array<{
        request: Request; start: number; response?: number; serverAuthMs?: number | null; serverSnapshotMs?: number | null;
      }> = [];
      const readTarget = `/api/games/${gameId}`;
      const onOpponentRequest = (request: Request) => {
        if (request.method() === "GET" && new URL(request.url()).pathname === readTarget) {
          opponentReads.push({ request, start: performance.now() });
        }
      };
      const onOpponentResponse = (response: Response) => {
        const entry = opponentReads.find((item) => item.request === response.request());
        if (entry) {
          entry.response = performance.now();
          const serverTiming = response.headers()["server-timing"];
          entry.serverAuthMs = serverDuration(serverTiming, "auth");
          entry.serverSnapshotMs = serverDuration(serverTiming, "snapshot");
        }
      };
      opponent.on("request", onOpponentRequest);
      opponent.on("response", onOpponentResponse);
      const start = performance.now();
      const responsePromise = responseReady.then((response) => ({ response, at: performance.now() }));
      const senderBoard = countBoardMoves(sender, ply).then(() => performance.now());
      const opponentBoard = countBoardMoves(opponent, ply).then(() => performance.now());
      await sender.getByRole("button", { name: "Move", exact: true }).click();
      const [{ response, at: responseAt }, senderAt, opponentAt] = await Promise.all([
        responsePromise, senderBoard, opponentBoard,
      ]);
      opponent.off("request", onOpponentRequest);
      opponent.off("response", onOpponentResponse);
      expect(response.status(), `move ${ply} (${move.san})`).toBe(200);
      const body = await response.json();
      expect(body.status, `move ${ply} (${move.san})`).toBe("accepted");
      const postServerTiming = response.headers()["server-timing"];
      await expect.poll(() => received.every((side) => side.has(ply)), {
        timeout: 3_000, intervals: [50, 100, 200],
      }).toBe(true).catch(() => undefined);
      samples.push({
        ply, san: move.san,
        postMs: Math.round(responseAt - start),
        postServerAuthMs: serverDuration(postServerTiming, "auth"),
        postServerGameMs: serverDuration(postServerTiming, "game"),
        postServerChecksMs: serverDuration(postServerTiming, "checks"),
        postServerRulesMs: serverDuration(postServerTiming, "rules"),
        postServerRpcMs: serverDuration(postServerTiming, "rpc"),
        postServerSnapshotMs: serverDuration(postServerTiming, "snapshot"),
        senderBoardMs: Math.round(senderAt - start),
        opponentBoardMs: Math.round(opponentAt - start),
        whiteRealtimeMs: received[0].has(ply) ? Math.round(received[0].get(ply)! - start) : null,
        blackRealtimeMs: received[1].has(ply) ? Math.round(received[1].get(ply)! - start) : null,
        responseHasSnapshot: body.game?.id === gameId,
        opponentGetCount: opponentReads.length,
        opponentFirstGetStartMs: opponentReads[0] ? Math.round(opponentReads[0].start - start) : null,
        opponentFirstGetResponseMs: opponentReads[0]?.response ? Math.round(opponentReads[0].response - start) : null,
        opponentGetServerAuthMs: opponentReads[0]?.serverAuthMs ?? null,
        opponentGetServerSnapshotMs: opponentReads[0]?.serverSnapshotMs ?? null,
      });
    }
    outcome = "completed";
    expect(samples).toHaveLength(moveCount);
    expect(browserRoomRealtime.every((room) => room.changes === moveCount),
      "both browser game rooms must receive every authorized move update").toBe(true);
  } finally {
    // Only timings and build information are persisted: never credentials, emails or user IDs.
    const report = {
      recordedAt: new Date().toISOString(), startedAt, outcome, origin: previewOrigin,
      testLocation: "Windows Codex runner (local host; browser contexts share this machine)",
      moveCountRequested: moveCount, movesRecorded: samples.length,
      percentiles: {
        post: percentiles(samples.map((s) => s.postMs)),
        postServerAuth: percentiles(samples.flatMap((s) => s.postServerAuthMs == null ? [] : [s.postServerAuthMs])),
        postServerGame: percentiles(samples.flatMap((s) => s.postServerGameMs == null ? [] : [s.postServerGameMs])),
        postServerChecks: percentiles(samples.flatMap((s) => s.postServerChecksMs == null ? [] : [s.postServerChecksMs])),
        postServerRules: percentiles(samples.flatMap((s) => s.postServerRulesMs == null ? [] : [s.postServerRulesMs])),
        postServerRpc: percentiles(samples.flatMap((s) => s.postServerRpcMs == null ? [] : [s.postServerRpcMs])),
        postServerSnapshot: percentiles(samples.flatMap((s) => s.postServerSnapshotMs == null ? [] : [s.postServerSnapshotMs])),
        senderBoard: percentiles(samples.map((s) => s.senderBoardMs)),
        opponentBoard: percentiles(samples.map((s) => s.opponentBoardMs)),
        whiteRealtime: percentiles(samples.map((s) => s.whiteRealtimeMs).filter((v): v is number => v !== null)),
        blackRealtime: percentiles(samples.map((s) => s.blackRealtimeMs).filter((v): v is number => v !== null)),
        // These are paired per-move durations, not differences of percentile summaries.
        opponentGet: percentiles(samples.flatMap((s) =>
          s.opponentFirstGetStartMs == null || s.opponentFirstGetResponseMs == null
            ? [] : [s.opponentFirstGetResponseMs - s.opponentFirstGetStartMs])),
        opponentGetServerAuth: percentiles(samples.flatMap((s) =>
          s.opponentGetServerAuthMs == null ? [] : [s.opponentGetServerAuthMs])),
        opponentGetServerSnapshot: percentiles(samples.flatMap((s) =>
          s.opponentGetServerSnapshotMs == null ? [] : [s.opponentGetServerSnapshotMs])),
        opponentAfterRealtime: percentiles(samples.flatMap((s) => {
          const realtime = s.ply % 2 === 1 ? s.blackRealtimeMs : s.whiteRealtimeMs;
          return realtime == null ? [] : [s.opponentBoardMs - realtime];
        })),
        opponentRenderAfterResponse: percentiles(samples.flatMap((s) =>
          s.opponentFirstGetResponseMs == null ? [] : [s.opponentBoardMs - s.opponentFirstGetResponseMs])),
      },
      realtimeDelivery: { white: received[0].size, black: received[1].size, status: socketStatus },
      browserRoomRealtime,
      canonicalResponses: samples.filter((s) => s.responseHasSnapshot).length,
      samples,
    };
    await mkdir("test-results", { recursive: true });
    await writeFile("test-results/staging-latency-report.json", JSON.stringify(report, null, 2) + "\n");
    console.log("Staging latency summary (ms):", JSON.stringify(report.percentiles));
    await Promise.allSettled(contexts.map((context) => context.close()));
    await Promise.allSettled(sockets.map((client) => client.removeAllChannels()));
    if (gameId) {
      const { error } = await admin.from("games").delete().eq("id", gameId);
      if (error) throw new Error(`Staging latency cleanup (game): ${error.message}`);
    }
    for (const id of users) {
      const { error } = await admin.auth.admin.deleteUser(id);
      if (error) throw new Error(`Staging latency cleanup (user): ${error.message}`);
    }
  }
});
