"use client";
import { useEffect, useState } from "react";
import { useAccount, useBalance } from "wagmi";
import { formatEther, formatUnits, createPublicClient, http } from "viem";

// Testnet USDC (ERC20, 6 decimals) per chain + public RPC, to show source balance off Arc.
const EXT: Record<string, { rpc: string; usdc: `0x${string}` }> = {
  Base_Sepolia: { rpc: "https://sepolia.base.org", usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e" },
  Ethereum_Sepolia: { rpc: "https://ethereum-sepolia-rpc.publicnode.com", usdc: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238" },
  Avalanche_Fuji: { rpc: "https://api.avax-test.network/ext/bc/C/rpc", usdc: "0x5425890298aed601595a70AB815c96711a31Bc65" },
};
const BAL_ABI = [{ name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] }] as const;

// Professional bidirectional cross-chain USDC bridge via Circle App Kit (CCTP). Bento-style.
const KIT = process.env.NEXT_PUBLIC_KIT_KEY || "";
function getProvider() { const w = window as any; let p = w.okxwallet || w.ethereum; if (w.ethereum?.providers?.length) p = w.ethereum.providers.find((x: any) => x.isMetaMask) || w.ethereum.providers[0]; return p; }
async function adapterOf(p: any) { const { createViemAdapterFromProvider } = await import("@circle-fin/adapter-viem-v2"); return await createViemAdapterFromProvider({ provider: p } as any); }
const fmtA = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

const CHAINS: Record<string, { name: string; logo: string; bg: string }> = {
  Arc_Testnet: { name: "Arc Testnet", logo: "◆", bg: "from-emerald-400 to-teal-600" },
  Base_Sepolia: { name: "Base Sepolia", logo: "B", bg: "from-blue-500 to-blue-700" },
  Ethereum_Sepolia: { name: "Ethereum Sepolia", logo: "Ξ", bg: "from-indigo-400 to-indigo-600" },
  Avalanche_Fuji: { name: "Avalanche Fuji", logo: "A", bg: "from-red-500 to-red-700" },
};
const KEYS = Object.keys(CHAINS);
function ChainBadge({ id }: { id: string }) { const c = CHAINS[id]; return <span className="inline-flex items-center gap-2 text-xs text-gray-300"><span className={`w-4 h-4 rounded-full bg-gradient-to-br ${c.bg} grid place-items-center text-[9px] text-white`}>{c.logo}</span>{c.name}</span>; }

export function BridgePanel({ heading, color = "emerald" }: { heading: string; color?: string }) {
  const c = color;
  const { address, isConnected } = useAccount();
  const [amt, setAmt] = useState("");
  const [from, setFrom] = useState("Arc_Testnet");
  const [dest, setDest] = useState("Base_Sepolia");
  const [to, setTo] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const { data: wbal } = useBalance({ address, query: { enabled: !!address && from === "Arc_Testnet" } });
  const [extBal, setExtBal] = useState<string | null>(null);
  useEffect(() => {
    setExtBal(null);
    const e = EXT[from]; if (!e || !address) return;
    let off = false;
    (async () => {
      try { const pc = createPublicClient({ transport: http(e.rpc) }); const r = await pc.readContract({ address: e.usdc, abi: BAL_ABI, functionName: "balanceOf", args: [address] }); if (!off) setExtBal(Number(formatUnits(r as bigint, 6)).toLocaleString(undefined, { maximumFractionDigits: 2 })); } catch { if (!off) setExtBal("—"); }
    })();
    return () => { off = true; };
  }, [from, address]);
  const balStr = from === "Arc_Testnet" ? (wbal ? Number(formatEther(wbal.value)).toLocaleString(undefined, { maximumFractionDigits: 2 }) : "0") : (extBal ?? "…");
  const recipient = to.trim() || address || "";

  function flip() { setFrom(dest); setDest(from); }
  function setFromChain(v: string) { if (v === dest) setDest(from); setFrom(v); }
  function setDestChain(v: string) { if (v === from) setFrom(dest); setDest(v); }

  async function run() {
    if (!address || !(Number(amt) > 0)) return;
    setBusy(true); setStatus("Preparing bridge…");
    try {
      const p = getProvider(); const ad = await adapterOf(p);
      const { BridgeKit } = await import("@circle-fin/bridge-kit");
      const kit: any = new (BridgeKit as any)({ kitKey: KIT });
      setStatus(`Burning on ${CHAINS[from].name}, minting on ${CHAINS[dest].name}…`);
      const r: any = await kit.bridge({ from: { adapter: ad, chain: from }, to: { adapter: ad, chain: dest, recipientAddress: recipient }, token: "USDC", amount: amt, config: { kitKey: KIT } } as any);
      setStatus("Bridged ✓ " + (r?.txHash ? fmtA(r.txHash) : "")); setAmt("");
    } catch (e: any) { const m = (e?.shortMessage || e?.message || "failed"); setStatus(/nsufficient/.test(m) ? m : m.slice(0, 160)); }
    finally { setBusy(false); }
  }

  const TokenUSDC = <span className="shrink-0 bg-gray-800 rounded-full px-3 py-1.5 text-sm font-bold flex items-center gap-2"><span className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 grid place-items-center text-[11px] text-white">$</span>USDC</span>;
  const sel = "w-full bg-gray-800 border border-gray-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-gray-600";
  return (
    <div className="space-y-3">
      <h3 className="text-base font-bold px-1">{heading}</h3>
      <div className="space-y-1">
        {/* FROM */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-gray-500"><span>From</span><span>Balance: {balStr} USDC <button onClick={() => { if (from === "Arc_Testnet") { if (wbal) setAmt(formatEther(wbal.value)); } else if (extBal && extBal !== "—") setAmt(extBal.replace(/,/g, "")); }} className={`text-${c}-400 font-semibold ml-1 hover:underline`}>MAX</button></span></div>
          <div className="flex items-center gap-3"><input value={amt} onChange={e => setAmt(e.target.value)} type="number" placeholder="0" className="w-full bg-transparent text-2xl font-bold focus:outline-none placeholder:text-gray-600" />{TokenUSDC}</div>
          <select value={from} onChange={e => setFromChain(e.target.value)} className={sel}>{KEYS.map(k => <option key={k} value={k}>{CHAINS[k].name}</option>)}</select>
        </div>
        {/* SWITCH */}
        <div className="flex justify-center -my-3 relative z-10"><button onClick={flip} className={`w-9 h-9 rounded-xl bg-gray-800 border-4 border-[#0a0a0a] grid place-items-center text-gray-300 hover:text-${c}-400 hover:rotate-180 transition-all`}>↓</button></div>
        {/* TO */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 space-y-2">
          <div className="text-xs text-gray-500">To</div>
          <div className="flex items-center gap-3"><div className={`flex-1 text-2xl font-bold ${amt ? "text-white" : "text-gray-600"}`}>{amt || "0"}</div>{TokenUSDC}</div>
          <select value={dest} onChange={e => setDestChain(e.target.value)} className={sel}>{KEYS.map(k => <option key={k} value={k}>{CHAINS[k].name}</option>)}</select>
        </div>
      </div>

      <input value={to} onChange={e => setTo(e.target.value)} placeholder={`Recipient on ${CHAINS[dest].name} (default: your wallet)`} className="w-full bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 text-sm font-mono focus:outline-none focus:border-gray-700" />

      <div className="flex items-center justify-between text-xs text-gray-500 px-2"><span className="flex items-center gap-1.5"><ChainBadge id={from} /> → <ChainBadge id={dest} /></span><span>via CCTP</span></div>

      <button onClick={run} disabled={!isConnected || busy || !(Number(amt) > 0)} className={`w-full py-4 font-bold text-base rounded-2xl bg-gradient-to-r from-${c}-500 to-${c}-600 text-white hover:opacity-90 disabled:opacity-40 shadow-lg shadow-${c}-500/20`}>
        {!isConnected ? "Connect wallet" : busy ? "Bridging…" : !(Number(amt) > 0) ? "Enter an amount" : `Bridge to ${CHAINS[dest].name}`}
      </button>
      {status && <div className="text-center text-xs text-gray-400">{status}</div>}
      <p className="text-[11px] text-gray-600 text-center">Native USDC moves cross-chain through Circle CCTP (burn &amp; mint).</p>
    </div>
  );
}
