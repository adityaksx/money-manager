"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { todayISO } from "@/lib/format";

export type DebtRecord = { id:string; direction:"lent"|"borrowed"; person_name:string; amount:number; occurred_on:string; account_id:string|null; note:string|null; transaction_id:string; created_at:string };
export type DebtRepaymentRecord = { id:string; debt_id:string; amount:number; occurred_on:string; note:string|null; transaction_id:string; created_at:string };
export type DebtInput = { person_name:string; direction:"lent"|"borrowed"; amount:number; occurred_on:string; account_id:string|null; note:string|null };
export type RepaymentInput = { amount:number; occurred_on:string; note:string|null };

export default function DebtModal({kind,accounts,debt,onClose,onSaveDebt,onSaveRepayment}:{kind:"new"|"repayment";accounts:{id:string;name:string}[];debt?:DebtRecord&{repaid:number;outstanding:number};onClose:()=>void;onSaveDebt:(payload:DebtInput)=>Promise<void>;onSaveRepayment:(payload:RepaymentInput)=>Promise<void>}){
 const [person,setPerson]=useState(debt?.person_name??"");
 const [direction,setDirection]=useState<"lent"|"borrowed">("lent");
 const [amount,setAmount]=useState("");
 const [date,setDate]=useState(todayISO());
 const [accountId,setAccountId]=useState(accounts[0]?.id??"");
 const [note,setNote]=useState("");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();const value=Number(amount);if(!Number.isFinite(value)||value<=0){setError("Enter an amount greater than zero.");return;}if(kind==="repayment"&&debt&&value>debt.outstanding+0.001){setError("Repayment cannot exceed the outstanding amount.");return;}setBusy(true);setError("");try{if(kind==="new"){if(!person.trim())throw new Error("Enter the person's name.");await onSaveDebt({person_name:person.trim(),direction,amount:value,occurred_on:date,account_id:accountId||null,note:note.trim()||null});}else{await onSaveRepayment({amount:value,occurred_on:date,note:note.trim()||null});}}catch(e){setError(e instanceof Error?e.message:"Could not save this record.");}finally{setBusy(false);}}
 return <div className="form-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><section className="form-modal" role="dialog" aria-modal="true" aria-label={kind==="new"?"Track money owed":"Record repayment"}><div className="modal-head"><div><h2 className="panel-title" style={{fontSize:16}}>{kind==="new"?"Track money owed":"Record repayment"}</h2><div className="panel-subtitle">{kind==="new"?"Record money you lend or borrow.":debt?debt.person_name+" · outstanding ₹"+debt.outstanding.toLocaleString("en-IN"):"Repayment"}</div></div><button className="icon-btn" onClick={onClose} aria-label="Close"><X size={16}/></button></div>
 <form className="modal-body" onSubmit={submit}><div className="form-grid">
 {kind==="new"&&<><div className="field full"><label htmlFor="debt-person">Person</label><input id="debt-person" value={person} onChange={e=>setPerson(e.target.value)} placeholder="Friend's name" required /></div><div className="field full"><label>Direction</label><div className="filters"><button type="button" className={"btn"+(direction==="lent"?" primary":"")} onClick={()=>setDirection("lent")}>They owe me</button><button type="button" className={"btn"+(direction==="borrowed"?" primary":"")} onClick={()=>setDirection("borrowed")}>I owe them</button></div></div></>}
 <div className="field"><label htmlFor="debt-amount">{kind==="new"?"Original amount (₹)":"Repayment amount (₹)"}</label><input id="debt-amount" type="number" min="0.01" step="0.01" max={kind==="repayment"?debt?.outstanding:undefined} value={amount} onChange={e=>setAmount(e.target.value)} required /></div>
 <div className="field"><label htmlFor="debt-date">{kind==="new"?"Date given / received":"Repayment date"}</label><input id="debt-date" type="date" value={date} onChange={e=>setDate(e.target.value)} required /></div>
 {kind==="new"&&<div className="field"><label htmlFor="debt-account">Cash account</label><select id="debt-account" value={accountId} onChange={e=>setAccountId(e.target.value)}><option value="">No account</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></div>}
 <div className="field full"><label htmlFor="debt-note">Note (optional)</label><input id="debt-note" value={note} onChange={e=>setNote(e.target.value)} placeholder="e.g. Shared trip, lunch" /></div>
 </div>
 {error&&<div className="auth-error">{error}</div>}
 <div className="modal-actions"><button type="button" className="btn" onClick={onClose}>Cancel</button><button type="submit" className="btn primary" disabled={busy}>{busy?"Saving…":kind==="new"?"Save debt":"Save repayment"}</button></div>
 </form></section></div>;
}
