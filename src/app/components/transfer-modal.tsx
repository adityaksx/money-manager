"use client";

import { useState } from "react";
import { ArrowDownUp, X } from "lucide-react";
import { todayISO } from "@/lib/format";

export type AccountTransfer = {
  id: string;
  user_id?: string;
  from_account_id: string;
  to_account_id: string;
  amount: number;
  occurred_on: string;
  note: string | null;
  created_at: string;
};
export type AccountTransferInput = {
  from_account_id: string;
  to_account_id: string;
  amount: number;
  occurred_on: string;
  note: string | null;
};
type AccountOption = { id: string; name: string; account_type?: string };

export default function TransferModal({
  accounts,
  initialSourceAccountId = "",
  onClose,
  onSave,
}: {
  accounts: AccountOption[];
  initialSourceAccountId?: string;
  onClose: () => void;
  onSave: (payload: AccountTransferInput) => Promise<void>;
}) {
  const [fromAccountId, setFromAccountId] = useState(
    accounts.some((a) => a.id === initialSourceAccountId)
      ? initialSourceAccountId
      : accounts[0]?.id ?? "",
  );
  const [toAccountId, setToAccountId] = useState(
    accounts.find((a) => a.id !== fromAccountId)?.id ?? "",
  );
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const value = Number(amount);
    if (accounts.length < 2) {
      setError("Add at least two accounts before making a transfer.");
      return;
    }
    if (!fromAccountId || !toAccountId || fromAccountId === toAccountId) {
      setError("Choose two different accounts.");
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }
    setBusy(true);
    try {
      await onSave({
        from_account_id: fromAccountId,
        to_account_id: toAccountId,
        amount: Math.round(value * 100) / 100,
        occurred_on: date,
        note: note.trim() || null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this transfer.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="form-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className="form-modal" role="dialog" aria-modal="true" aria-label="Transfer money between accounts">
        <div className="modal-head">
          <div>
            <h2 className="panel-title" style={{ fontSize: 16 }}>Transfer between accounts</h2>
            <div className="panel-subtitle">Move money without recording income or an expense.</div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={16} /></button>
        </div>
        {accounts.length < 2 ? (
          <div className="modal-body">
            <div className="empty">You need at least two accounts to transfer money. Add another account first.</div>
            <div className="modal-actions"><button type="button" className="btn" onClick={onClose}>Close</button></div>
          </div>
        ) : (
          <form className="modal-body" onSubmit={submit}>
            <div className="form-grid">
              <div className="field">
                <label htmlFor="transfer-from">From account</label>
                <select id="transfer-from" value={fromAccountId} onChange={(e) => {
                  const next = e.target.value;
                  setFromAccountId(next);
                  if (next === toAccountId) setToAccountId(accounts.find((a) => a.id !== next)?.id ?? "");
                }} required>
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="field" style={{ display: "flex", alignItems: "center", justifyContent: "center", paddingTop: 19, color: "#16856b" }}>
                <ArrowDownUp size={19} aria-hidden="true" />
              </div>
              <div className="field full">
                <label htmlFor="transfer-to">To account</label>
                <select id="transfer-to" value={toAccountId} onChange={(e) => setToAccountId(e.target.value)} required>
                  {accounts.filter((a) => a.id !== fromAccountId).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="transfer-amount">Amount (₹)</label>
                <input id="transfer-amount" type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" required />
              </div>
              <div className="field">
                <label htmlFor="transfer-date">Transfer date</label>
                <input id="transfer-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              </div>
              <div className="field full">
                <label htmlFor="transfer-note">Note (optional)</label>
                <input id="transfer-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Savings transfer" maxLength={200} />
              </div>
            </div>
            {error && <div className="auth-error">{error}</div>}
            <div className="modal-actions">
              <button type="button" className="btn" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn primary" disabled={busy}>{busy ? "Saving…" : "Save transfer"}</button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
