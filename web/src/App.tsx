import { useCallback, useMemo, useState } from "react";
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
      <h2>Server-assisted mint</h2>
      <p className="msg">
        Sign a one-time challenge. The Worker verifies your wallet and pays mint fees from{" "}
        <code>CNFT_MINT_KEYPAIR</code>. Devnet only unless you configure mainnet RPC + tree.
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

function GalleryPanel() {
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

export function App() {
  return (
    <WalletShell>
      <div className="layout">
        <header>
          <h1>Trenches — compressed NFTs</h1>
          <WalletMultiButton />
        </header>
        <MintPanel />
        <GalleryPanel />
      </div>
    </WalletShell>
  );
}
