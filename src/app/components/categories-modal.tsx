"use client";

import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import type { CategoryRecord, TransactionKind } from "@/lib/categories";

export default function CategoriesModal({categories,onClose,onAdd,onDelete}:{categories:CategoryRecord[];onClose:()=>void;onAdd:(payload:{kind:TransactionKind;name:string})=>Promise<void>;onDelete:(category:CategoryRecord)=>Promise<void>}){
 const [kind,setKind]=useState<TransactionKind>("expense");
 const [name,setName]=useState("");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 async function submit(e:React.FormEvent<HTMLFormElement>){e.preventDefault();const value=name.trim();if(!value){setError("Enter a category name.");return;}if(value.length>48){setError("Category name must be 48 characters or fewer.");return;}setBusy(true);setError("");try{await onAdd({kind,name:value});setName("");}catch(e){setError(e instanceof Error?e.message:"Could not add category.");}finally{setBusy(false);}}
 return <div className="form-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
  <section className="form-modal" role="dialog" aria-modal="true" aria-label="Manage categories">
   <div className="modal-head"><div><h2 className="panel-title" style={{fontSize:16}}>Manage categories</h2><div className="panel-subtitle">Default categories stay available; add your own any time.</div></div><button className="icon-btn" onClick={onClose} aria-label="Close"><X size={16}/></button></div>
   <div className="modal-body">
    <form onSubmit={submit}>
     <div className="form-grid"><div className="field"><label htmlFor="cat-kind">Type</label><select id="cat-kind" value={kind} onChange={e=>setKind(e.target.value as TransactionKind)}><option value="expense">Expense</option><option value="income">Income</option></select></div><div className="field"><label htmlFor="cat-name">Category name</label><input id="cat-name" maxLength={48} value={name} onChange={e=>setName(e.target.value)} placeholder={kind==="expense"?"e.g. Pets, Gym":"e.g. Scholarship"} required /></div></div>
     {error&&<div className="auth-error" style={{marginTop:10}}>{error}</div>}
     <button className="btn primary" style={{marginTop:12}} type="submit" disabled={busy}><Plus size={14}/>{busy?"Adding…":"Add category"}</button>
    </form>
    <div className="divider" style={{height:1,background:"#eceef2",margin:"18px 0"}}/>
    {(["expense","income"] as const).map(k=><div key={k} style={{marginBottom:18}}><h3 className="panel-title" style={{marginBottom:9}}>{k==="expense"?"Expense categories":"Income categories"}</h3><div style={{display:"flex",gap:8,flexWrap:"wrap"}}>{categories.filter(c=>c.kind===k).map(c=><span key={c.id} className={"pill "+(c.is_default?"green":"blue")} style={{display:"inline-flex",alignItems:"center",gap:7,padding:"7px 9px"}}>{c.name}{c.is_default?<small>Default</small>:<button type="button" className="icon-btn" aria-label={"Delete "+c.name} style={{width:20,height:20}} onClick={()=>void onDelete(c)}><Trash2 size={11}/></button>}</span>)}</div></div>)}
   </div>
   <div className="modal-actions" style={{paddingTop:0}}><button className="btn" onClick={onClose}>Done</button></div>
  </section>
 </div>;
}
