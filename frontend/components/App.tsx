"use client";
/* Arc FX — stablecoin swap dApp. Layout theo ảnh 18 (GlobalTrade trading terminal):
   header pair+stats, chart nến trái, order/rate book + convert ticket phải. Self-contained.
   ABI preserved: setRate(pair,bps)/rateOf(pair)/convert(pair)payable/owner/total. */
import { useEffect, useState } from "react";
import { useAccount, useConnect, useDisconnect, useChainId, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseEther } from "viem";
const C = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0x0") as `0x${string}`;
const CHAIN = 5042002, HEX = "0x4CEF52";
const ABI = [
  { name: "setRate", type: "function", stateMutability: "nonpayable", inputs: [{ name: "pair", type: "string" }, { name: "bps", type: "uint256" }], outputs: [] },
  { name: "rateOf", type: "function", stateMutability: "view", inputs: [{ name: "pair", type: "string" }], outputs: [{ type: "uint256" }] },
  { name: "convert", type: "function", stateMutability: "payable", inputs: [{ name: "pair", type: "string" }], outputs: [{ type: "uint256" }] },
  { name: "owner", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { name: "total", type: "function", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;
const cut = (a?: string) => a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "";
const PAIRS = ["USDC/EURC", "EURC/USDC"];
async function toArc() { const e = (window as any).ethereum; if (!e) return; try { await e.request({ method: "wallet_addEthereumChain", params: [{ chainId: HEX, chainName: "Arc Testnet", nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 }, rpcUrls: ["https://rpc.testnet.arc.network"], blockExplorerUrls: ["https://testnet.arcscan.app"] }] }); } catch { try { await e.request({ method: "wallet_switchEthereumChain", params: [{ chainId: HEX }] }); } catch {} } }
const CANDLES = [[28,46,24,50],[50,58,44,46],[46,52,30,34],[34,40,26,38],[38,60,36,58],[58,64,52,54],[54,56,40,44],[44,50,38,48],[48,66,46,64],[64,70,58,60],[60,62,48,52],[52,58,42,56],[56,72,54,68],[68,74,60,62],[62,64,50,54],[54,60,44,58]];
const CSS = `
.tx{--bg:#0a0f1c;--pan:#0f1626;--pan2:#131c30;--bd:#1b2740;--bd2:#26344f;--mut:#7888a8;--txt:#e9eef8;--acc:#14b8a6;--up:#22c55e;--dn:#ef4444;min-height:100vh;background:var(--bg);color:var(--txt);font-family:'Inter','Segoe UI',system-ui,sans-serif}
.tx *{box-sizing:border-box}.tx a{color:#2dd4bf;text-decoration:none}.tx .mono{font-family:ui-monospace,'Cascadia Code',monospace}
.tx header{display:flex;align-items:center;gap:14px;padding:12px 20px;border-bottom:1px solid var(--bd);background:var(--pan)}
.tx .logo{display:flex;align-items:center;gap:9px;font-weight:800;font-size:16px}
.tx .mark{width:30px;height:30px;border-radius:8px;background:linear-gradient(135deg,#14b8a6,#2dd4bf);color:#04201c;display:grid;place-items:center;font-size:15px}
.tx .pairtag{display:flex;align-items:center;gap:10px;background:var(--pan2);border:1px solid var(--bd);border-radius:9px;padding:6px 12px;font-weight:700}
.tx .stat{font-size:11px;color:var(--mut)}.tx .stat b{display:block;font-size:13px;color:var(--txt);font-family:ui-monospace}
.tx .btn{border:0;border-radius:8px;font:inherit;font-weight:700;cursor:pointer;padding:9px 15px;transition:.15s}.tx .btn:disabled{opacity:.5;cursor:not-allowed}
.tx .pri{background:var(--acc);color:#04201c}.tx .pri:hover:not(:disabled){background:#2dd4bf}.tx .red{background:#dc2626;color:#fff}
.tx .grid{display:grid;grid-template-columns:1fr 210px 300px;gap:1px;background:var(--bd);min-height:520px}
.tx .col{background:var(--bg);padding:14px 16px}
.tx .chartwrap{background:var(--pan);border:1px solid var(--bd);border-radius:12px;padding:14px;height:100%}
.tx .book{background:var(--pan);border:1px solid var(--bd);border-radius:12px;height:100%;overflow:hidden;display:flex;flex-direction:column}
.tx .book .h{padding:10px 14px;font-size:12px;font-weight:700;color:var(--mut);border-bottom:1px solid var(--bd)}
.tx .ord{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:8px 14px;font-size:12px;font-family:ui-monospace;position:relative}
.tx .ticket{background:var(--pan);border:1px solid var(--bd);border-radius:12px;padding:16px;height:100%}
.tx label{display:block;font-size:11px;color:var(--mut);margin:10px 0 5px;text-transform:uppercase;letter-spacing:.04em}
.tx input,.tx select{width:100%;background:var(--bg);border:1px solid var(--bd2);border-radius:8px;padding:11px 12px;font:inherit;font-size:14px;color:var(--txt);outline:none}.tx input:focus,.tx select:focus{border-color:var(--acc)}
.tx .recv{background:var(--pan2);border:1px solid var(--bd);border-radius:10px;padding:13px;margin:12px 0}
.tx .menu{position:absolute;right:0;top:116%;background:var(--pan2);border:1px solid var(--bd2);border-radius:10px;padding:6px;min-width:180px;z-index:30;box-shadow:0 14px 34px rgba(0,0,0,.5)}
.tx .menu button{display:block;width:100%;text-align:left;background:none;border:0;color:var(--txt);font:inherit;font-weight:600;font-size:13px;padding:8px 11px;border-radius:7px;cursor:pointer}.tx .menu button:hover{background:rgba(255,255,255,.05)}
@media(max-width:920px){.tx .grid{grid-template-columns:1fr}}
`;
export default function App() {
  const { address, isConnected } = useAccount(); const net = useChainId();
  const { connectors, connect } = useConnect(); const { disconnect } = useDisconnect();
  const [pop, setPop] = useState(false); const [pair, setPair] = useState("USDC/EURC"); const [amt, setAmt] = useState("");
  const [sr, setSr] = useState({ pair: "USDC/EURC", rate: "9200" });
  const tx = useWriteContract(); const rcpt = useWaitForTransactionReceipt({ hash: tx.data, query: { enabled: !!tx.data } });
  const busy = tx.isPending || rcpt.isLoading;
  useEffect(() => { if (rcpt.isSuccess) { tx.reset(); setAmt(""); } }, [rcpt.isSuccess]); // eslint-disable-line
  const rate = useReadContract({ address: C, abi: ABI, functionName: "rateOf", args: [pair] });
  const owner = useReadContract({ address: C, abi: ABI, functionName: "owner" });
  const total = useReadContract({ address: C, abi: ABI, functionName: "total" });
  const wrong = isConnected && net !== CHAIN; const bps = rate.data !== undefined ? Number(rate.data) : 0;
  const px = bps > 0 ? bps / 10000 : 0;
  const out = bps > 0 && Number(amt) > 0 ? (Number(amt) * bps / 10000).toLocaleString(undefined, { maximumFractionDigits: 4 }) : "0";
  const isOwner = address && owner.data && (owner.data as string).toLowerCase() === address.toLowerCase();
  const [a, b] = pair.split("/");
  return (
    <div className="tx">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <header>
        <div className="logo"><span className="mark">⇄</span>Arc FX</div>
        <div className="pairtag">{pair}<span style={{ color: "var(--up)", fontSize: 12 }}>▲</span></div>
        <div className="stat">Rate<b>{px ? px.toFixed(4) : "—"}</b></div>
        <div className="stat">Pairs<b>{PAIRS.length}</b></div>
        <div className="stat">Volume<b className="mono">{total.data?.toString() ?? "0"}</b></div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          {wrong && <button className="btn red" onClick={toArc}>Switch to Arc</button>}
          <div style={{ position: "relative" }}><button className="btn pri" onClick={() => setPop(p => !p)}>{isConnected ? cut(address) : "Connect"}</button>
            {pop && <div className="menu">{isConnected ? <button onClick={() => { disconnect(); setPop(false); }} style={{ color: "#f87171" }}>Disconnect</button> : connectors.map(c => <button key={c.uid} onClick={() => { connect({ connector: c }); setPop(false); }}>{c.name}</button>)}</div>}</div>
        </div>
      </header>
      <div className="grid">
        <div className="col">
          <div className="chartwrap">
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}><div style={{ fontWeight: 700 }}>{pair} · rate chart</div><div className="mono" style={{ color: "var(--up)", fontWeight: 700 }}>{px ? px.toFixed(4) : "—"}</div></div>
            <svg viewBox="0 0 520 230" style={{ width: "100%", height: 230 }} preserveAspectRatio="none">
              {[0, 1, 2, 3, 4].map(i => <line key={i} x1="0" x2="520" y1={20 + i * 46} y2={20 + i * 46} stroke="#16223a" strokeWidth="1" />)}
              {CANDLES.map((c, i) => { const x = 16 + i * 31; const up = c[3] >= c[0]; const col = up ? "#22c55e" : "#ef4444"; const o = 210 - c[0] * 2.4, cl = 210 - c[3] * 2.4, hi = 210 - c[1] * 2.4, lo = 210 - c[2] * 2.4; return <g key={i}><line x1={x + 8} x2={x + 8} y1={hi} y2={lo} stroke={col} strokeWidth="1.5" /><rect x={x} y={Math.min(o, cl)} width="16" height={Math.max(3, Math.abs(cl - o))} fill={col} rx="1" /></g>; })}
            </svg>
          </div>
        </div>
        <div className="col">
          <div className="book">
            <div className="h">Rate book · {pair}</div>
            <div style={{ flex: 1, padding: "6px 0" }}>
              {[3, 2, 1].map(k => <div className="ord" key={"a" + k}><span style={{ color: "var(--dn)" }}>{px ? (px * (1 + k * 0.001)).toFixed(4) : "—"}</span><span style={{ textAlign: "right", color: "var(--mut)" }}>{(k * 1.4).toFixed(1)}k</span><div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: `${k * 18}%`, background: "rgba(239,68,68,.08)" }} /></div>)}
              <div style={{ textAlign: "center", padding: "8px 0", fontWeight: 800, color: "var(--up)", fontFamily: "ui-monospace" }}>{px ? px.toFixed(4) : "no rate"}</div>
              {[1, 2, 3].map(k => <div className="ord" key={"b" + k}><span style={{ color: "var(--up)" }}>{px ? (px * (1 - k * 0.001)).toFixed(4) : "—"}</span><span style={{ textAlign: "right", color: "var(--mut)" }}>{(k * 1.2).toFixed(1)}k</span><div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: `${k * 16}%`, background: "rgba(34,197,94,.08)" }} /></div>)}
            </div>
          </div>
        </div>
        <div className="col">
          <div className="ticket">
            <div style={{ fontWeight: 800, marginBottom: 4 }}>Convert</div>
            <label>Pair</label><select value={pair} onChange={e => setPair(e.target.value)}>{PAIRS.map(p => <option key={p} value={p}>{p}</option>)}</select>
            <label>You pay ({a})</label><input value={amt} onChange={e => setAmt(e.target.value)} type="number" placeholder="0.00" />
            <div className="recv"><div style={{ fontSize: 11, color: "var(--mut)" }}>You receive ≈ ({b})</div><div className="mono" style={{ fontSize: 22, fontWeight: 800, color: Number(out) ? "var(--txt)" : "var(--mut)" }}>{out}</div><div style={{ fontSize: 11, color: "var(--mut)" }}>{px ? `1 ${a} = ${px.toFixed(4)} ${b}` : "no rate set"}</div></div>
            <button className="btn pri" style={{ width: "100%" }} disabled={!isConnected || busy || !(Number(amt) > 0) || !bps} onClick={() => tx.writeContract({ address: C, abi: ABI, functionName: "convert", args: [pair], value: parseEther(amt || "0") })}>{!isConnected ? "Connect wallet" : !bps ? "No rate" : busy ? "Converting…" : `Convert ${a} → ${b}`}</button>
            {isOwner && <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--bd)" }}>
              <label>Owner · set rate (bps)</label>
              <div style={{ display: "flex", gap: 6 }}><select style={{ flex: 1 }} value={sr.pair} onChange={e => setSr(s => ({ ...s, pair: e.target.value }))}>{PAIRS.map(p => <option key={p} value={p}>{p}</option>)}</select><input style={{ width: 84 }} value={sr.rate} onChange={e => setSr(s => ({ ...s, rate: e.target.value }))} type="number" /><button className="btn pri" disabled={busy || !(Number(sr.rate) > 0)} onClick={() => tx.writeContract({ address: C, abi: ABI, functionName: "setRate", args: [sr.pair, BigInt(sr.rate || "0")] })}>Set</button></div>
            </div>}
          </div>
        </div>
      </div>
      <div style={{ textAlign: "center", color: "#566", fontSize: 12, padding: "14px 0" }}>Built on <a href="https://arc.network" target="_blank" rel="noopener noreferrer">Arc Network</a></div>
    </div>
  );
}
