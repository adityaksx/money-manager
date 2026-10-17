"use client";

import { useState } from "react";
import { ArrowDownLeft, ArrowUpRight, HandCoins, Plus, RotateCcw, TrendingUp } from "lucide-react";
import type { DebtRecord, DebtRepaymentRecord } from "@/app/components/debt-modal";
import { formatINR } from "@/lib/format";

export type DebtPosition = DebtRecord & { repaid:number; outstanding:number; repayments:DebtRepaymentRecord[] };
function DebtMetric({label,value,note,icon:Icon,tone="green"}:{label:string;value:number|string;note:string;icon:typeof TrendingUp;tone?:string}){
 const colors:Record<string,{bg:string;fg:string}>={green:{bg:"#e9f6f1",fg:"#16856b"},orange:{bg:"#fff5e8",fg:"#d9913b"},red:{bg:"#fff0f1",fg:"#d95b64"},blue:{bg:"#eef2ff",fg:"#4b71e8"}};
 const color=colors[tone]||colors.green;
 return <div className="metric-card"><div className="metric-top"><span>{label}</span><span className="metric-icon" style={{background:color.bg,color:color.fg}}><Icon size={16}/></span></div><div className="metric-value">{typeof value==="number"?formatINR(value):value}</div><div className="metric-note">{note}</div></div>;
}
export default function PeoplePage({debts,onAdd,onRepay}:{debts:DebtPosition[];onAdd:()=>void;onRepay:(debt:DebtPosition)=>void}){
 const [filter,setFilter]=useState<"all"|"lent"|"borrowed">("all");
 const lent=debts.filter(d=>d.direction==="lent").reduce((s,d)=>s+d.outstanding,0);
 const borrowed=debts.filter(d=>d.direction==="borrowed").reduce((s,d)=>s+d.outstanding,0);
 const rows=debts.filter(d=>filter==="all"||d.direction===filter).sort((a,b)=>b.occurred_on.localeCompare(a.occurred_on));
 return <div>
  <div className="grid metric-grid" style={{marginBottom:16}}>
   <DebtMetric label="Friends owe me" value={lent} note="Outstanding amount lent to others" icon={ArrowDownLeft} tone="green"/>
   <DebtMetric label="I owe others" value={borrowed} note="Outstanding amount borrowed" icon={ArrowUpRight} tone="orange"/>
   <DebtMetric label="Net receivable" value={lent-borrowed} note="Money owed to me less money I owe" icon={HandCoins} tone={lent>=borrowed?"green":"red"}/>
   <DebtMetric label="Open records" value={String(debts.filter(d=>d.outstanding>0.001).length)} note="Unpaid or partially repaid" icon={RotateCcw} tone="blue"/>
  </div>
  <section className="panel">
   <div className="panel-head"><div><h2 className="panel-title">People & repayments</h2><div className="panel-subtitle">Track who owes you and whom you need to repay</div></div><button className="btn primary" onClick={onAdd}><Plus size={15}/> Add record</button></div>
   <div className="panel-body"><div className="filters" style={{marginBottom:14}}><select className="search" style={{width:"auto"}} value={filter} onChange={e=>setFilter(e.target.value as "all"|"lent"|"borrowed")}><option value="all">Everyone</option><option value="lent">They owe me</option><option value="borrowed">I owe them</option></select></div>
    {rows.length===0?<div className="empty">No personal loans recorded yet. Add money you lent or borrowed to begin.</div>:rows.map(d=><div key={d.id} className="panel" style={{marginBottom:12,border:"1px solid #eceef2",boxShadow:"none"}}>
     <div className="panel-head"><div style={{minWidth:0}}><div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}><h3 className="panel-title">{d.person_name}</h3><span className={"pill "+(d.direction==="lent"?"green":"orange")}>{d.direction==="lent"?"They owe me":"I owe them"}</span></div><div className="panel-subtitle">{d.occurred_on}{d.note?" · "+d.note:""}</div></div><div style={{textAlign:"right"}}><div style={{fontWeight:800,fontSize:16}}>{formatINR(d.outstanding)}</div><div className="transaction-meta">Outstanding / {formatINR(Number(d.amount))}</div></div></div>
     <div className="panel-body" style={{paddingTop:0}}><div className="grid" style={{gridTemplateColumns:"repeat(3,minmax(0,1fr))",gap:12}}><div><div className="transaction-meta">Original</div><b>{formatINR(Number(d.amount))}</b></div><div><div className="transaction-meta">Repaid</div><b>{formatINR(d.repaid)}</b></div><div><div className="transaction-meta">Status</div><b>{d.outstanding<=0.001?"Settled":"Open"}</b></div></div>
     {d.repayments.length>0&&<div style={{marginTop:14}}><div className="transaction-meta" style={{marginBottom:6}}>Repayment history</div>{d.repayments.slice().sort((a,b)=>b.occurred_on.localeCompare(a.occurred_on)).map(r=><div key={r.id} className="transaction-row"><div><div style={{fontWeight:650}}>{formatINR(Number(r.amount))}</div><div className="transaction-meta">{r.occurred_on}{r.note?" · "+r.note:""}</div></div><span className="pill green">Repayment</span></div>)}</div>}
     {d.outstanding>0.001&&<div style={{display:"flex",justifyContent:"flex-end",marginTop:12}}><button className="btn" onClick={()=>onRepay(d)}><RotateCcw size={14}/> Record repayment</button></div>}
     </div>
    </div>)}
   </div>
  </section>
 </div>;
}
