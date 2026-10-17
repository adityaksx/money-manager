"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Banknote, ChartNoAxesCombined, ChevronDown, CircleDollarSign, CreditCard, Gem, LayoutDashboard, Landmark, Layers3, LoaderCircle, LogOut, MoreHorizontal, Pencil, PieChart, Plus, Search, ShieldCheck, ShoppingBag, Target, Trash2, TrendingDown, TrendingUp, Wallet, X } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { dateKey, formatINR, monthRange, todayISO } from "@/lib/format";
import EntryModal from "@/app/entry-modal";

type Page = "Overview" | "Transactions" | "Budgets" | "Bank accounts" | "Investments";
type Account = { id: string; name: string; account_type: string; institution: string | null; opening_balance: number; color: string; created_at: string };
type Transaction = { id: string; account_id: string | null; kind: "income" | "expense"; amount: number; category: string; description: string; occurred_on: string; created_at: string };
type Budget = { id: string; category: string; monthly_limit: number; month: string };
type Investment = { id: string; asset_type: "stock" | "mutual_fund" | "etf" | "gold" | "other"; name: string; symbol: string | null; platform: string | null; units: number; invested_amount: number; current_value: number; purchase_date: string; notes: string | null };
type AuthUser = { id: string; email?: string; user_metadata?: Record<string, string> };

const nav: { name: Page; icon: typeof LayoutDashboard }[] = [
  { name: "Overview", icon: LayoutDashboard }, { name: "Transactions", icon: ArrowLeftRight },
  { name: "Budgets", icon: Target }, { name: "Bank accounts", icon: Landmark }, { name: "Investments", icon: ChartNoAxesCombined },
];
const expenseCategories = ["Food & drinks", "Groceries", "Transport", "Shopping", "Bills", "Education", "Entertainment", "Health", "Rent", "Investment", "Other"];
const assetLabels: Record<Investment["asset_type"], string> = { stock: "Stocks", mutual_fund: "Mutual funds", etf: "ETFs", gold: "Gold", other: "Other" };
const assetIcons: Record<Investment["asset_type"], typeof TrendingUp> = { stock: TrendingUp, mutual_fund: Layers3, etf: PieChart, gold: Gem, other: TrendingUp };
const num = (value: unknown) => Number(value ?? 0) || 0;
function dateLabel(date: string) { return new Date(date + "T12:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" }); }
function monthLabel(date = new Date()) { return date.toLocaleDateString("en-IN", { month: "long", year: "numeric" }); }

