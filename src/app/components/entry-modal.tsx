"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { CSSProperties } from "react";
import { dateKey, todayISO } from "@/lib/format";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type Account = { id:string; name:string; account_type:string; opening_balance:number };
type Transaction = { id:string; account_id:string|null; kind:"income"|"expense"; amount:number; category:string; description:string; occurred_on:string; created_at:string };
type Investment = { id:string; asset_type:"stock"|"mutual_fund"|"etf"|"gold"|"other"; name:string; symbol:string|null; platform:string|null; exchange?:string|null; units:number; invested_amount:number; current_value:number; current_price?:number|null; price_updated_at?:string|null; price_source?:string|null; purchase_date:string; notes:string|null };
type Kind = "transaction"|"account"|"budget"|"investment"|"adjustment";
const categories = ["Salary","Freelance","Food & drinks","Groceries","Transport","Shopping","Bills","Education","Entertainment","Health","Rent","Investment","Other"];

const fieldStyle:CSSProperties={display:"grid",gap:7,minWidth:0};
const labelStyle:CSSProperties={fontSize:11,color:"#626978",fontWeight:700};
const controlStyle:CSSProperties={width:"100%",minWidth:0,padding:"11px 12px",borderRadius:9,border:"1px solid #e2e5eb",background:"#fff",color:"#171a22"};
function Field({label,children,full=false}:{label:string;children:React.ReactNode;full?:boolean}){return <div style={{...fieldStyle,gridColumn:full?"1 / -1":undefined}}><label style={labelStyle}>{label}</label>{children}</div>}
function Input({value,onChange,type="text",placeholder,required=false,min,step}:{value:string;onChange:(v:string)=>void;type?:string;placeholder?:string;required?:boolean;min?:string;step?:string}){return <input style={controlStyle} type={type} value={value} placeholder={placeholder} onChange={e=>onChange(e.target.value)} required={required} min={min} step={step}/>;}
function Select({value,onChange,children}:{value:string;onChange:(v:string)=>void;children:React.ReactNode}){return <select style={controlStyle} value={value} onChange={e=>onChange(e.target.value)}>{children}</select>;}

