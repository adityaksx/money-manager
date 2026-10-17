"use client";

import { useState } from "react";
import { CalendarClock, X } from "lucide-react";
import { todayISO } from "@/lib/format";

export type RefundRecord = { id: string; amount: number; received_on: string; note: string | null; created_at?: string };
type TransactionRecord = { id: string; kind: "income" | "expense"; amount: number; description: string; category: string; occurred_on: string };

export default function RefundModal({ transaction, refunds, onClose, onSave }: {
  transaction: TransactionRecord;
  refunds: RefundRecord[];
  onClose: () => void;
  onSave: (payload: { amount:number; received_on:string; note:string|null }) => Promise<void>;
}) {
  const [amount,setAmount]=useState("");
  const [date,setDate]=useState(todayISO());
  const [note,setNote]=useState("");
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState("");
  const refunded=refunds.reduce((sum,r)=>sum+Number(r.amount||0),0);
  const remaining=Math.max(0,Number(transaction.amount)-refunded);
  async function submit(e:React.FormEvent<HTMLFormElement>){
    e.preventDefault(); const value=Number(amount);
    if(!Number.isFinite(value)||value<=0){setError("Enter a refund greater than zero.");return;}
    if(value>remaining+0.001){setError("Refund cannot exceed the remaining refundable amount.");return;}
    setBusy(true);setError("");
    try{await onSave({amount:Math.round(value*100)/100,received_on:date,note:note.trim()||null});}
    catch(e){setError(e instanceof Error?e.message:"Could not save refund.");}
    finally{setBusy(false);}
  }
  return <div className="form-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
   <section className="form-modal" role="dialog" aria-modal="true" aria-label="Record refund">
    <div className="modal-head"><div><h2 className="panel-title" style={{fontSize:16}}>Record refund</h2><div className="panel-subtitle">{transaction.description||transaction.category} · {new Date(transaction.occurred_on+"T12:00:00").toLocaleDateString("en-IN")}</div></div><button className="icon-btn" onClick={onClose} aria-label="Close"><X size={16}/></button></div>
    <form className="modal-body" onSubmit={submit}>
     <div className="grid metric-grid" style={{gridTemplateColumns:"repeat(2,minmax(0,1fr))",marginBottom:16}}><div className="metric-card"><div className="metric-note">Original expense</div><div className="metric-value">₹{Number(transaction.amount).toLocaleString("en-IN")}</div></div><div className="metric-card"><div className="metric-note">Still refundable</div><div className="metric-value">₹{remaining.toLocaleString("en-IN")}</div></div></div>
     {refunds.length>0&&<div className="panel" style={{marginBottom:14}}><div className="panel-head"><strong className="panel-title">Refund history</strong></div><div className="panel-body">{refunds.slice().sort((a,b)=>b.received_on.localeCompare(a.received_on)).map(r=><div key={r.id} className="transaction-row"><div><b>₹{Number(r.amount).toLocaleString("en-IN")}</b><div className="transaction-meta"><CalendarClock size={12} style={{display:"inline"}}/> {r.received_on}{r.note?" · "+r.note:""}</div></div></div>)}</div></div>}
     <div className="form-grid">
      <div className="field"><label htmlFor="refund-amount">Refund received (₹)</label><input id="refund-amount" type="number" min="0.01" max={remaining} step="0.01" value={amount} onChange={e=>setAmount(e.target.value)} placeholder="e.g. 1200" required /></div>
      <div className="field"><label htmlFor="refund-date">Refund date</label><input id="refund-date" type="date" value={date} onChange={e=>setDate(e.target.value)} required /></div>
      <div className="field full"><label htmlFor="refund-note">Notes (optional)</label><input id="refund-note" value={note} onChange={e=>setNote(e.target.value)} placeholder="e.g. Flipkart order refund" /></div>
     </div>
     <p className="transaction-meta" style={{lineHeight:1.5,marginTop:12}}>Refunds increase your cash balance and reduce the net cost of this expense. Each refund is separately dated.</p>
     {error&&<div className="auth-error">{error}</div>}
     <div className="modal-actions"><button className="btn" type="button" onClick={onClose}>Cancel</button><button className="btn primary" type="submit" disabled={busy||remaining<=0}>{busy?"Saving…":"Save refund"}</button></div>
    </form>
   </section>
  </div>;
}
