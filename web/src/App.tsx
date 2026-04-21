import { useCallback, useEffect, useMemo, useState } from "react";
import { ConnectionProvider, WalletProvider, useWallet } from "@solana/wallet-adapter-react";
import { WalletModalProvider, WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { clusterApiUrl } from "@solana/web3.js";
import bs58 from "bs58";
import "@solana/wallet-adapter-react-ui/styles.css";

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";

type GalleryJson = {
  items: {
    id: string;
    name: string | null;
    symbol: string | null;
    uri: string | null;
    image: string | null;
    owner: string | null;
  }[];
  configured?: boolean;
  error?: string | null;
  hint?: string;
};

type CnftStatus = {
  mintReady: boolean;
  /** Payer / tree authority for server mint — fund on devnet. */
  mintAuthorityAddress?: string | null;
  merkleTree: string | null;
  maxDepth: number | null;
  approxCapacity: number | null;
  persistedTree: boolean;
  hint: string | null;
};

function StatusPanel({ refreshKey }: { refreshKey: number }) {
  const [s, setS] = useState<CnftStatus | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setErr("");
      try {
        const res = await fetch(`${API_BASE}/v1/cnft/status`);
        const j = (await res.json()) as CnftStatus;
        if (!cancelled) setS(j);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  if (err) return <p className="msg err">Status: {err}</p>;
  if (!s) return <p className="msg">Loading status…</p>;

  return (
    <div className="panel">
      <h2>Collection status</h2>
      <ul className="msg" style={{ margin: 0, paddingLeft: "1.2rem" }}>
        <li>
          Mint ready: <strong>{s.mintReady ? "yes" : "no"}</strong>
        </li>
        {s.merkleTree ? (
          <li>
            Merkle tree: <code>{s.merkleTree}</code>
          </li>
        ) : (
          <li>No Merkle tree yet — create one below (admin).</li>
        )}
        {s.approxCapacity != null ? (
          <li>
            Max leaves (2^depth): <strong>{s.approxCapacity.toLocaleString()}</strong>
            {s.maxDepth != null ? ` (depth ${s.maxDepth})` : ""}
          </li>
        ) : null}
        {s.mintAuthorityAddress ? (
          <li>
            Fund server mint (devnet SOL): <code style={{ wordBreak: "break-all" }}>{s.mintAuthorityAddress}</code>
          </li>
        ) : null}
        {s.hint ? <li className="err">{s.hint}</li> : null}
      </ul>
    </div>
  );
}

function AdminPanel({
  onTreeCreated,
  publicKey,
}: {
  onTreeCreated: () => void;
  publicKey: string | null;
}) {
  const [adminSecret, setAdminSecret] = useState("");
  const [maxDepth, setMaxDepth] = useState("14");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const [batchCount, setBatchCount] = useState("15");
  const [startNumber, setStartNumber] = useState("1");
  const [chainRepeats, setChainRepeats] = useState("1");
  const [namePrefix, setNamePrefix] = useState("Trenches");
  /** Total NFTs to mint in one run (10k workflow). */
  const [targetSupply, setTargetSupply] = useState("");
  const [progressLine, setProgressLine] = useState("");

  const createTree = useCallback(async () => {
    setErr("");
    setMsg("");
    if (!adminSecret.trim()) {
      setErr("Admin secret required.");
      return;
    }
    setBusy(true);
    try {
      const depth = Number.parseInt(maxDepth, 10);
      if (!Number.isFinite(depth) || depth < 3 || depth > 30) {
        throw new Error("maxDepth should be ~14 for 16k (valid range 3–30).");
      }
      const res = await fetch(`${API_BASE}/v1/admin/cnft/tree`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-secret": adminSecret.trim(),
        },
        body: JSON.stringify({ maxDepth: depth, maxBufferSize: 64, canopyDepth: 8, treePublic: false }),
      });
      const body = (await res.json()) as Record<string, unknown>;
      if (!res.ok) {
        throw new Error(
          typeof body.detail === "string"
            ? body.detail
            : typeof body.error === "string"
              ? body.error
              : res.statusText
        );
      }
      setMsg(JSON.stringify(body, null, 2));
      onTreeCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [adminSecret, maxDepth, onTreeCreated]);

  const mintTowardTarget = useCallback(async () => {
    setErr("");
    setMsg("");
    setProgressLine("");
    if (!adminSecret.trim()) {
      setErr("Admin secret required.");
      return;
    }
    if (!publicKey) {
      setErr("Connect your wallet — NFTs are minted to the connected address.");
      return;
    }
    const goal = Math.min(100_000, Math.max(1, Number.parseInt(targetSupply.trim(), 10) || 0));
    if (!Number.isFinite(goal) || goal < 1) {
      setErr("Set a target supply (e.g. 10000) or use a preset below.");
      return;
    }
    const count = Math.max(1, Number.parseInt(batchCount, 10) || 15);
    let start = Math.max(1, Number.parseInt(startNumber, 10) || 1);
    const maxBatches = Math.min(5000, Math.ceil(goal / count) + 100);
    setBusy(true);
    const log: string[] = [];
    let totalThisRun = 0;
    try {
      for (let b = 0; b < maxBatches && totalThisRun < goal; b++) {
        const remaining = goal - totalThisRun;
        const thisCount = Math.min(count, remaining);
        setProgressLine(`Minting… ${totalThisRun} / ${goal} (batch ${b + 1})`);
        const res = await fetch(`${API_BASE}/v1/admin/cnft/mint-batch`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-secret": adminSecret.trim(),
          },
          body: JSON.stringify({
            recipient: publicKey,
            count: thisCount,
            namePrefix: namePrefix.trim() || "Trenches",
            symbol: "TRNCH",
            startNumber: start,
          }),
        });
        const body = (await res.json()) as {
          minted?: number;
          results?: { ok?: boolean; name?: string; error?: string }[];
        };
        if (!res.ok) {
          throw new Error(JSON.stringify(body).slice(0, 500));
        }
        const minted = body.minted ?? 0;
        totalThisRun += minted;
        start += minted;
        log.push(`Batch ${b + 1}: +${minted} (total ${totalThisRun} / ${goal}, next #${start})`);
        setProgressLine(`Minted ${totalThisRun} / ${goal}`);
        if (minted < thisCount) {
          log.push("Stopped early (RPC error, rate limit, or tree full).");
          break;
        }
        if (totalThisRun >= goal) {
          log.push(`Done — reached target ${goal}.`);
          break;
        }
        await new Promise((r) => setTimeout(r, 400));
      }
      setStartNumber(String(start));
      setMsg(log.join("\n"));
      onTreeCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setProgressLine("");
    }
  }, [adminSecret, batchCount, namePrefix, publicKey, startNumber, targetSupply, onTreeCreated]);

  const mintBatchChain = useCallback(async () => {
    setErr("");
    setMsg("");
    if (!adminSecret.trim()) {
      setErr("Admin secret required.");
      return;
    }
    if (!publicKey) {
      setErr("Connect wallet for recipient address, or paste recipient in a future version.");
      return;
    }
    const count = Math.max(1, Number.parseInt(batchCount, 10) || 15);
    const repeats = Math.min(500, Math.max(1, Number.parseInt(chainRepeats, 10) || 1));
    let start = Math.max(1, Number.parseInt(startNumber, 10) || 1);
    setBusy(true);
    const log: string[] = [];
    try {
      for (let i = 0; i < repeats; i++) {
        const res = await fetch(`${API_BASE}/v1/admin/cnft/mint-batch`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-secret": adminSecret.trim(),
          },
          body: JSON.stringify({
            recipient: publicKey,
            count,
            namePrefix: namePrefix.trim() || "Trenches",
            symbol: "TRNCH",
            startNumber: start,
          }),
        });
        const body = (await res.json()) as {
          minted?: number;
          attempted?: number;
          results?: { ok?: boolean; name?: string; error?: string }[];
        };
        if (!res.ok) {
          throw new Error(JSON.stringify(body).slice(0, 500));
        }
        const minted = body.minted ?? 0;
        log.push(`Batch ${i + 1}/${repeats}: minted ${minted} (start #${start})`);
        start += minted;
        if (minted < count) {
          log.push("Stopped early (RPC error or tree full).");
          break;
        }
        await new Promise((r) => setTimeout(r, 400));
      }
      setStartNumber(String(start));
      setMsg(log.join("\n"));
      onTreeCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [adminSecret, batchCount, chainRepeats, namePrefix, publicKey, startNumber, onTreeCreated]);

  return (
    <div className="panel">
      <h2>Collection setup (admin)</h2>
      <p className="msg">
        Creates the on-chain Bubblegum V2 Merkle tree and stores it in D1 (no <code>CNFT_MERKLE_TREE</code> var
        needed). For a ~10k drop, use depth <strong>14</strong> (16,384 leaves). Then use <strong>Large collection</strong>{" "}
        below with the <strong>10k</strong> preset (or enter any target).
      </p>
      <p className="msg err">
        Never share your admin secret; this UI is for operators only. Prefer a secure admin environment for
        production.
      </p>
      <label className="msg" style={{ display: "block", marginTop: "0.75rem" }}>
        Admin secret{" "}
        <input
          type="password"
          autoComplete="off"
          value={adminSecret}
          onChange={(e) => setAdminSecret(e.target.value)}
          placeholder="x-admin-secret"
          style={{ minWidth: "240px" }}
        />
      </label>

      <div className="actions" style={{ marginTop: "1rem" }}>
        <label>
          Max depth{" "}
          <input type="text" value={maxDepth} onChange={(e) => setMaxDepth(e.target.value)} style={{ width: "3rem" }} />
        </label>
        <button type="button" className="primary" disabled={busy} onClick={() => void createTree()}>
          Create Merkle tree
        </button>
      </div>

      <h3 style={{ fontSize: "0.95rem", marginTop: "1.25rem" }}>Large collection (e.g. 10,000)</h3>
      <p className="msg">
        Mints to your <strong>connected wallet</strong> in server-side batches (Worker limit ~15 per call by default).
        A full 10k run can take <strong>15–40+ minutes</strong> — keep this tab open. Requires tree depth ≥ 14 for 16k
        capacity.
      </p>
      <div className="actions" style={{ flexWrap: "wrap", alignItems: "center" }}>
        <label>
          Target supply{" "}
          <input
            type="text"
            inputMode="numeric"
            value={targetSupply}
            onChange={(e) => setTargetSupply(e.target.value)}
            placeholder="10000"
            style={{ width: "5.5rem" }}
          />
        </label>
        <span className="msg" style={{ marginRight: "0.25rem" }}>
          Presets:
        </span>
        <button type="button" className="ghost" disabled={busy} onClick={() => setTargetSupply("100")}>
          100
        </button>
        <button type="button" className="ghost" disabled={busy} onClick={() => setTargetSupply("1000")}>
          1k
        </button>
        <button type="button" className="ghost" disabled={busy} onClick={() => setTargetSupply("10000")}>
          10k
        </button>
        <label style={{ marginLeft: "0.5rem" }}>
          Batch size{" "}
          <input type="text" value={batchCount} onChange={(e) => setBatchCount(e.target.value)} style={{ width: "2.5rem" }} />
        </label>
        <label>
          Start #{" "}
          <input type="text" value={startNumber} onChange={(e) => setStartNumber(e.target.value)} style={{ width: "3.5rem" }} />
        </label>
        <label>
          Name prefix{" "}
          <input type="text" value={namePrefix} onChange={(e) => setNamePrefix(e.target.value)} />
        </label>
        <button
          type="button"
          className="primary"
          disabled={busy || !publicKey}
          onClick={() => void mintTowardTarget()}
        >
          {busy ? "Minting…" : "Mint toward target"}
        </button>
      </div>
      {progressLine ? (
        <p className="msg ok" style={{ marginTop: "0.5rem" }}>
          {progressLine}
        </p>
      ) : null}

      <h3 style={{ fontSize: "0.95rem", marginTop: "1.5rem" }}>Advanced: fixed batch count</h3>
      <p className="msg">Run exactly N batches (for testing). Same fields except use chain repeats instead of target.</p>
      <div className="actions" style={{ flexWrap: "wrap" }}>
        <label>
          Chain repeats{" "}
          <input
            type="text"
            value={chainRepeats}
            onChange={(e) => setChainRepeats(e.target.value)}
            style={{ width: "3.5rem" }}
          />
        </label>
        <button type="button" className="primary" disabled={busy || !publicKey} onClick={() => void mintBatchChain()}>
          {busy ? "Minting…" : "Run batch chain"}
        </button>
      </div>
      {err ? <p className="msg err">{err}</p> : null}
      {msg ? <pre className="msg ok" style={{ fontSize: "0.8rem" }}>{msg}</pre> : null}
    </div>
  );
}