export default function EntryModal({kind,accounts,selectedAccountId,transaction,investment,onClose,onSave}:{kind:Kind;accounts:Account[];selectedAccountId:string;transaction:Transaction|null;investment:Investment|null;onClose:()=>void;onSave:(payload:unknown)=>Promise<void>|void}){
 const [busy,setBusy]=useState(false),[error,setError]=useState("");
 const [type,setType]=useState<"income"|"expense">(transaction?.kind??"expense");
 const [accountId,setAccountId]=useState(transaction?.account_id??accounts[0]?.id??"");
 const [name,setName]=useState(""); const [accountType,setAccountType]=useState("bank"); const [institution,setInstitution]=useState("");
 const [openingBalance,setOpeningBalance]=useState("0"); const [category,setCategory]=useState(transaction?.category??"Food & drinks");
 const [amount,setAmount]=useState(transaction?String(transaction.amount):""); const [description,setDescription]=useState(transaction?.description??"");
 const [date,setDate]=useState(transaction?.occurred_on??investment?.purchase_date??todayISO());
 const [budgetCategory,setBudgetCategory]=useState("Food & drinks"); const [budgetLimit,setBudgetLimit]=useState("");
 const [assetType,setAssetType]=useState<Investment["asset_type"]>(investment?.asset_type??"stock");
 const [assetName,setAssetName]=useState(investment?.name??""); const [symbol,setSymbol]=useState(investment?.symbol??"");
 const [platform,setPlatform]=useState(investment?.platform??""); const [units,setUnits]=useState(investment?String(investment.units):"");
 const [notes,setNotes]=useState(investment?.notes??""); const [adjustmentAmount,setAdjustmentAmount]=useState("");
 const [exchange,setExchange]=useState(investment?.exchange??"");
 const [fees,setFees]=useState("0");
 const [purchasePrice,setPurchasePrice]=useState(investment&&investment.units>0?String(investment.invested_amount/investment.units):"");
 const [currentPrice,setCurrentPrice]=useState(investment?.current_price?String(investment.current_price):investment&&investment.units>0?String(investment.current_value/investment.units):"");
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
    payload={category:budgetCategory,monthly_limit:Number(budgetLimit),month:dateKey(new Date(new Date().getFullYear(),new Date().getMonth(),1))};
   }else if(kind==="investment"){
    if(!assetName.trim())throw new Error("Enter the investment name.");
    const quantity=Number(units);
    const charges=Number(fees||0);
    if(!Number.isFinite(quantity)||quantity<=0)throw new Error("Enter units greater than zero.");
    if(!Number.isFinite(charges)||charges<0)throw new Error("Fees cannot be negative.");
    let unitPrice=Number(purchasePrice||0);
    let marketPrice=Number(currentPrice||0);
    let quoteSource="Manual price";
    let quoteDate:string|null=null;

    if(!investment){
     if(symbol.trim()&&["stock","etf","mutual_fund"].includes(assetType)&&(!unitPrice||!marketPrice)){
      try{
       const client=getSupabaseBrowserClient();
       const {data:sessionData}=await client?.auth.getSession()??{data:{session:null}};
       if(!sessionData.session?.access_token)throw new Error("Your login session expired. Sign in again.");
       const params=new URLSearchParams({symbol:symbol.trim(),type:assetType,date});
       const response=await fetch(`/api/market/quote?${params.toString()}`,{headers:{Authorization:`Bearer ${sessionData.session.access_token}`}});
       const quote=await response.json();
       if(!response.ok)throw new Error(quote.error||"Market quote unavailable.");
       if(!unitPrice&&Number(quote.historicalPrice)>0)unitPrice=Number(quote.historicalPrice);
       if(!marketPrice&&Number(quote.currentPrice)>0)marketPrice=Number(quote.currentPrice);
       quoteSource=String(quote.source||quoteSource);
       quoteDate=quote.currentDate??null;
      }catch(quoteError){
       if(!unitPrice)throw new Error(quoteError instanceof Error?quoteError.message:"Could not fetch the purchase-date price. Enter it manually.");
      }
     }
     if(!Number.isFinite(unitPrice)||unitPrice<=0)throw new Error("Purchase price was not found for that date. Enter the price per unit manually.");
     if(!Number.isFinite(marketPrice)||marketPrice<=0){marketPrice=unitPrice;quoteSource="Manual price (purchase price used until refreshed)";}
     payload={
      investment:{asset_type:assetType,name:assetName.trim(),symbol:symbol.trim()||null,platform:platform.trim()||null,exchange:exchange.trim()||null,units:quantity,invested_amount:quantity*unitPrice+charges,current_value:quantity*marketPrice,current_price:marketPrice,price_source:quoteSource,price_updated_at:quoteDate?new Date(quoteDate+"T12:00:00Z").toISOString():new Date().toISOString(),purchase_date:date,notes:notes.trim()||null},
      activity:{action:"buy",units:quantity,unit_price:unitPrice,fees:charges,occurred_on:date,notes:notes.trim()||null}
     };
    }else{
     if(!Number.isFinite(marketPrice)||marketPrice<=0)throw new Error("Enter a valid current price per unit.");
     payload={update:{asset_type:assetType,name:assetName.trim(),symbol:symbol.trim()||null,platform:platform.trim()||null,exchange:exchange.trim()||null,current_price:marketPrice,current_value:quantity*marketPrice,price_source:"Manual price",price_updated_at:new Date().toISOString(),notes:notes.trim()||null}};
    }
   }else{
    if(!selectedAccountId&&!accountId)throw new Error("Choose an account.");
    if(!adjustmentAmount||Number(adjustmentAmount)===0)throw new Error("Enter a non-zero adjustment. Use negative values to reduce the balance.");
    payload={account_id:selectedAccountId||accountId,amount:Number(adjustmentAmount),note:adjustmentNote.trim()||"Balance adjustment",occurred_on:date};
   }
   await onSave(payload);
  }catch(err){setError(err instanceof Error?err.message:"Unable to save this entry.");}
  finally{setBusy(false);}
 }
 return <div className="form-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><section className="form-modal" role="dialog" aria-modal="true" aria-label={title[kind]}><div className="modal-head"><div><h2 className="panel-title" style={{fontSize:16}}>{title[kind]}</h2><div className="panel-subtitle">{kind==="account"?"Use the current or previous balance as your starting point.":kind==="investment"?"Track your holdings independently from bank cash.":kind==="adjustment"?"Positive adds to balance; negative reduces it.":"Your record stays private to your account."}</div></div><button className="icon-btn" onClick={onClose} aria-label="Close"><X size={16}/></button></div>
 <form className="modal-body" onSubmit={submit}><div className="form-grid">
 {kind==="transaction"&&<>
  <Field label="Transaction type" full><div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:6}}>{(["expense","income"] as const).map(k=><button type="button" key={k} className={"btn"+(type===k?" primary":"")} onClick={()=>{setType(k);setCategory(k==="income"?"Salary":"Food & drinks");}}>{k[0].toUpperCase()+k.slice(1)}</button>)}</div></Field>
  <Field label="Amount (₹)"><Input value={amount} onChange={setAmount} type="number" min="0.01" step="0.01" placeholder="0.00" required/></Field>
  <Field label="Date"><Input value={date} onChange={setDate} type="date" required/></Field>
  <Field label="Category"><Select value={category} onChange={setCategory}>{(type==="income"?["Salary","Freelance","Interest","Refund","Other"]:categories.filter(c=>c!=="Salary"&&c!=="Freelance")).map(c=><option key={c}>{c}</option>)}</Select></Field>
  <Field label="Account"><Select value={accountId} onChange={setAccountId}><option value="">No account</option>{accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</Select></Field>
  <Field label="Description" full><Input value={description} onChange={setDescription} placeholder="e.g. Monthly salary, groceries…"/></Field>
 </>}
 {kind==="account"&&<>
  <Field label="Account name"><Input value={name} onChange={setName} placeholder="e.g. Canara Savings" required/></Field>
  <Field label="Account type"><Select value={accountType} onChange={setAccountType}><option value="bank">Bank account</option><option value="cash">Cash</option><option value="wallet">Digital wallet</option></Select></Field>
  <Field label="Bank / institution"><Input value={institution} onChange={setInstitution} placeholder="e.g. Canara Bank"/></Field>
  <Field label="Previous / opening balance (₹)"><Input value={openingBalance} onChange={setOpeningBalance} type="number" min="0" step="0.01" required/></Field>
  <Field label="Currency" full><input style={{...controlStyle,background:"#f8f9fb"}} value="Indian Rupee (INR)" readOnly/></Field>
 </>}
 {kind==="budget"&&<>
  <Field label="Expense category"><Select value={budgetCategory} onChange={setBudgetCategory}>{categories.filter(c=>!["Salary","Freelance"].includes(c)).map(c=><option key={c}>{c}</option>)}</Select></Field>
  <Field label="Monthly limit (₹)"><Input value={budgetLimit} onChange={setBudgetLimit} type="number" min="1" step="1" placeholder="5000" required/></Field>
  <Field label="Budget period" full><input style={{...controlStyle,background:"#f8f9fb"}} readOnly value={new Date().toLocaleDateString("en-IN",{month:"long",year:"numeric"})}/></Field>
 </>}
 {kind==="investment"&&<>
  <Field label="Asset class"><Select value={assetType} onChange={v=>setAssetType(v as Investment["asset_type"])}><option value="stock">Stock</option><option value="mutual_fund">Mutual fund (India)</option><option value="etf">ETF</option><option value="gold">Gold</option><option value="other">Other</option></Select></Field>
  <Field label="Investment name"><Input value={assetName} onChange={setAssetName} placeholder="e.g. Reliance Industries" required/></Field>
  <Field label={assetType==="mutual_fund"?"AMFI scheme code / ISIN":"Market symbol"}><Input value={symbol} onChange={setSymbol} placeholder={assetType==="mutual_fund"?"e.g. 120586 or INF109K01480":assetType==="stock"||assetType==="etf"?"e.g. RELIANCE.NS, GOLDBEES.NS, AAPL":"Optional"}/></Field>
  <Field label="Exchange / market"><Select value={exchange} onChange={setExchange}><option value="">Not specified</option><option value="NSE">NSE (India)</option><option value="BSE">BSE (India)</option><option value="NASDAQ">NASDAQ / US</option><option value="NYSE">NYSE / US</option><option value="OTHER">Other</option></Select></Field>
  <Field label="Platform / broker"><Input value={platform} onChange={setPlatform} placeholder="e.g. Zerodha, Groww"/></Field>
  {!investment&&<>
   <Field label="Buy date"><Input value={date} onChange={setDate} type="date" required/></Field>
   <Field label="Units purchased"><Input value={units} onChange={setUnits} type="number" min="0.000001" step="0.000001" placeholder="e.g. 10" required/></Field>
   <Field label="Purchase price per unit (₹)"><Input value={purchasePrice} onChange={setPurchasePrice} type="number" min="0" step="0.000001" placeholder="Leave blank to fetch history"/></Field>
   <Field label="Fees / taxes (₹)"><Input value={fees} onChange={setFees} type="number" min="0" step="0.01" placeholder="0"/></Field>
  </>}
  <Field label="Current price per unit (₹)"><Input value={currentPrice} onChange={setCurrentPrice} type="number" min="0" step="0.000001" placeholder={investment?"Enter a manual price":"Leave blank to fetch latest price"}/></Field>
  <Field label="Notes" full><Input value={notes} onChange={setNotes} placeholder="Optional note"/></Field>
  <p className="transaction-meta" style={{gridColumn:"1/-1",lineHeight:1.5,margin:0}}>{investment?"Saving a manual current price updates this holding; use Refresh prices to fetch the provider quote again.":"Leave the purchase price blank to look up the price around your buy date. Stocks/ETFs use Yahoo Finance symbols; Indian mutual funds use an AMFI scheme code or ISIN. If a quote is unavailable, enter prices manually."}</p>
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
