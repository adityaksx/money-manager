"use client";

import { useState } from "react";
import { X, Plus, ArrowLeftRight } from "lucide-react";
import type { CSSProperties } from "react";

type Account = { id:string; name:string; account_type:string; opening_balance:number };
type Transaction = { id:string; account_id:string|null; kind:"income"|"expense"|"transfer"; amount:number; category:string; description:string; occurred_on:string; created_at:string };
type Investment = { id:string; asset_type:"stock"|"mutual_fund"|"etf"|"gold"|"other"; name:string; symbol:string|null; platform:string|null; units:number; invested_amount:number; current_value:number; purchase_date:string; notes:string|null };
type Budget = { id:string; category:string; monthly_limit:number; month:string };
type Kind = "transaction"|"account"|"budget"|"investment"|"adjustment";
const categories = ["Salary","Freelance","Food & drinks","Groceries","Transport","Shopping","Bills","Education","Entertainment","Health","Rent","Investment","Other"];

export default function EntryModal({kind,accounts,selectedAccountId,transaction,investment,onClose,onSave}:{kind:Kind;accounts:Account[];selectedAccountId:string;transaction:Transaction|null;investment:Investment|null;onClose:()=>void;onSave:(payload:unknown)=>Promise<void>|void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 const [type,setType]=useState<"income"|"expense"|"transfer">(transaction?.kind??"expense");
 const [accountId,setAccountId]=useState(transaction?.account_id??accounts[0]?.id??"");
 const [name,setName]=useState(""); const [accountType,setAccountType]=useState("bank"); const [institution,setInstitution]=useState("");
 const [openingBalance,setOpeningBalance]=useState("0"); const [category,setCategory]=useState(transaction?.category??"Food & drinks");
 const [amount,setAmount]=useState(transaction?String(transaction.amount):""); const [description,setDescription]=useState(transaction?.description??"");
 const [date,setDate]=useState(transaction?.occurred_on??new Date().toISOString().slice(0,10));
 const [budgetCategory,setBudgetCategory]=useState("Food & drinks"); const [budgetLimit,setBudgetLimit]=useState("");
 const [assetType,setAssetType]=useState<Investment["asset_type"]>(investment?.asset_type??"stock");
 const [assetName,setAssetName]=useState(investment?.name??""); const [symbol,setSymbol]=useState(investment?.symbol??"");
 const [platform,setPlatform]=useState(investment?.platform??""); const [units,setUnits]=useState(investment?String(investment.units):"");
 const [investedAmount,setInvestedAmount]=useState(investment?String(investment.invested_amount):"");
 const [currentValue,setCurrentValue]=useState(investment?String(investment.current_value):"");
 const [notes,setNotes]=useState(investment?.notes??""); const [adjustmentAmount,setAdjustmentAmount]=useState("");
 const [adjustmentNote,setAdjustmentNote]=useState("Balance correction");
 useEffect(()=>{if(selectedAccountId)setAccountId(selectedAccountId);},[selectedAccountId]);
 const title:Record<Kind,string>={transaction:transaction?"Edit transaction":"Add transaction",account:"Add account",budget:"Set monthly budget",investment:investment?"Edit investment":"Add investment",adjustment:"Adjust account balance"};
 async function submit(e:React.FormEvent<HTMLFormElement>){
  e.preventDefault();setBusy(true);setError("");
  try{
   let payload:Record<string,unknown>;
   if(kind==="transaction"){
    if(!amount||Number(amount)<=0)throw new Error("Enter an amount greater than zero.");
    if(!category)throw new Error("Select a category.");
    payload={kind:type,amount:Number(amount),category,description:description.trim(),occurred_on:date,account_id:accountId||null};
   }else if(kind==="account"){
    if(!name.trim())throw new Error("Enter an account name.");
    if(Number(openingBalance)<0)throw new Error("Opening balance cannot be negative.");
    payload={name:name.trim(),account_type:accountType,institution:institution.trim()||null,opening_balance:Number(openingBalance||0),currency:"INR",color:"#16856b"};
   }else if(kind==="budget"){
    if(!budgetLimit||Number(budgetLimit)<=0)throw new Error("Budget must be greater than zero.");
    payload={category:budgetCategory,monthly_limit:Number(budgetLimit),month:new Date(new Date().getFullYear(),new Date().getMonth(),1).toISOString().slice(0,10)};
   }else if(kind==="investment"){
    if(!assetName.trim())throw new Error("Enter the investment name.");
    if(Number(investedAmount)<0||Number(currentValue)<0)throw new Error("Values cannot be negative.");
    payload={asset_type:assetType,name:assetName.trim(),symbol:symbol.trim()||null,platform:platform.trim()||null,units:Number(units||0),invested_amount:Number(investedAmount||0),current_value:Number(currentValue||0),purchase_date:date,notes:notes.trim()||null};
   }else{
    if(!selectedAccountId&&!accountId)throw new Error("Choose an account.");
    if(!adjustmentAmount||Number(adjustmentAmount)===0)throw new Error("Enter a non-zero adjustment. Use negative values to reduce the balance.");
    payload={account_id:selectedAccountId||accountId,amount:Number(adjustmentAmount),note:adjustmentNote.trim()||"Balance adjustment",occurred_on:date};
   }
   await onSave(payload);
  }catch(err){setError(err instanceof Error?err.message:"Unable to save this entry.");}
  finally{setBusy(false);}
 }
 const field:CSSProperties={display:"grid",gap:7,minWidth:0}, label:CSSProperties={fontSize:11,color:"#626978",fontWeight:700}, control:CSSProperties={width:"100%",minWidth:0,padding:"11px 12px",borderRadius:9,border:"1px solid #e2e5eb",background:"#fff",color:"#171a22"};
 function Field({label,children,full=false}:{label:string;children:React.ReactNode;full?:boolean}){return <div style={{...field,gridColumn:full?"1 / -1":undefined}}><label style={labelStyle}>{label}</label>{children}</div>}
 const labelStyle=label;
 function Input({value,onChange,type="text",placeholder,required=false,min,step}:{value:string;onChange:(v:string)=>void;type?:string;placeholder?:string;required?:boolean;min?:string;step?:string}){return <input style={control} type={type} value={value} placeholder={placeholder} onChange={e=>onChange(e.target.value)} required={required} min={min} step={step}/>;}
 function Select({value,onChange,children}:{value:string;onChange:(v:string)=>void;children:React.ReactNode}){return <select style={control} value={value} onChange={e=>onChange(e.target.value)}>{children}</select>;}
 return <div className="form-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><section className="form-modal" role="dialog" aria-modal="true" aria-label={title[kind]}><div className="modal-head"><div><h2 className="panel-title" style={{fontSize:16}}>{title[kind]}</h2><div className="panel-subtitle">{kind==="account"?"Use the current or previous balance as your starting point.":kind==="investment"?"Track your holdings independently from bank cash.":kind==="adjustment"?"Positive adds to balance; negative reduces it.":"Your record stays private to your account."}</div></div><button className="icon-btn" onClick={onClose} aria-label="Close"><X size={16}/></button></div>
 <form className="modal-body" onSubmit={submit}><div className="form-grid">
 {kind==="transaction"&&<>
  <Field label="Transaction type" full><div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:6}}>{(["expense","income","transfer"] as const).map(k=><button type="button" key={k} className={"btn"+(type===k?" primary":"")} onClick={()=>{setType(k);if(k==="income"&&category==="Food & drinks")setCategory("Salary");if(k==="expense"&&category==="Salary")setCategory("Food & drinks");}}>{k[0].toUpperCase()+k.slice(1)}</button>)}</div></Field>
  <Field label="Amount (₹)"><Input value={amount} onChange={setAmount} type="number" min="0.01" step="0.01" placeholder="0.00" required/></Field>
  <Field label="Date"><Input value={date} onChange={setDate} type="date" required/></Field>
  <Field label="Category"><Select value={category} onChange={setCategory}>{(type==="income"?["Salary","Freelance","Interest","Refund","Other"]:type==="transfer"?["Transfer","Investment","Savings","Other"]:categories.filter(c=>c!=="Salary"&&c!=="Freelance")).map(c=><option key={c}>{c}</option>)}</Select></Field>
  <Field label="Account"><Select value={accountId} onChange={setAccountId}><option value="">No account</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
  <Field label="Description" full><Input value={description} onChange={setDescription} placeholder="e.g. Monthly salary, groceries…"/></Field>
 </>}
 {kind==="account"&&<>
  <Field label="Account name"><Input value={name} onChange={setName} placeholder="e.g. Canara Savings" required/></Field>
  <Field label="Account type"><Select value={accountType} onChange={setAccountType}><option value="bank">Bank account</option><option value="cash">Cash</option><option value="wallet">Digital wallet</option></Select></Field>
  <Field label="Bank / institution"><Input value={institution} onChange={setInstitution} placeholder="e.g. Canara Bank"/></Field>
  <Field label="Previous / opening balance (₹)"><Input value={openingBalance} onChange={setOpeningBalance} type="number" min="0" step="0.01" required/></Field>
  <Field label="Currency" full><input style={{...control,background:"#f8f9fb"}} value="Indian Rupee (INR)" readOnly/></Field>
 </>}
 {kind==="budget"&&<>
  <Field label="Expense category"><Select value={budgetCategory} onChange={setBudgetCategory}>{categories.filter(c=>!["Salary","Freelance"].includes(c)).map(c=><option key={c}>{c}</option>)}</Select></Field>
  <Field label="Monthly limit (₹)"><Input value={budgetLimit} onChange={setBudgetLimit} type="number" min="1" step="1" placeholder="5000" required/></Field>
  <Field label="Budget period" full><input style={{...control,background:"#f8f9fb"}} readOnly value={new Date().toLocaleDateString("en-IN",{month:"long",year:"numeric"})}/></Field>
 </>}
 {kind==="investment"&&<>
  <Field label="Asset class"><Select value={assetType} onChange={v=>setAssetType(v as Investment["asset_type"])}><option value="stock">Stock</option><option value="mutual_fund">Mutual fund</option><option value="etf">ETF</option><option value="gold">Gold</option><option value="other">Other</option></Select></Field>
  <Field label="Name"><Input value={assetName} onChange={setAssetName} placeholder="e.g. Nifty 50 ETF" required/></Field>
  <Field label="Symbol / scheme"><Input value={symbol} onChange={setSymbol} placeholder="e.g. GOLDBEES"/></Field>
  <Field label="Platform / broker"><Input value={platform} onChange={setPlatform} placeholder="e.g. Zerodha, Groww"/></Field>
  <Field label="Invested amount (₹)"><Input value={investedAmount} onChange={setInvestedAmount} type="number" min="0" step="0.01" required/></Field>
  <Field label="Current value (₹)"><Input value={currentValue} onChange={setCurrentValue} type="number" min="0" step="0.01" required/></Field>
  <Field label="Units (optional)"><Input value={units} onChange={setUnits} type="number" min="0" step="0.000001" placeholder="0"/></Field>
  <Field label="As of / purchase date"><Input value={date} onChange={setDate} type="date" required/></Field>
  <Field label="Notes" full><Input value={notes} onChange={setNotes} placeholder="Optional notes"/></Field>
 </>}
 {kind==="adjustment"&&<>
  <Field label="Account" full><Select value={selectedAccountId||accountId} onChange={setAccountId}>{accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
  <Field label="Adjustment amount (₹)"><Input value={adjustmentAmount} onChange={setAdjustmentAmount} type="number" step="0.01" placeholder="e.g. 250 or -100" required/></Field>
  <Field label="Date"><Input value={date} onChange={setDate} type="date" required/></Field>
  <Field label="Reason" full><Input value={adjustmentNote} onChange={setAdjustmentNote} placeholder="Balance correction"/></Field>
 </>}
 </div>
 {error&&<div className="auth-error">{error}</div>}
 <div className="modal-actions"><button className="btn" type="button" onClick={onClose}>Cancel</button><button className="btn primary" type="submit" disabled={busy}>{busy?"Saving…":kind==="account"?"Create account":kind==="budget"?"Save budget":kind==="adjustment"?"Save adjustment":kind==="investment"?(investment?"Save changes":"Add holding"):(transaction?"Save changes":"Add transaction")}</button></div>
 </form></section></div>;
}
