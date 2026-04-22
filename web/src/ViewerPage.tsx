import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { TrenchScene3D } from "./trench3d/TrenchScene3D";
import { attributesToDna } from "./metadataToDna";
import type { Dna } from "./types";

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";

type Meta = {
  name?: string;
  description?: string;
  attributes?: { trait_type?: string; value?: string | number }[];
};

function parseRef(ref: string | null): { mint: string; id: string } | null {
  if (!ref?.trim()) return null;
  const r = ref.trim();
  const parts = r.split(":", 2);
  if (parts[0] === "solana" && parts[1]) {
    return { mint: parts[1], id: r };
  }
  if (/^[1-9A-HJ-NP-Za-km-z]{32,50}$/.test(r)) {
    return { mint: r, id: `solana:${r}` };
  }
  return null;
}

export function ViewerPage() {
  const [searchParams] = useSearchParams();
  const ref = searchParams.get("ref");
  const parsed = useMemo(() => parseRef(ref), [ref]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [dna, setDna] = useState<Dna>({});

  useEffect(() => {
    if (!parsed) {
      setLoading(false);
      setErr("Missing or invalid ?ref= (e.g. solana:ASSET or raw mint).");
      return;
    }
    let cancelled = false;
    (async () => {
      setErr("");
      setLoading(true);
      try {
        const res = await fetch(
          `${API_BASE}/v1/metadata/solana/${encodeURIComponent(parsed.mint)}`
        );
        if (!res.ok) {
          const j = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(j.error ?? res.statusText);
        }
        const j = (await res.json()) as Meta;
        if (cancelled) return;
        setMeta(j);
        setDna(attributesToDna({ attributes: j.attributes }));
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [parsed]);

  if (!parsed) {
    return (
      <div className="layout" style={{ padding: "1.5rem" }}>
        <p className="msg err">{err || "No token selected."}</p>
        <Link to="/" className="msg">
          ← Home
        </Link>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#010409", color: "#e2e8f0" }}>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.6rem 1rem",
          borderBottom: "1px solid #1e293b",
        }}
      >
        <Link to="/" style={{ color: "#38bdf8" }}>
          ← Collection
        </Link>
        <code style={{ fontSize: 12, maxWidth: "55vw", overflow: "hidden", textOverflow: "ellipsis" }}>
          {parsed.mint}
        </code>
      </header>
      {loading ? <p style={{ padding: "1rem" }}>Loading 3D scene…</p> : null}
      {err ? (
        <p className="msg err" style={{ padding: "1rem" }}>
          {err}
        </p>
      ) : null}
      {!loading && !err && meta ? (
        <TrenchScene3D dna={dna} mint={parsed.mint} name={meta.name ?? "Trench creature"} />
      ) : null}
    </div>
  );
}
