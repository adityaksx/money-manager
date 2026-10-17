"use client";

import { useState } from "react";
import { X, TrendingDown, TrendingUp } from "lucide-react";
import { todayISO } from "@/lib/format";
import type { InvestmentPosition } from "@/lib/investment-portfolio";

export default function InvestmentActivityModal({
  investment,
  onClose,
  onSave,
}: {
  investment: InvestmentPosition;
  onClose: () => void;
  onSave: (payload: { action: "buy" | "sell"; units: number; unit_price: number; fees: number; occurred_on: string; notes: string | null }) => Promise<void>;
}) {
  const [action, setAction] = useState<"buy" | "sell">("buy");
  const [units, setUnits] = useState("");
  const [price, setPrice] = useState(investment.current_price > 0 ? String(investment.current_price) : "");
  const [fees, setFees] = useState("0");
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const quantity = Number(units);
    const unitPrice = Number(price);
    const charges = Number(fees || 0);
    if (!Number.isFinite(quantity) || quantity <= 0) return setError("Enter a quantity greater than zero.");
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) return setError("Enter a valid price per unit.");
    if (!Number.isFinite(charges) || charges < 0) return setError("Fees cannot be negative.");
    if (action === "sell" && quantity > investment.units + 1e-8) return setError(`You currently hold only ${investment.units.toLocaleString("en-IN")} units.`);
    setBusy(true);
    setError("");
    try {
      await onSave({ action, units: quantity, unit_price: unitPrice, fees: charges, occurred_on: date, notes: notes.trim() || null });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save this activity.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="form-overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="form-modal" role="dialog" aria-modal="true" aria-label={investment.name + " activity"}>
        <div className="modal-head">
          <div>
            <h2 className="panel-title" style={{ fontSize: 16 }}>Record investment activity</h2>
            <div className="panel-subtitle">{investment.name} · Held: {investment.units.toLocaleString("en-IN")} units</div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        <form className="modal-body" onSubmit={submit}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8, marginBottom: 16 }}>
            <button className={"btn" + (action === "buy" ? " primary" : "")} type="button" onClick={() => setAction("buy")}><TrendingUp size={14} /> Buy</button>
            <button className={"btn" + (action === "sell" ? " primary" : "")} type="button" onClick={() => setAction("sell")}><TrendingDown size={14} /> Sell</button>
          </div>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="activity-units">Units</label>
              <input id="activity-units" type="number" min="0.000001" step="0.000001" value={units} onChange={event => setUnits(event.target.value)} placeholder="e.g. 10" required />
            </div>
            <div className="field">
              <label htmlFor="activity-price">Price per unit (₹)</label>
              <input id="activity-price" type="number" min="0.000001" step="0.000001" value={price} onChange={event => setPrice(event.target.value)} placeholder="Enter price" required />
            </div>
            <div className="field">
              <label htmlFor="activity-fees">Fees (₹)</label>
              <input id="activity-fees" type="number" min="0" step="0.01" value={fees} onChange={event => setFees(event.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="activity-date">Transaction date</label>
              <input id="activity-date" type="date" value={date} onChange={event => setDate(event.target.value)} required />
            </div>
            <div className="field full">
              <label htmlFor="activity-notes">Note (optional)</label>
              <input id="activity-notes" value={notes} onChange={event => setNotes(event.target.value)} placeholder="e.g. SIP or partial sale" />
            </div>
          </div>
          <p className="transaction-meta" style={{ lineHeight: 1.5, marginTop: 14 }}>
            {action === "buy" ? "The purchase price and fees increase your cost basis." : "Selling uses weighted-average cost basis to calculate realized profit or loss."}
          </p>
          {error && <div className="auth-error">{error}</div>}
          <div className="modal-actions">
            <button className="btn" type="button" onClick={onClose}>Cancel</button>
            <button className="btn primary" type="submit" disabled={busy}>{busy ? "Saving…" : `Save ${action}`}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