function MintPanel() {
  const { publicKey, signMessage, connected } = useWallet();
  const [status, setStatus] = useState<string>("");
  const [err, setErr] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("Trenches piece");

  const mint = useCallback(async () => {
    setErr("");
    setStatus("");
    if (!connected || !publicKey || !signMessage) {
      setErr("Connect a wallet that supports signMessage (e.g. Phantom).");
      return;
    }
    setBusy(true);
    try {
      const chRes = await fetch(`${API_BASE}/v1/mint/cnft/challenge`);
      if (!chRes.ok) throw new Error(`challenge ${chRes.status}`);
      const { message } = (await chRes.json()) as { message: string };
      const encoded = new TextEncoder().encode(message);
      const sigBytes = await signMessage(encoded);
      const signature = bs58.encode(sigBytes);

      const mintRes = await fetch(`${API_BASE}/v1/mint/cnft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipient: publicKey.toBase58(),
          message,
          signature,
          name: name.trim() || undefined,
          symbol: "TRNCH",
        }),
      });
      const body = (await mintRes.json()) as Record<string, unknown>;
      if (!mintRes.ok) {
        throw new Error(
          typeof body.detail === "string"
            ? body.detail
            : typeof body.error === "string"
              ? body.error
              : mintRes.statusText
        );
      }
      setStatus(JSON.stringify(body, null, 2));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [connected, publicKey, signMessage, name]);

  return (
    <div className="panel">
      <h2>Server-assisted mint (wallet)</h2>
      <p className="msg">
        Sign a one-time challenge. Requires an existing tree and <code>CNFT_MINT_KEYPAIR</code> /{" "}
        <code>CNFT_RPC_URL</code> on the Worker.
      </p>
      <div className="actions" style={{ marginTop: "0.75rem" }}>
        <label>
          Name{" "}
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Display name" />
        </label>
        <button type="button" className="primary" disabled={busy || !connected} onClick={() => void mint()}>
          {busy ? "Minting…" : "Mint cNFT"}
        </button>
      </div>
      {err ? <p className="msg err">{err}</p> : null}
      {status ? <pre className="msg ok">{status}</pre> : null}
    </div>
  );
}

function GalleryPanel({ refreshKey }: { refreshKey: number }) {
  const [data, setData] = useState<GalleryJson | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setErr("");
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/v1/gallery/cnft?limit=200`);
      const j = (await res.json()) as GalleryJson;
      setData(j);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  return (
    <div className="panel">
      <h2>Collection gallery</h2>
      <div className="actions">
        <button type="button" className="primary" disabled={loading} onClick={() => void load()}>
          {loading ? "Loading…" : "Load / refresh"}
        </button>
        {data?.hint ? <span className="msg">{data.hint}</span> : null}
        {data?.error ? <span className="msg err">DAS: {data.error}</span> : null}
      </div>
      {err ? <p className="msg err">{err}</p> : null}
      {data?.items?.length ? (
        <div className="gallery" style={{ marginTop: "1rem" }}>
          {data.items.map((it) => (
            <div key={it.id} className="card">
              {it.image ? (
                <img src={it.image} alt="" loading="lazy" referrerPolicy="no-referrer" />
              ) : (
                <div style={{ aspectRatio: "1", background: "#0f172a" }} />
              )}
              <div className="meta">
                <strong>{it.name ?? "—"}</strong>
                <code>{it.id.slice(0, 8)}…</code>
              </div>
            </div>
          ))}
        </div>
      ) : data?.configured ? (
        <p className="msg">No items returned (tree may be empty or indexer lag).</p>
      ) : null}
    </div>
  );
}

function WalletShell({ children }: { children: React.ReactNode }) {
  const endpoint = useMemo(() => clusterApiUrl("devnet"), []);
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

function AppInner() {
  const { publicKey } = useWallet();
  const [refreshKey, setRefreshKey] = useState(0);
  const bump = useCallback(() => setRefreshKey((k) => k + 1), []);

  return (
    <div className="layout">
      <header>
        <h1>Trenches — compressed NFTs</h1>
        <WalletMultiButton />
      </header>
      <StatusPanel refreshKey={refreshKey} />
      <AdminPanel onTreeCreated={bump} publicKey={publicKey?.toBase58() ?? null} />
      <MintPanel />
      <GalleryPanel refreshKey={refreshKey} />
    </div>
  );
}

export function App() {
  return (
    <WalletShell>
      <AppInner />
    </WalletShell>
  );
}