export default function Home() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [page, setPage] = useState<Page>("Overview");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const [authError, setAuthError] = useState("");
  const [googleBusy, setGoogleBusy] = useState(false);
  const [modal, setModal] = useState<"transaction" | "account" | "budget" | "investment" | "adjustment" | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [transactionFilter, setTransactionFilter] = useState<"all" | "income" | "expense">("all");
  const [period, setPeriod] = useState<"This month" | "Last 6 months">("This month");

  const loadData = useCallback(async () => {
    if (!supabase || !user) return;
    setLoading(true);
    const [a, t, b, i, adj] = await Promise.all([
      supabase.from("mm_accounts").select("id,name,account_type,institution,opening_balance,color,created_at").order("created_at", { ascending: true }),
      supabase.from("mm_transactions").select("id,account_id,kind,amount,category,description,occurred_on,created_at").order("occurred_on", { ascending: false }).limit(500),
      supabase.from("mm_budgets").select("id,category,monthly_limit,month").order("category"),
      supabase.from("mm_investments").select("id,asset_type,name,symbol,platform,units,invested_amount,current_value,purchase_date,notes").order("created_at", { ascending: false }),
      supabase.from("mm_account_adjustments").select("account_id,amount"),
    ]);
    const errors = [a.error, t.error, b.error, i.error, adj.error].filter(Boolean);
    if (errors.length) setNotice(errors[0]?.message ?? "Could not load your data.");
    else {
      setAccounts((a.data ?? []) as Account[]);
      setTransactions((t.data ?? []) as Transaction[]);
      setBudgets((b.data ?? []) as Budget[]);
      setInvestments((i.data ?? []) as Investment[]);
      setAccountAdjustments((adj.data ?? []) as { account_id: string; amount: number }[]);
      setNotice("");
    }
    setLoading(false);
  }, [supabase, user]);

  const [accountAdjustments, setAccountAdjustments] = useState<{ account_id: string; amount: number }[]>([]);
  useEffect(() => {
    if (!supabase) { setCheckingAuth(false); return; }
    let alive = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!alive) return;
      setUser(data.session?.user as AuthUser ?? null);
      setCheckingAuth(false);
    }).catch(() => { if (alive) setCheckingAuth(false); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user as AuthUser ?? null);
      setCheckingAuth(false);
    });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, [supabase]);
  useEffect(() => { if (user && supabase) void loadData(); }, [user, supabase, loadData]);

  async function signInWithGoogle() {
    if (!supabase) return;
    setGoogleBusy(true); setAuthError("");
    const { error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: window.location.origin, queryParams: { prompt: "select_account" } } });
    if (error) { setAuthError(error.message); setGoogleBusy(false); }
  }
  async function signOut() {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null); setAccounts([]); setTransactions([]); setBudgets([]); setInvestments([]); setAccountAdjustments([]);
  }
  function openTransaction(transaction?: Transaction) { setEditingTransaction(transaction ?? null); setModal("transaction"); }
  function openInvestment(investment?: Investment) { setEditingInvestment(investment ?? null); setModal("investment"); }
  function notify(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(current => current === message ? "" : current), 4500);
  }

  const { start: monthStart, end: monthEnd } = monthRange();
  const thisMonth = useMemo(() => transactions.filter(t => t.occurred_on >= monthStart.slice(0, 10) && t.occurred_on < monthEnd.slice(0, 10)), [transactions, monthStart, monthEnd]);
  const lastMonthTransactions = useMemo(() => {
    const now = new Date(), start = dateKey(new Date(now.getFullYear(), now.getMonth() - 1, 1)), end = dateKey(new Date(now.getFullYear(), now.getMonth(), 1));
    return transactions.filter(t => t.occurred_on >= start && t.occurred_on < end);
  }, [transactions]);
  const income = thisMonth.filter(t => t.kind === "income").reduce((s,t) => s + num(t.amount), 0);
  const expense = thisMonth.filter(t => t.kind === "expense").reduce((s,t) => s + num(t.amount), 0);
  const lastMonthIncome = lastMonthTransactions.filter(t=>t.kind==="income").reduce((s,t)=>s+num(t.amount),0);
  const lastMonthExpense = lastMonthTransactions.filter(t=>t.kind==="expense").reduce((s,t)=>s+num(t.amount),0);
  const cashBalances = accounts.map(account => {
    const tx = transactions.filter(t=>t.account_id===account.id);
    const adjustment = accountAdjustments.filter(a=>a.account_id===account.id).reduce((s,a)=>s+num(a.amount),0);
    return { ...account, balance: num(account.opening_balance) + tx.filter(t=>t.kind==="income").reduce((s,t)=>s+num(t.amount),0) - tx.filter(t=>t.kind==="expense").reduce((s,t)=>s+num(t.amount),0) + adjustment };
  });
  const totalCash = cashBalances.reduce((s,a)=>s+a.balance,0);
  const invested = investments.reduce((s,i)=>s+num(i.invested_amount),0);
  const investmentValue = investments.reduce((s,i)=>s+num(i.current_value),0);
  const netWorth = totalCash + investmentValue;
  const gainLoss = investmentValue - invested;
  const currentBudgets = budgets.filter(b=>b.month.slice(0,7)===todayISO().slice(0,7));
  const spentForBudget = (category: string) => thisMonth.filter(t=>t.kind==="expense"&&t.category===category).reduce((s,t)=>s+num(t.amount),0);
  const recentTransactions = [...transactions].sort((a,b)=>b.occurred_on.localeCompare(a.occurred_on)||b.created_at.localeCompare(a.created_at)).slice(0,6);
  const chartData = useMemo(() => {
    const now = new Date();
    if (period === "This month") {
      return Array.from({length:Math.min(now.getDate(),31)},(_,idx)=>{
        const d=idx+1, date=now.getFullYear()+"-"+String(now.getMonth()+1).padStart(2,"0")+"-"+String(d).padStart(2,"0");
        return {label:String(d),income:thisMonth.filter(t=>t.kind==="income"&&t.occurred_on===date).reduce((s,t)=>s+num(t.amount),0),expense:thisMonth.filter(t=>t.kind==="expense"&&t.occurred_on===date).reduce((s,t)=>s+num(t.amount),0)};
      });
    }
    return Array.from({length:6},(_,idx)=>{
      const date=new Date(now.getFullYear(),now.getMonth()-5+idx,1),key=dateKey(date).slice(0,7),rows=transactions.filter(t=>t.occurred_on.slice(0,7)===key);
      return {label:date.toLocaleDateString("en-IN",{month:"short"}),income:rows.filter(t=>t.kind==="income").reduce((s,t)=>s+num(t.amount),0),expense:rows.filter(t=>t.kind==="expense").reduce((s,t)=>s+num(t.amount),0)};
    });
  }, [period,transactions,thisMonth]);
  const expenseByCategory = expenseCategories.map(category=>({category,amount:thisMonth.filter(t=>t.kind==="expense"&&t.category===category).reduce((s,t)=>s+num(t.amount),0)})).filter(r=>r.amount>0).sort((a,b)=>b.amount-a.amount).slice(0,5);
  const filteredTransactions = transactions.filter(t=>{
    const matchesType=transactionFilter==="all"||t.kind===transactionFilter,term=searchTerm.toLowerCase();
    return matchesType&&(!term||[t.description,t.category,t.kind].some(s=>s.toLowerCase().includes(term)));
  });

  if (checkingAuth) return <div className="sign-in-wrap"><div className="sign-in-card"><div className="skeleton" style={{width:160,height:20}}/><div className="skeleton" style={{width:"80%",height:32,marginTop:30}}/><div className="skeleton" style={{width:"100%",height:44,marginTop:24}}/></div></div>;
  if (!user) return <SignIn configured={Boolean(supabase)} busy={googleBusy} error={authError} onSignIn={signInWithGoogle}/>;

  const displayName=user.user_metadata?.full_name||user.user_metadata?.name||user.email?.split("@")[0]||"Your account";
  const avatarURL=user.user_metadata?.avatar_url||user.user_metadata?.picture||"";
  const pageDesc:Record<Page,string>={Overview:"Here’s your financial picture at a glance.",Transactions:"Track every rupee coming in and going out.",Budgets:"Plan spending with simple monthly limits.","Bank accounts":"Your cash accounts, with opening balances and adjustments.",Investments:"Your holdings, separate from your bank balances."};
  return <div className="app-shell">
    <aside className="sidebar"><Brand/><div style={{width:"100%"}}><p className="nav-label">Workspace</p><NavItems page={page} setPage={setPage}/></div><div className="sidebar-bottom"><div className="profile-row"><Avatar name={displayName} url={avatarURL}/><div className="profile-copy" style={{minWidth:0,flex:1}}><div style={{fontWeight:700,fontSize:12,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{displayName}</div><div style={{color:"#9298a5",fontSize:10,marginTop:3,overflow:"hidden",textOverflow:"ellipsis"}}>{user.email}</div></div><button className="icon-btn" aria-label="Sign out" title="Sign out" onClick={signOut}><LogOut size={15}/></button></div></div></aside>
    <main className="main-area"><header className="topbar"><div className="topbar-title">{page}</div><div className="topbar-right"><span className="pill green desktop-only"><span className="dot" style={{background:"#16856b",margin:0}}/> Private workspace</span><button className="icon-btn desktop-only" aria-label="Refresh" onClick={()=>void loadData()}><Activity size={16}/></button><button className="icon-btn" aria-label="Sign out" onClick={signOut}><LogOut size={15}/></button><Avatar name={displayName} url={avatarURL}/></div></header>
      <div className="content"><div className="page-head"><div><div className="eyebrow">{page==="Overview"?monthLabel():"Your finances"}</div><h1 className="page-title">{page==="Overview"?<>Welcome back, {displayName.split(" ")[0]}</>:page}</h1><p className="page-subtitle">{pageDesc[page]}</p></div><button className="btn primary" onClick={()=>openTransaction()}><Plus size={16}/><span className="hide-mobile">Add transaction</span><span className="mobile-add">Add</span></button></div>
      {notice&&<div className="notice" style={{marginBottom:16,display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}><span>{notice}</span><button className="icon-btn" onClick={()=>setNotice("")} aria-label="Dismiss"><X size={14}/></button></div>}
      {!loading&&accounts.length===0&&transactions.length===0&&investments.length===0&&page==="Overview"&&<div className="notice" style={{marginBottom:16}}>Your workspace is ready. Add a bank or cash account with its previous balance, then start recording transactions. Your data is private to your signed-in account.</div>}
      {page==="Overview"&&<OverviewPage loading={loading} income={income} expense={expense} cash={totalCash} investments={investmentValue} netWorth={netWorth} lastIncome={lastMonthIncome} lastExpense={lastMonthExpense} chartData={chartData} period={period} setPeriod={setPeriod} recent={recentTransactions} accountMap={new Map(accounts.map(a=>[a.id,a.name]))} budgets={currentBudgets} spentForBudget={spentForBudget} expenseByCategory={expenseByCategory} gainLoss={gainLoss} onAddBudget={()=>setModal("budget")} onNavigate={setPage} onEditTransaction={openTransaction} onDeleteTransaction={async t=>{if(!window.confirm("Delete this transaction?")||!supabase)return;const {error}=await supabase.from("mm_transactions").delete().eq("id",t.id);if(error)notify(error.message);else{setTransactions(v=>v.filter(x=>x.id!==t.id));notify("Transaction deleted.");}}}/>}
      {page==="Transactions"&&<TransactionsPage rows={filteredTransactions} accountMap={new Map(accounts.map(a=>[a.id,a.name]))} searchTerm={searchTerm} setSearchTerm={setSearchTerm} filter={transactionFilter} setFilter={setTransactionFilter} onAdd={()=>openTransaction()} onEdit={openTransaction} onDelete={async t=>{if(!window.confirm("Delete this transaction?")||!supabase)return;const {error}=await supabase.from("mm_transactions").delete().eq("id",t.id);if(error)notify(error.message);else{setTransactions(v=>v.filter(x=>x.id!==t.id));notify("Transaction deleted.");}}}/>}
      {page==="Budgets"&&<BudgetsPage budgets={budgets} spend={spentForBudget} onAdd={()=>setModal("budget")} onDelete={async b=>{if(!window.confirm("Delete this budget?")||!supabase)return;const {error}=await supabase.from("mm_budgets").delete().eq("id",b.id);if(error)notify(error.message);else{setBudgets(v=>v.filter(x=>x.id!==b.id));notify("Budget deleted.");}}}/>}
      {page==="Bank accounts"&&<AccountsPage accounts={cashBalances} transactions={transactions} onAdd={()=>setModal("account")} onAdjust={id=>{setSelectedAccountId(id);setModal("adjustment");}} onDelete={async a=>{if(!window.confirm("Delete this account?")||!supabase)return;const {error}=await supabase.from("mm_accounts").delete().eq("id",a.id);if(error)notify(error.message);else{setAccounts(v=>v.filter(x=>x.id!==a.id));notify("Account deleted.");void loadData();}}}/>}
      {page==="Investments"&&<InvestmentsPage rows={investments} invested={invested} marketValue={investmentValue} gainLoss={gainLoss} onAdd={()=>openInvestment()} onEdit={openInvestment} onDelete={async i=>{if(!window.confirm("Delete this holding?")||!supabase)return;const {error}=await supabase.from("mm_investments").delete().eq("id",i.id);if(error)notify(error.message);else{setInvestments(v=>v.filter(x=>x.id!==i.id));notify("Holding deleted.");}}}/>}
      </div></main><div className="mobile-nav"><NavItems page={page} setPage={setPage} mobile/></div>
    {modal&&<EntryModal kind={modal} accounts={accounts} selectedAccountId={selectedAccountId} transaction={editingTransaction} investment={editingInvestment} onClose={()=>{setModal(null);setEditingTransaction(null);setEditingInvestment(null);setSelectedAccountId("");}} onSave={async payload=>{
      if(!supabase||!user)return;
      try {
        if(modal==="transaction"){const body=payload as Omit<Transaction,"id"|"created_at">;if(editingTransaction){const {data,error}=await supabase.from("mm_transactions").update(body).eq("id",editingTransaction.id).select().single();if(error)throw error;setTransactions(v=>v.map(t=>t.id===editingTransaction.id?data as Transaction:t));}else{const {data,error}=await supabase.from("mm_transactions").insert({...body,user_id:user.id}).select().single();if(error)throw error;setTransactions(v=>[data as Transaction,...v]);}notify(editingTransaction?"Transaction updated.":"Transaction added.");}
        else if(modal==="account"){const body=payload as Omit<Account,"id"|"created_at">;const {data,error}=await supabase.from("mm_accounts").insert({...body,user_id:user.id}).select().single();if(error)throw error;setAccounts(v=>[...v,data as Account]);notify("Account created.");}
        else if(modal==="budget"){const body=payload as Omit<Budget,"id">;const month=new Date();month.setDate(1);const {data,error}=await supabase.from("mm_budgets").upsert({...body,user_id:user.id,month:dateKey(month)},{onConflict:"user_id,category,month"}).select().single();if(error)throw error;setBudgets(v=>[...v.filter(b=>!(b.category===data.category&&b.month.slice(0,7)===data.month.slice(0,7))),data as Budget]);notify("Budget saved.");}
        else if(modal==="investment"){const body=payload as Omit<Investment,"id">;if(editingInvestment){const {data,error}=await supabase.from("mm_investments").update(body).eq("id",editingInvestment.id).select().single();if(error)throw error;setInvestments(v=>v.map(i=>i.id===editingInvestment.id?data as Investment:i));}else{const {data,error}=await supabase.from("mm_investments").insert({...body,user_id:user.id}).select().single();if(error)throw error;setInvestments(v=>[data as Investment,...v]);}notify(editingInvestment?"Holding updated.":"Investment holding added.");}
        else if(modal==="adjustment"){const p=payload as {account_id:string;amount:number;note:string;occurred_on:string};const {error}=await supabase.from("mm_account_adjustments").insert({...p,user_id:user.id});if(error)throw error;setAccountAdjustments(v=>[...v,{account_id:p.account_id,amount:p.amount}]);notify("Balance adjustment saved.");}
        setModal(null);setEditingTransaction(null);setEditingInvestment(null);setSelectedAccountId("");
      }catch(err){notify(err instanceof Error?err.message:"Save failed. Check the Supabase schema and RLS policies.");}
    }}/>}
  </div>;
}

function SignIn({configured,busy,error,onSignIn}:{configured:boolean;busy:boolean;error:string;onSignIn:()=>void}) {
 return <div className="sign-in-wrap"><div className="sign-in-card"><Brand/><div style={{marginTop:38}}><div className="eyebrow">PERSONAL FINANCE, SIMPLIFIED</div><h1 className="sign-in-title">Your money.<br/>One clear view.</h1><p className="sign-in-copy">Track spending, keep budgets on course, and see your cash and investments in one calm workspace.</p><button className="google-btn" disabled={!configured||busy} onClick={onSignIn}>{busy?<LoaderCircle size={18}/>:<GoogleIcon/>}{busy?"Connecting to Google…":"Continue with Google"}</button>{error&&<div className="auth-error">{error}</div>}{!configured&&<div className="setup-card"><strong>Supabase needs configuring.</strong><br/>Copy <code>.env.example</code> to <code>.env.local</code> and add your Supabase project URL and public anon/publishable key. Enable Google under Supabase Authentication → Providers.</div>}<div style={{marginTop:22,display:"flex",justifyContent:"center",alignItems:"center",gap:6,fontSize:10,color:"#9298a5"}}><ShieldCheck size={13}/> Your data is protected by database RLS.</div></div></div></div>;
}
function Brand(){return <div className="brand"><span className="brand-mark"><Wallet size={17}/></span><span className="brand-name">money<span style={{color:"#16856b"}}>wise</span></span></div>;}
function GoogleIcon(){return <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.76 7.18l7.73 6C44.42 37.99 46.98 31.8 46.98 24.55Z"/><path fill="#FBBC05" d="M10.53 28.59A14.5 14.5 0 0 1 9.75 24c0-1.59.27-3.13.76-4.59l-7.98-6.19A23.9 23.9 0 0 0 0 24c0 3.87.93 7.53 2.56 10.78l7.97-6.19Z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.91-5.8l-7.73-6c-2.14 1.45-4.89 2.3-8.18 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"/></svg>;}
function Avatar({name,url}:{name:string;url:string}){return <div className="avatar">{url?<img alt="" src={url}/>:name.slice(0,1).toUpperCase()}</div>;}
function NavItems({page,setPage,mobile=false}:{page:Page;setPage:(p:Page)=>void;mobile?:boolean}){return <nav className={mobile?"":"nav-list"}>{nav.map(({name,icon:Icon})=><button key={name} className={"nav-item"+(page===name?" active":"")} title={name} onClick={()=>setPage(name)}><Icon className="nav-icon"/><span className="nav-text">{mobile&&name==="Bank accounts"?"Accounts":mobile&&name==="Investments"?"Invest":name}</span></button>)}</nav>;}
function Metric({label,value,note,icon:Icon,tone="green",loading=false}:{label:string;value:number|string;note:string;icon:typeof TrendingUp;tone?:string;loading?:boolean}){
 const bg:Record<string,string>={green:"#e9f6f1",blue:"#eef2ff",orange:"#fff5e8",red:"#fff0f1"},fg:Record<string,string>={green:"#16856b",blue:"#4b71e8",orange:"#d9913b",red:"#d95b64"};
 return <div className="metric-card"><div className="metric-top"><span>{label}</span><span className="metric-icon" style={{background:bg[tone],color:fg[tone]}}><Icon size={16}/></span></div><div className="metric-value">{loading?<span className="skeleton" style={{display:"block",width:"75%",height:26}}/>:typeof value==="number"?formatINR(value):value}</div><div className="metric-note">{note}</div></div>;
}
function OverviewPage(p:{loading:boolean;income:number;expense:number;cash:number;investments:number;netWorth:number;lastIncome:number;lastExpense:number;chartData:{label:string;income:number;expense:number}[];period:"This month"|"Last 6 months";setPeriod:(v:"This month"|"Last 6 months")=>void;recent:Transaction[];accountMap:Map<string,string>;budgets:Budget[];spentForBudget:(c:string)=>number;expenseByCategory:{category:string;amount:number}[];gainLoss:number;onAddBudget:()=>void;onNavigate:(v:Page)=>void;onEditTransaction:(t:Transaction)=>void;onDeleteTransaction:(t:Transaction)=>void}){
 const flow=p.income-p.expense;const diff=(now:number,prev:number)=>prev===0?(now>0?"New this month":"Compared with last month"):`${now>=prev?"↑":"↓"} ${Math.abs(Math.round((now-prev)/prev*100))}% vs last month`;
 return <div><div className="grid metric-grid"><Metric label="Total balance" value={p.netWorth} note="Cash + current investments" icon={Wallet} loading={p.loading}/><Metric label="Income this month" value={p.income} note={diff(p.income,p.lastIncome)} icon={ArrowDownLeft} tone="blue" loading={p.loading}/><Metric label="Expenses this month" value={p.expense} note={diff(p.expense,p.lastExpense)} icon={ArrowUpRight} tone="orange" loading={p.loading}/><Metric label="Investments value" value={p.investments} note={`${p.gainLoss>=0?"+":"−"}${formatINR(Math.abs(p.gainLoss))} vs invested`} icon={ChartNoAxesCombined} tone={p.gainLoss>=0?"green":"red"} loading={p.loading}/></div>
 <div className="grid dashboard-grid"><section className="panel"><div className="panel-head"><div><h2 className="panel-title">Cash flow</h2><div className="panel-subtitle">Money in vs. money out</div></div><select aria-label="Chart period" className="search" style={{width:"auto",fontSize:11,padding:"8px 10px"}} value={p.period} onChange={e=>p.setPeriod(e.target.value as typeof p.period)}><option>This month</option><option>Last 6 months</option></select></div><div className="panel-body"><div className="legend-row" style={{marginBottom:16}}><span><i className="dot" style={{background:"#16856b"}}/>Income</span><span><i className="dot" style={{background:"#8fa5f5"}}/>Expenses</span><span style={{marginLeft:"auto",fontWeight:700,color:flow>=0?"#16856b":"#d95b64"}}>{flow>=0?"+":"−"}{formatINR(Math.abs(flow))} net</span></div><div className="chart-wrap">{p.chartData.length?<ResponsiveContainer width="100%" height="100%"><AreaChart data={p.chartData} margin={{top:8,right:4,left:-16,bottom:0}}><defs><linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#16856b" stopOpacity={.17}/><stop offset="100%" stopColor="#16856b" stopOpacity={0}/></linearGradient><linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8fa5f5" stopOpacity={.25}/><stop offset="100%" stopColor="#8fa5f5" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#f0f1f4" strokeDasharray="3 3" vertical={false}/><XAxis dataKey="label" tickLine={false} axisLine={false} tick={{fontSize:10,fill:"#999eaa"}} interval="preserveStartEnd"/><YAxis tickLine={false} axisLine={false} tick={{fontSize:10,fill:"#999eaa"}} tickFormatter={v=>v>=1000?`${Math.round(v/1000)}k`:String(v)} width={36}/><Tooltip formatter={v=>formatINR(Number(v))} contentStyle={{border:"1px solid #eceef2",borderRadius:10,fontSize:11,boxShadow:"none"}}/><Area type="monotone" dataKey="income" name="Income" stroke="#16856b" strokeWidth={2} fill="url(#incomeFill)"/><Area type="monotone" dataKey="expense" name="Expenses" stroke="#8fa5f5" strokeWidth={2} fill="url(#expenseFill)"/></AreaChart></ResponsiveContainer>:<div className="empty">Your cash flow will appear here once you add transactions.</div>}</div></div></section>
 <section className="panel"><div className="panel-head"><div><h2 className="panel-title">Monthly budgets</h2><div className="panel-subtitle">How spending is tracking</div></div><button className="btn subtle" onClick={()=>p.onNavigate("Budgets")}>View all <ChevronDown size={14}/></button></div><div className="panel-body">{p.budgets.length===0?<div className="empty"><Target size={24} style={{margin:"0 auto 10px",opacity:.45}}/><div>No budgets set up yet.</div><button className="btn" style={{marginTop:12}} onClick={p.onAddBudget}><Plus size={14}/> Create budget</button></div>:p.budgets.slice(0,5).map(b=>{const spent=p.spentForBudget(b.category),pct=Math.min(100,spent/num(b.monthly_limit)*100),over=spent>num(b.monthly_limit);return <div className="budget-row" key={b.id}><div className="budget-row-head"><span className="budget-name">{b.category}</span><span className="budget-numbers" style={{color:over?"#d95b64":undefined}}>{formatINR(spent)} / {formatINR(num(b.monthly_limit))}</span></div><div className="budget-track"><div className="progress"><span style={{width:`${pct}%`,background:over?"#d95b64":undefined}}/></div><span style={{fontSize:10,color:over?"#d95b64":"#8d93a0",width:31,textAlign:"right"}}>{Math.round(pct)}%</span></div></div>})}</div></section></div>
 <div className="grid dashboard-grid"><section className="panel"><div className="panel-head"><div><h2 className="panel-title">Recent transactions</h2><div className="panel-subtitle">Your latest activity</div></div><button className="btn subtle" onClick={()=>p.onNavigate("Transactions")}>See all <ChevronDown size={14}/></button></div><div className="panel-body">{p.recent.length===0?<div className="empty">No transactions recorded yet.</div>:p.recent.map(t=><TransactionRow key={t.id} row={t} accountName={t.account_id?p.accountMap.get(t.account_id):undefined} onEdit={()=>p.onEditTransaction(t)} onDelete={()=>p.onDeleteTransaction(t)}/>)}</div></section>
 <section className="panel"><div className="panel-head"><div><h2 className="panel-title">Spending breakdown</h2><div className="panel-subtitle">Top expense categories this month</div></div></div><div className="panel-body">{p.expenseByCategory.length===0?<div className="empty">Category breakdown appears after you log expenses.</div>:p.expenseByCategory.map((r,i)=>{const colors=["#16856b","#7590ed","#d9913b","#b59adb","#d95b64"],pct=p.expense?r.amount/p.expense*100:0;return <div className="budget-row" key={r.category}><div className="budget-row-head"><span className="budget-name">{r.category}</span><span className="budget-numbers">{formatINR(r.amount)} · {Math.round(pct)}%</span></div><div className="progress"><span style={{width:`${pct}%`,background:colors[i]}}/></div></div>})}</div></section></div></div>;
}
function TransactionRow({row,accountName,onEdit,onDelete}:{row:Transaction;accountName?:string;onEdit:()=>void;onDelete:()=>void}){
 const income = row.kind === "income";
 return <div className="transaction-row">
  <div style={{display:"flex",gap:11,alignItems:"center",minWidth:0}}>
   <div className="metric-icon" style={{flexShrink:0,background:income?"#e9f6f1":"#fff5e8",color:income?"#16856b":"#d9913b"}}>{income?<ArrowDownLeft size={16}/>:<ShoppingBag size={16}/>}</div>
   <div style={{minWidth:0}}><div className="transaction-name" style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{row.description||row.category}</div><div className="transaction-meta">{row.category} · {dateLabel(row.occurred_on)}{accountName?` · ${accountName}`:""}</div></div>
  </div>
  <span className={"pill "+(income?"green":"red")}>{income?"Income":"Expense"}</span>
  <div style={{display:"flex",alignItems:"center",gap:5}}><div className="transaction-amount" style={{color:income?"#16856b":"#252a33"}}>{income?"+":"−"}{formatINR(num(row.amount))}</div><button className="icon-btn" aria-label="Edit transaction" onClick={onEdit} style={{width:28,height:28,borderColor:"transparent"}}><Pencil size={12}/></button><button className="icon-btn" aria-label="Delete transaction" onClick={onDelete} style={{width:28,height:28,borderColor:"transparent"}}><Trash2 size={12}/></button></div>
 </div>;
}
function TransactionsPage(p:{rows:Transaction[];accountMap:Map<string,string>;searchTerm:string;setSearchTerm:(v:string)=>void;filter:"all"|"income"|"expense";setFilter:(v:"all"|"income"|"expense")=>void;onAdd:()=>void;onEdit:(t:Transaction)=>void;onDelete:(t:Transaction)=>void}){
 const income=p.rows.filter(t=>t.kind==="income").reduce((s,t)=>s+num(t.amount),0),expense=p.rows.filter(t=>t.kind==="expense").reduce((s,t)=>s+num(t.amount),0);
 return <div><div className="grid metric-grid" style={{marginBottom:16}}><Metric label="Visible income" value={income} note="Based on current filters" icon={ArrowDownLeft}/><Metric label="Visible expenses" value={expense} note={`${p.rows.length} transactions shown`} icon={ArrowUpRight} tone="orange"/><Metric label="Net cash flow" value={income-expense} note="Income less expenses" icon={Activity} tone={income>=expense?"green":"red"}/><Metric label="Transaction count" value={String(p.rows.length)} note="Latest recorded activity" icon={ArrowLeftRight} tone="blue"/></div><section className="panel"><div className="panel-head"><div><h2 className="panel-title">All transactions</h2><div className="panel-subtitle">Search, filter, edit, or delete records</div></div><button className="btn primary" onClick={p.onAdd}><Plus size={15}/> Add</button></div><div className="panel-body"><div className="filters" style={{marginBottom:14}}><div style={{position:"relative",flex:"1 1 180px"}}><Search size={15} style={{position:"absolute",left:11,top:11,color:"#9ba1ad"}}/><input className="search" style={{paddingLeft:33,width:"100%"}} placeholder="Search transactions" value={p.searchTerm} onChange={e=>p.setSearchTerm(e.target.value)}/></div><select className="search" style={{width:"auto"}} value={p.filter} onChange={e=>p.setFilter(e.target.value as typeof p.filter)}><option value="all">All types</option><option value="income">Income</option><option value="expense">Expenses</option></select></div>{p.rows.length===0?<div className="empty">No matching transactions. Add a transaction to get started.</div>:p.rows.map(t=><TransactionRow key={t.id} row={t} accountName={t.account_id?p.accountMap.get(t.account_id):undefined} onEdit={()=>p.onEdit(t)} onDelete={()=>p.onDelete(t)}/>)}</div></section></div>;
}
function BudgetsPage({budgets,spend,onAdd,onDelete}:{budgets:Budget[];spend:(category:string)=>number;onAdd:()=>void;onDelete:(b:Budget)=>void}){
 const month=todayISO().slice(0,7),current=budgets.filter(b=>b.month.slice(0,7)===month),total=current.reduce((s,b)=>s+num(b.monthly_limit),0),spent=current.reduce((s,b)=>s+spend(b.category),0);
 return <div><div className="grid metric-grid" style={{marginBottom:16}}><Metric label="Budgeted" value={total} note={`${current.length} budgets this month`} icon={Target}/><Metric label="Spent so far" value={spent} note="Recorded expenses in budget categories" icon={ShoppingBag} tone="orange"/><Metric label="Remaining" value={total-spent} note={spent>total?"Over budget":"Available this month"} icon={CircleDollarSign} tone={spent>total?"red":"green"}/><Metric label="Used" value={`${total?Math.round(spent/total*100):0}%`} note="Across current budgets" icon={Activity} tone="blue"/></div><section className="panel"><div className="panel-head"><div><h2 className="panel-title">Monthly budget limits</h2><div className="panel-subtitle">{monthLabel()} · Expenses matched by category</div></div><button className="btn primary" onClick={onAdd}><Plus size={15}/> Add budget</button></div><div className="panel-body">{current.length===0?<div className="empty">No budgets yet. Set monthly limits for food, transport, shopping, or another category.</div>:current.map(b=>{const value=spend(b.category),limit=num(b.monthly_limit),pct=limit?value/limit*100:0,over=value>limit;return <div key={b.id} style={{padding:"17px 0",borderBottom:"1px solid #f0f1f4"}}><div style={{display:"flex",alignItems:"center",gap:12}}><div style={{flex:1}}><div className="budget-name">{b.category}</div><div className="transaction-meta" style={{marginTop:6}}>{formatINR(value)} spent of {formatINR(limit)}</div></div><span className={"pill "+(over?"red":pct>75?"orange":"green")}>{Math.round(pct)}% used</span><button className="icon-btn" onClick={()=>onDelete(b)} aria-label="Delete budget"><Trash2 size={14}/></button></div><div className="progress" style={{marginTop:12,height:8}}><span style={{width:`${Math.min(100,pct)}%`,background:over?"#d95b64":pct>75?"#d9913b":undefined}}/></div>{over&&<div className="transaction-meta" style={{color:"#d95b64",marginTop:8}}>Over by {formatINR(value-limit)}</div>}</div>})}</div></section></div>;
}
function AccountsPage(p:{accounts:(Account&{balance:number})[];transactions:Transaction[];onAdd:()=>void;onAdjust:(id:string)=>void;onDelete:(a:Account)=>void}){
 const [selected,setSelected]=useState("all"),listed=selected==="all"?p.accounts:p.accounts.filter(a=>a.account_type===selected);
 return <div><div className="grid metric-grid" style={{marginBottom:16}}><Metric label="Available cash" value={p.accounts.reduce((s,a)=>s+a.balance,0)} note="Across all accounts" icon={Wallet}/><Metric label="Bank accounts" value={String(p.accounts.filter(a=>a.account_type==="bank").length)} note="Tracked manually" icon={Landmark} tone="blue"/><Metric label="Cash & wallets" value={String(p.accounts.filter(a=>a.account_type!=="bank").length)} note="Cash and digital wallets" icon={CreditCard} tone="orange"/><Metric label="Opening balances" value={p.accounts.reduce((s,a)=>s+num(a.opening_balance),0)} note="Previous balance at setup" icon={CircleDollarSign} tone="green"/></div><div className="page-head" style={{alignItems:"center",marginTop:8}}><div><h2 className="panel-title">Your accounts</h2><p className="page-subtitle" style={{fontSize:12,marginTop:5}}>Opening balance + income − expenses + adjustments.</p></div><button className="btn primary" onClick={p.onAdd}><Plus size={15}/> Add account</button></div><div className="filters" style={{marginBottom:16}}>{[["all","All accounts"],["bank","Banks"],["cash","Cash"],["wallet","Wallets"]].map(([value,label])=><button className={"btn"+(selected===value?" primary":"")} key={value} onClick={()=>setSelected(value)}>{label}</button>)}</div>{listed.length===0?<div className="panel"><div className="empty">No accounts here yet. Add the current or previous balance as an opening balance.</div></div>:<div className="grid account-grid">{listed.map(a=>{const linked=p.transactions.filter(t=>t.account_id===a.id);return <div className="account-card" key={a.id}><div className="account-card-top"><div style={{display:"flex",gap:11,alignItems:"center"}}><div className="metric-icon" style={{background:"#e9f6f1",color:"#16856b"}}>{a.account_type==="bank"?<Landmark size={17}/>:a.account_type==="wallet"?<CreditCard size={17}/>:<Banknote size={17}/>}</div><div><div className="transaction-name">{a.name}</div><div className="transaction-meta">{a.institution||({bank:"Bank account",cash:"Cash",wallet:"Digital wallet"} as Record<string,string>)[a.account_type]||a.account_type}</div></div></div><button className="icon-btn" onClick={()=>p.onDelete(a)} aria-label="Delete account"><MoreHorizontal size={16}/></button></div><div className="account-balance">{formatINR(a.balance)}</div><div className="transaction-meta">Opening balance: {formatINR(num(a.opening_balance))}</div><button className="btn" style={{width:"100%",marginTop:18,fontSize:11}} onClick={()=>p.onAdjust(a.id)}><Pencil size={13}/> Adjust balance</button><div className="transaction-meta" style={{marginTop:12}}>{linked.length} recorded transactions</div></div>})}</div>}</div>;
}
function InvestmentsPage(p:{rows:Investment[];invested:number;marketValue:number;gainLoss:number;onAdd:()=>void;onEdit:(i:Investment)=>void;onDelete:(i:Investment)=>void}){
 const [filter,setFilter]=useState("all"),filtered=filter==="all"?p.rows:p.rows.filter(i=>i.asset_type===filter);
 const groups=(["stock","mutual_fund","etf","gold","other"] as const).map(type=>({type,amount:p.rows.filter(i=>i.asset_type===type).reduce((s,i)=>s+num(i.current_value),0),count:p.rows.filter(i=>i.asset_type===type).length})).filter(g=>g.count>0);
 return <div><div className="grid metric-grid" style={{marginBottom:16}}><Metric label="Portfolio value" value={p.marketValue} note="Current value entered by you" icon={ChartNoAxesCombined}/><Metric label="Total invested" value={p.invested} note="Acquisition cost" icon={CircleDollarSign} tone="blue"/><Metric label="Gain / loss" value={`${p.gainLoss>=0?"+":"−"}${formatINR(Math.abs(p.gainLoss))}`} note={p.invested?`${(p.gainLoss/p.invested*100).toFixed(1)}% return on cost`:"Add holdings to calculate return"} icon={p.gainLoss>=0?TrendingUp:TrendingDown} tone={p.gainLoss>=0?"green":"red"}/><Metric label="Holdings" value={String(p.rows.length)} note="Stocks, funds, ETFs and gold" icon={Layers3} tone="orange"/></div><section className="panel" style={{marginBottom:16}}><div className="panel-head"><div><h2 className="panel-title">Investment allocation</h2><div className="panel-subtitle">By current value · separate from bank cash</div></div><button className="btn primary" onClick={p.onAdd}><Plus size={15}/> Add investment</button></div><div className="panel-body">{groups.length===0?<div className="empty">Add stocks, mutual funds, ETFs, or gold to start tracking your portfolio.</div>:<><div className="progress" style={{height:10,display:"flex",marginBottom:18}}>{groups.map((g,index)=>{const colors=["#16856b","#4b71e8","#d9913b","#b59adb","#d95b64"];return <span key={g.type} style={{width:`${p.marketValue?g.amount/p.marketValue*100:0}%`,background:colors[index]}}/>})}</div><div className="grid" style={{gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr)",gap:13}}>{groups.map((g,index)=>{const colors=["#16856b","#4b71e8","#d9913b","#b59adb","#d95b64"];return <div key={g.type} style={{padding:"12px 13px",background:"#fafbfc",borderRadius:10}}><div style={{display:"flex",alignItems:"center",gap:7,fontSize:11,color:"#747b89"}}><span className="dot" style={{background:colors[index],margin:0}}/>{assetLabels[g.type]}</div><div style={{fontSize:17,fontWeight:750,marginTop:9}}>{formatINR(g.amount)}</div><div className="transaction-meta">{p.marketValue?Math.round(g.amount/p.marketValue*100):0}% of portfolio</div></div>})}</div></>}</div></section><section className="panel"><div className="panel-head"><div><h2 className="panel-title">Your holdings</h2><div className="panel-subtitle">Manually maintained values; no broker sync</div></div></div><div className="panel-body"><div className="filters" style={{marginBottom:16}}><select className="search" value={filter} onChange={e=>setFilter(e.target.value)} style={{width:"auto"}}><option value="all">All asset types</option><option value="stock">Stocks</option><option value="mutual_fund">Mutual funds</option><option value="etf">ETFs</option><option value="gold">Gold</option><option value="other">Other</option></select></div>{filtered.length===0?<div className="empty">No investments match this filter.</div>:<div className="table-wrap"><table className="data-table"><thead><tr><th>Asset</th><th>Platform</th><th className="right">Invested</th><th className="right">Current value</th><th className="right">Gain / loss</th><th></th></tr></thead><tbody>{filtered.map(i=>{const delta=num(i.current_value)-num(i.invested_amount),Icon=assetIcons[i.asset_type];return <tr key={i.id}><td><div style={{display:"flex",alignItems:"center",gap:10}}><div className="metric-icon" style={{background:"#eef2ff",color:"#4b71e8",width:32,height:32}}><Icon size={15}/></div><div><div style={{fontWeight:700}}>{i.name}</div><div className="transaction-meta">{assetLabels[i.asset_type]}{i.symbol?` · ${i.symbol}`:""}</div></div></div></td><td>{i.platform||"—"}</td><td className="right">{formatINR(num(i.invested_amount))}</td><td className="right" style={{fontWeight:700}}>{formatINR(num(i.current_value))}</td><td className="right" style={{color:delta>=0?"#16856b":"#d95b64"}}>{delta>=0?"+":"−"}{formatINR(Math.abs(delta))}</td><td><div style={{display:"flex",gap:5}}><button className="icon-btn" aria-label="Edit holding" onClick={()=>p.onEdit(i)}><Pencil size={13}/></button><button className="icon-btn" aria-label="Delete holding" onClick={()=>p.onDelete(i)}><Trash2 size={13}/></button></div></td></tr>})}</tbody></table></div>}</div></section></div>;
}
