"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Activity, ArrowDownLeft, ArrowDownUp, ArrowLeftRight, ArrowUpRight, Banknote, ChartNoAxesCombined, ChevronDown, CircleDollarSign, CreditCard, Download, Gem, HandCoins, History, Landmark, Layers3, LayoutDashboard, LoaderCircle, LogOut, MoreHorizontal, Pencil, PieChart, Plus, RotateCcw, Search, ShoppingBag, Target, Trash2, TrendingDown, TrendingUp, Upload, Wallet, X } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { dateKey, formatINR, monthRange, todayISO } from "@/lib/format";
import { DEFAULT_CATEGORIES, type CategoryRecord, type TransactionKind } from "@/lib/categories";
import TransactionImportModal, { type ImportTransaction } from "@/app/components/transaction-import-modal";
import RefundModal, { type RefundRecord } from "@/app/components/refund-modal";
import CategoriesModal from "@/app/components/categories-modal";
import DebtModal, { type DebtRecord, type DebtRepaymentRecord, type DebtInput, type RepaymentInput } from "@/app/components/debt-modal";
import PeoplePage, { type DebtPosition } from "@/app/components/people-page";
import TransferModal, { type AccountTransfer, type AccountTransferInput } from "@/app/components/transfer-modal";
import EntryModal from "@/app/entry-modal";
import InvestmentActivityModal from "@/app/components/investment-activity-modal";
import LandingPage from "@/app/components/landing-page";
import Brand from "@/app/components/brand";
import { calculateInvestmentPosition, type InvestmentActivity, type InvestmentPosition } from "@/lib/investment-portfolio";

type Page = "Overview" | "Transactions" | "Budgets" | "Bank accounts" | "Investments" | "People";
type Account = { id: string; name: string; account_type: string; institution: string | null; opening_balance: number; color: string; created_at: string };
type Transaction = { id: string; account_id: string | null; kind: "income" | "expense"; amount: number; category: string; description: string; occurred_on: string; created_at: string };
type Budget = { id: string; category: string; monthly_limit: number; month: string };
type Investment = { id: string; asset_type: "stock" | "mutual_fund" | "etf" | "gold" | "other" | "fixed_deposit"; name: string; symbol: string | null; platform: string | null; exchange?: string | null; units: number; invested_amount: number; current_value: number; current_price?: number | null; price_updated_at?: string | null; price_source?: string | null; annual_interest_rate?: number | null; maturity_date?: string | null; compounding_frequency?: "daily" | "monthly" | "quarterly" | "half_yearly" | "yearly" | null; purchase_date: string; notes: string | null };
type AuthUser = { id: string; email?: string; user_metadata?: Record<string, string> };

const nav: { name: Page; icon: typeof LayoutDashboard }[] = [
  { name: "Overview", icon: LayoutDashboard }, { name: "Transactions", icon: ArrowLeftRight },
  { name: "Budgets", icon: Target }, { name: "Bank accounts", icon: Landmark }, { name: "Investments", icon: ChartNoAxesCombined }, { name: "People", icon: HandCoins },
];
const assetLabels: Record<Investment["asset_type"], string> = { stock: "Stocks", mutual_fund: "Mutual funds", etf: "ETFs", gold: "Gold", fixed_deposit: "Fixed deposits", other: "Other" };
const assetIcons: Record<Investment["asset_type"], typeof TrendingUp> = { stock: TrendingUp, mutual_fund: Layers3, etf: PieChart, gold: Gem, fixed_deposit: Landmark, other: TrendingUp };
const num = (value: unknown) => Number(value ?? 0) || 0;
function dateLabel(date: string) { return new Date(date + "T12:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" }); }
function monthLabel(date = new Date()) { return date.toLocaleDateString("en-IN", { month: "long", year: "numeric" }); }
function monthKeyLabel(key: string) { const [year, month] = key.split("-").map(Number); return new Date(year, month - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" }); }

export default function Home() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [page, setPage] = useState<Page>("Overview");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [investmentTransactions, setInvestmentTransactions] = useState<InvestmentActivity[]>([]);
  const [refunds, setRefunds] = useState<RefundRecord[]>([]);
  const [categories, setCategories] = useState<CategoryRecord[]>([]);
  const [debts, setDebts] = useState<DebtRecord[]>([]);
  const [debtRepayments, setDebtRepayments] = useState<DebtRepaymentRecord[]>([]);
  const [transfers, setTransfers] = useState<AccountTransfer[]>([]);
  const [refundTarget, setRefundTarget] = useState<Transaction | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferSourceAccountId, setTransferSourceAccountId] = useState("");
  const [showCategories, setShowCategories] = useState(false);
  const [debtMode, setDebtMode] = useState<"new" | "repayment" | null>(null);
  const [repaymentTarget, setRepaymentTarget] = useState<DebtPosition | null>(null);
  const [investmentActionId, setInvestmentActionId] = useState<string | null>(null);
  const [refreshingPrices, setRefreshingPrices] = useState(false);
  const [autoPriceRefreshStarted, setAutoPriceRefreshStarted] = useState(false);
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
  const [transactionMonth, setTransactionMonth] = useState(todayISO().slice(0, 7));
  const [period, setPeriod] = useState<"This month" | "Last 6 months">("This month");
  const refundTotals = useMemo(() => refunds.reduce((map, refund) => { map.set(refund.transaction_id, (map.get(refund.transaction_id) ?? 0) + num(refund.amount)); return map; }, new Map<string, number>()), [refunds]);
  const refundsByTransaction = useMemo(() => refunds.reduce((map, refund) => { const list=map.get(refund.transaction_id) ?? []; list.push(refund); map.set(refund.transaction_id,list); return map; }, new Map<string, RefundRecord[]>()), [refunds]);

  const loadData = useCallback(async () => {
    if (!supabase || !user) return;
    setLoading(true);
    const defaultRows = (Object.entries(DEFAULT_CATEGORIES) as [TransactionKind,string[]][]).flatMap(([kind,names])=>names.map(name=>({user_id:user.id,kind,name,is_default:true})));
    const { error: seedError } = await supabase.from("mm_categories").upsert(defaultRows,{onConflict:"user_id,kind,name",ignoreDuplicates:true});
    if (seedError) console.warn("Could not seed default categories:", seedError.message);
    const [a, t, b, i, adj, ia, rf, cat, d, dr, tr] = await Promise.all([
      supabase.from("mm_accounts").select("id,name,account_type,institution,opening_balance,color,created_at").order("created_at", { ascending: true }),
      supabase.from("mm_transactions").select("id,account_id,kind,amount,category,description,occurred_on,created_at").order("occurred_on", { ascending: false }).limit(5000),
      supabase.from("mm_budgets").select("id,category,monthly_limit,month").order("category"),
      supabase.from("mm_investments").select("id,asset_type,name,symbol,platform,exchange,units,invested_amount,current_value,current_price,price_updated_at,price_source,annual_interest_rate,maturity_date,compounding_frequency,purchase_date,notes").order("created_at", { ascending: false }),
      supabase.from("mm_account_adjustments").select("account_id,amount"),
      supabase.from("mm_investment_transactions").select("id,investment_id,action,units,unit_price,fees,occurred_on,created_at,notes").order("occurred_on", { ascending: true }),
      supabase.from("mm_transaction_refunds").select("id,transaction_id,amount,received_on,note,created_at").order("received_on", { ascending: true }),
      supabase.from("mm_categories").select("id,user_id,kind,name,is_default,created_at").order("kind").order("name"),
      supabase.from("mm_debts").select("id,user_id,direction,person_name,amount,occurred_on,account_id,transaction_id,note,created_at").order("occurred_on", { ascending: false }),
      supabase.from("mm_debt_repayments").select("id,user_id,debt_id,amount,occurred_on,transaction_id,note,created_at").order("occurred_on", { ascending: true }),
      supabase.from("mm_account_transfers").select("id,user_id,from_account_id,to_account_id,amount,occurred_on,note,created_at").order("occurred_on", { ascending: false }),
    ]);
    const errors = [a.error, t.error, b.error, i.error, adj.error, ia.error, rf.error, cat.error, d.error, dr.error, tr.error].filter(Boolean);
    if (errors.length) setNotice(errors[0]?.message ?? "Could not load your data.");
    else {
      setAccounts((a.data ?? []) as Account[]);
      setTransactions((t.data ?? []) as Transaction[]);
      setBudgets((b.data ?? []) as Budget[]);
      setInvestments((i.data ?? []) as Investment[]);
      setInvestmentTransactions((ia.data ?? []) as InvestmentActivity[]);
      setAccountAdjustments((adj.data ?? []) as { account_id: string; amount: number }[]);
      setRefunds((rf.data ?? []) as RefundRecord[]);
      setCategories((cat.data ?? []) as CategoryRecord[]);
      setDebts((d.data ?? []) as DebtRecord[]);
      setDebtRepayments((dr.data ?? []) as DebtRepaymentRecord[]);
      setTransfers((tr.data ?? []) as AccountTransfer[]);
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
    setUser(null); setAccounts([]); setTransactions([]); setBudgets([]); setInvestments([]); setInvestmentTransactions([]); setAccountAdjustments([]); setRefunds([]); setCategories([]); setDebts([]); setDebtRepayments([]); setTransfers([]); setInvestmentActionId(null); setAutoPriceRefreshStarted(false);
  }
  function openTransaction(transaction?: Transaction) {
    if(transaction&&(debts.some(d=>d.transaction_id===transaction.id)||debtRepayments.some(r=>r.transaction_id===transaction.id))){
      notify("This transaction is part of a People debt record. Edit the debt or repayment from People so both histories remain consistent.");
      return;
    }
    setEditingTransaction(transaction ?? null);
    setModal("transaction");
  }
  function openInvestment(investment?: Investment) { setEditingInvestment(investment ?? null); setModal("investment"); }
  function openTransfer(accountId = "") { setTransferSourceAccountId(accountId); setShowTransfer(true); }
  function notify(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(current => current === message ? "" : current), 4500);
  }

  async function saveRefund(payload:{amount:number;received_on:string;note:string|null}) {
    if(!supabase||!user||!refundTarget)throw new Error("Select an expense transaction first.");
    if(refundTarget.kind!=="expense")throw new Error("Only expense transactions can have a refund.");
    const already=refundTotals.get(refundTarget.id)??0;
    if(payload.amount+already>num(refundTarget.amount)+0.001)throw new Error("Total refunds cannot exceed the original expense.");
    const {data,error}=await supabase.from("mm_transaction_refunds").insert({...payload,user_id:user.id,transaction_id:refundTarget.id}).select().single();
    if(error)throw error;
    setRefunds(old=>[...old,data as RefundRecord]);
    setRefundTarget(null);
    notify("Refund recorded. Net spending and account balance updated.");
  }

  async function saveTransfer(payload: AccountTransferInput) {
    if (!supabase || !user) throw new Error("Sign in before making a transfer.");
    if (payload.from_account_id === payload.to_account_id) throw new Error("Source and destination accounts must be different.");
    if (!accounts.some(a => a.id === payload.from_account_id) || !accounts.some(a => a.id === payload.to_account_id)) throw new Error("Select two of your own accounts.");
    if (!Number.isFinite(payload.amount) || payload.amount <= 0) throw new Error("Transfer amount must be greater than zero.");
    const { data, error } = await supabase.from("mm_account_transfers").insert({ ...payload, user_id: user.id }).select("id,user_id,from_account_id,to_account_id,amount,occurred_on,note,created_at").single();
    if (error) throw error;
    setTransfers(old => [data as AccountTransfer, ...old]);
    setShowTransfer(false);
    setTransferSourceAccountId("");
    notify("Transfer saved. Account balances updated; income and expense totals are unchanged.");
  }

  async function importTransactions(rows:ImportTransaction[]) {
    if(!supabase||!user)throw new Error("Sign in before importing transactions.");
    if(!rows.length)throw new Error("No valid rows to import.");
    if(rows.length>1000)throw new Error("Import up to 1,000 transactions at a time.");
    const known=new Set(categories.map(c=>c.kind+"::"+c.name.trim().toLocaleLowerCase()));
    const newCategories=[...new Map(rows.filter(row=>!known.has(row.kind+"::"+row.category.trim().toLocaleLowerCase())).map(row=>[row.kind+"::"+row.category.trim().toLocaleLowerCase(),{user_id:user.id,kind:row.kind,name:row.category.trim(),is_default:false}])).values()];
    if(newCategories.length){
      const {error:catError}=await supabase.from("mm_categories").upsert(newCategories,{onConflict:"user_id,kind,name",ignoreDuplicates:true});
      if(catError)throw catError;
    }
    const {data,error}=await supabase.from("mm_transactions").insert(rows.map(row=>({...row,user_id:user.id}))).select();
    if(error)throw error;
    setTransactions(old=>[...(data as Transaction[]),...old]);
    const {data:catRows,error:catLoadError}=await supabase.from("mm_categories").select("id,user_id,kind,name,is_default,created_at").order("kind").order("name");
    if(!catLoadError)setCategories((catRows??[]) as CategoryRecord[]);
    notify(`Imported ${data?.length??rows.length} transactions.`);
  }

  async function addCategory(payload:{kind:TransactionKind;name:string}) {
    if(!supabase||!user)throw new Error("Sign in before adding a category.");
    if(categories.some(c=>c.kind===payload.kind&&c.name.trim().toLocaleLowerCase()===payload.name.trim().toLocaleLowerCase()))throw new Error("That category already exists for this type.");
    const {data,error}=await supabase.from("mm_categories").insert({...payload,user_id:user.id,is_default:false}).select().single();
    if(error)throw error;
    setCategories(old=>[...old,data as CategoryRecord].sort((a,b)=>a.kind.localeCompare(b.kind)||a.name.localeCompare(b.name)));
    notify("Category added.");
  }

  async function deleteCategory(category:CategoryRecord) {
    if(!supabase||category.is_default)return;
    if(!window.confirm(`Delete the custom category "${category.name}"? Existing transactions keep their recorded category name.`))return;
    const {error}=await supabase.from("mm_categories").delete().eq("id",category.id);
    if(error){notify(error.message);return;}
    setCategories(old=>old.filter(c=>c.id!==category.id));
    notify("Category deleted.");
  }

  async function saveDebt(payload:DebtInput) {
    if(!supabase||!user)throw new Error("Sign in before saving this debt.");
    const kind=payload.direction==="lent"?"expense":"income";
    const category=payload.direction==="lent"?"Loans given":"Borrowed money";
    const description=payload.direction==="lent"?`Lent to ${payload.person_name}`:`Borrowed from ${payload.person_name}`;
    const {data:tx,error:txError}=await supabase.from("mm_transactions").insert({
      user_id:user.id,kind,amount:payload.amount,category,description,occurred_on:payload.occurred_on,account_id:payload.account_id,
    }).select().single();
    if(txError)throw txError;
    const {data:debt,error}=await supabase.from("mm_debts").insert({
      ...payload,user_id:user.id,transaction_id:tx.id,
    }).select().single();
    if(error){await supabase.from("mm_transactions").delete().eq("id",tx.id);throw error;}
    setTransactions(old=>[tx as Transaction,...old]);
    setDebts(old=>[debt as DebtRecord,...old]);
    setDebtMode(null);
    notify(payload.direction==="lent"?"Loan recorded; your cash balance was reduced.":"Borrowing recorded; your cash balance was increased.");
  }

  async function saveDebtRepayment(payload:RepaymentInput) {
    if(!supabase||!user||!repaymentTarget)throw new Error("Select a debt record first.");
    if(payload.amount>repaymentTarget.outstanding+0.001)throw new Error("Repayment exceeds the outstanding amount.");
    const incoming=repaymentTarget.direction==="lent";
    const {data:tx,error:txError}=await supabase.from("mm_transactions").insert({
      user_id:user.id,kind:incoming?"income":"expense",amount:payload.amount,
      category:incoming?"Loan repayment received":"Loan repayment paid",
      description:incoming?`Repayment from ${repaymentTarget.person_name}`:`Repayment to ${repaymentTarget.person_name}`,
      occurred_on:payload.occurred_on,account_id:repaymentTarget.account_id,
    }).select().single();
    if(txError)throw txError;
    const {data:repayment,error}=await supabase.from("mm_debt_repayments").insert({
      ...payload,user_id:user.id,debt_id:repaymentTarget.id,transaction_id:tx.id,
    }).select().single();
    if(error){await supabase.from("mm_transactions").delete().eq("id",tx.id);throw error;}
    setTransactions(old=>[tx as Transaction,...old]);
    setDebtRepayments(old=>[...old,repayment as DebtRepaymentRecord]);
    setRepaymentTarget(null);setDebtMode(null);
    notify("Repayment recorded; outstanding balance updated.");
  }

  function exportTransactionsCsv() {
    const quote=(value:unknown)=>"\""+String(value??"").replace(/"/g,'""')+"\"";
    const head=["date","type","amount","category","description","account","refunded_amount","net_expense"];
    const data=[head,...transactions.map(t=>[t.occurred_on,t.kind,t.amount,t.category,t.description,t.account_id?accounts.find(a=>a.id===t.account_id)?.name??"": "",refundTotals.get(t.id)??0,t.kind==="expense"?Math.max(0,num(t.amount)-(refundTotals.get(t.id)??0)):""])];
    const csv="\uFEFF"+data.map(row=>row.map(quote).join(",")).join("\r\n");
    const blob=new Blob([csv],{type:"text/csv;charset=utf-8;"});
    const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="rupeetrail-transactions.csv";a.click();URL.revokeObjectURL(url);
  }

  const refreshMarketPrices = useCallback(async () => {
    if (!supabase) return;
    const candidates = investments.filter(i => i.symbol && ["stock", "etf", "mutual_fund"].includes(i.asset_type));
    if (!candidates.length) {
      notify("Add a Yahoo ticker for a stock/ETF or an AMFI scheme code/ISIN for an Indian mutual fund to enable automatic prices.");
      return;
    }
    setRefreshingPrices(true);
    let updated = 0;
    const failures: string[] = [];
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) throw new Error("Your login session expired. Sign in again.");
      for (const investment of candidates) {
        try {
          const params = new URLSearchParams({ symbol: investment.symbol || "", type: investment.asset_type, exchange: investment.exchange || "" });
          const response = await fetch(`/api/market/quote?${params.toString()}`, { headers: { Authorization: `Bearer ${token}` } });
          const quote = await response.json();
          if (!response.ok) throw new Error(quote.error || "Quote was unavailable.");
          const position = calculateInvestmentPosition(investment, investmentTransactions);
          const price = Number(quote.currentPrice);
          if (!(price > 0)) throw new Error("Provider returned an invalid price.");
          const currentValue = position.units * price;
          const updatedAt = new Date().toISOString();
          const patch = { current_price: price, current_value: currentValue, units: position.units, invested_amount: position.costBasis, price_updated_at: updatedAt, price_source: String(quote.source || "Market data provider") };
          const { error } = await supabase.from("mm_investments").update(patch).eq("id", investment.id);
          if (error) throw error;
          setInvestments(old => old.map(row => row.id === investment.id ? { ...row, ...patch } : row));
          updated++;
        } catch (error) {
          failures.push(`${investment.name}: ${error instanceof Error ? error.message : "quote failed"}`);
        }
      }
      if (updated && !failures.length) notify(`Updated prices for ${updated} holding${updated === 1 ? "" : "s"}.`);
      else if (updated) notify(`Updated ${updated} holding${updated === 1 ? "" : "s"}; ${failures.length} could not refresh. Existing prices were kept.`);
      else notify(failures.slice(0, 2).join(" · ") || "No prices could be refreshed. Enter prices manually if needed.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "Price refresh failed.");
    } finally {
      setRefreshingPrices(false);
    }
  }, [supabase, investments, investmentTransactions]);

  useEffect(() => {
    if (page === "Investments" && !loading && investments.length > 0 && !autoPriceRefreshStarted) {
      setAutoPriceRefreshStarted(true);
      void refreshMarketPrices();
    }
  }, [page, loading, investments.length, autoPriceRefreshStarted, refreshMarketPrices]);

  async function saveInvestmentActivity(payload: { action: "buy" | "sell"; units: number; unit_price: number; fees: number; occurred_on: string; notes: string | null }) {
    if (!supabase || !user || !investmentAction) throw new Error("Sign in to record an investment transaction.");
    if (payload.action === "sell" && payload.units > investmentAction.units + 1e-8) throw new Error("You cannot sell more units than you currently hold.");
    const { data, error } = await supabase.from("mm_investment_transactions").insert({
      ...payload, user_id: user.id, investment_id: investmentAction.id,
    }).select().single();
    if (error) throw error;
    const nextActivities = [...investmentTransactions, data as InvestmentActivity];
    const nextPosition = calculateInvestmentPosition(investmentAction, nextActivities);
    const { error: cacheError } = await supabase.from("mm_investments").update({
      units: nextPosition.units,
      invested_amount: nextPosition.costBasis,
      current_value: nextPosition.marketValue,
    }).eq("id", investmentAction.id);
    if (cacheError) throw cacheError;
    setInvestmentTransactions(nextActivities);
    setInvestments(old => old.map(row => row.id === investmentAction.id ? {
      ...row, units: nextPosition.units, invested_amount: nextPosition.costBasis, current_value: nextPosition.marketValue,
    } : row));
    setInvestmentActionId(null);
    notify(payload.action === "buy" ? "Purchase recorded." : `Sale recorded. Lifetime realized P/L for this holding: ${formatINR(nextPosition.realizedGain)}.`);
  }

  const { start: monthStart, end: monthEnd } = monthRange();
  const thisMonth = useMemo(() => transactions.filter(t => t.occurred_on >= monthStart.slice(0, 10) && t.occurred_on < monthEnd.slice(0, 10)), [transactions, monthStart, monthEnd]);
  const lastMonthTransactions = useMemo(() => {
    const now = new Date(), start = dateKey(new Date(now.getFullYear(), now.getMonth() - 1, 1)), end = dateKey(new Date(now.getFullYear(), now.getMonth(), 1));
    return transactions.filter(t => t.occurred_on >= start && t.occurred_on < end);
  }, [transactions]);
  const netExpense = (t:Transaction) => Math.max(0,num(t.amount)-(refundTotals.get(t.id)??0));
  const income = thisMonth.filter(t => t.kind === "income").reduce((s,t) => s + num(t.amount), 0);
  const expense = thisMonth.filter(t => t.kind === "expense").reduce((s,t) => s + netExpense(t), 0);
  const lastMonthIncome = lastMonthTransactions.filter(t=>t.kind==="income").reduce((s,t)=>s+num(t.amount),0);
  const lastMonthExpense = lastMonthTransactions.filter(t=>t.kind==="expense").reduce((s,t)=>s+netExpense(t),0);
  const cashBalances = accounts.map(account => {
    const tx = transactions.filter(t=>t.account_id===account.id);
    const adjustment = accountAdjustments.filter(a=>a.account_id===account.id).reduce((s,a)=>s+num(a.amount),0);
    const returned = refunds.filter(refund=>tx.some(t=>t.id===refund.transaction_id)).reduce((s,refund)=>s+num(refund.amount),0);
    const transferOut = transfers.filter(t => t.from_account_id === account.id).reduce((s, t) => s + num(t.amount), 0);
    const transferIn = transfers.filter(t => t.to_account_id === account.id).reduce((s, t) => s + num(t.amount), 0);
    return { ...account, balance: num(account.opening_balance) + tx.filter(t=>t.kind==="income").reduce((s,t)=>s+num(t.amount),0) - tx.filter(t=>t.kind==="expense").reduce((s,t)=>s+num(t.amount),0) + returned + adjustment - transferOut + transferIn };
  });
  const totalCash = cashBalances.reduce((s,a)=>s+a.balance,0);
  const investmentPositions: InvestmentPosition[] = useMemo(
    () => investments.map(investment => calculateInvestmentPosition(investment, investmentTransactions)),
    [investments, investmentTransactions],
  );
  const invested = investmentPositions.reduce((s,i)=>s+i.costBasis,0);
  const investmentValue = investmentPositions.reduce((s,i)=>s+i.marketValue,0);
  const realizedInvestmentGain = investmentPositions.reduce((s,i)=>s+i.realizedGain,0);
  const netWorth = totalCash + investmentValue;
  const gainLoss = investmentPositions.reduce((s,i)=>s+i.unrealizedGain+i.realizedGain,0);
  const investmentAction = investmentPositions.find(i=>i.id===investmentActionId) ?? null;
  const currentBudgets = budgets.filter(b=>b.month.slice(0,7)===todayISO().slice(0,7));
  const spentForBudget = (category: string) => thisMonth.filter(t=>t.kind==="expense"&&t.category===category).reduce((s,t)=>s+netExpense(t),0);
  const recentTransactions = [...transactions].sort((a,b)=>b.occurred_on.localeCompare(a.occurred_on)||b.created_at.localeCompare(a.created_at)).slice(0,6);
  const chartData = useMemo(() => {
    const now = new Date();
    if (period === "This month") {
      return Array.from({length:Math.min(now.getDate(),31)},(_,idx)=>{
        const d=idx+1, date=now.getFullYear()+"-"+String(now.getMonth()+1).padStart(2,"0")+"-"+String(d).padStart(2,"0");
        return {label:String(d),income:thisMonth.filter(t=>t.kind==="income"&&t.occurred_on===date).reduce((s,t)=>s+num(t.amount),0)+refunds.filter(refund=>refund.received_on===date).reduce((s,refund)=>s+num(refund.amount),0),expense:thisMonth.filter(t=>t.kind==="expense"&&t.occurred_on===date).reduce((s,t)=>s+num(t.amount),0)};
      });
    }
    return Array.from({length:6},(_,idx)=>{
      const date=new Date(now.getFullYear(),now.getMonth()-5+idx,1),key=dateKey(date).slice(0,7),rows=transactions.filter(t=>t.occurred_on.slice(0,7)===key);
      return {label:date.toLocaleDateString("en-IN",{month:"short"}),income:rows.filter(t=>t.kind==="income").reduce((s,t)=>s+num(t.amount),0)+refunds.filter(refund=>refund.received_on.slice(0,7)===key).reduce((s,refund)=>s+num(refund.amount),0),expense:rows.filter(t=>t.kind==="expense").reduce((s,t)=>s+num(t.amount),0)};
    });
  }, [period,transactions,thisMonth,refunds]);
  const expenseCategoryNames = [...new Set([...categories.filter(c=>c.kind==="expense").map(c=>c.name),...thisMonth.filter(t=>t.kind==="expense").map(t=>t.category)])];
  const expenseByCategory = expenseCategoryNames.map(category=>({category,amount:thisMonth.filter(t=>t.kind==="expense"&&t.category===category).reduce((s,t)=>s+netExpense(t),0)})).filter(r=>r.amount>0).sort((a,b)=>b.amount-a.amount).slice(0,5);
  const debtPositions: DebtPosition[] = debts.map(debt => {
    const repayments = debtRepayments.filter(r=>r.debt_id===debt.id);
    const repaid = repayments.reduce((s,r)=>s+num(r.amount),0);
    return {...debt,repaid,outstanding:Math.max(0,num(debt.amount)-repaid),repayments};
  });
  const transactionMonths = [...new Set([todayISO().slice(0, 7), ...transactions.map(t => t.occurred_on.slice(0, 7))])].sort().reverse();
  const filteredTransactions = transactions.filter(t=>{
    const matchesType=transactionFilter==="all"||t.kind===transactionFilter,term=searchTerm.toLowerCase();
    const matchesMonth=transactionMonth==="all"||t.occurred_on.slice(0,7)===transactionMonth;
    return matchesMonth&&matchesType&&(!term||[t.description,t.category,t.kind].some(s=>s.toLowerCase().includes(term)));
  });

  if (checkingAuth) return <div className="sign-in-wrap"><div className="sign-in-card"><div className="skeleton" style={{width:160,height:20}}/><div className="skeleton" style={{width:"80%",height:32,marginTop:30}}/><div className="skeleton" style={{width:"100%",height:44,marginTop:24}}/></div></div>;
  if (!user) return <LandingPage configured={Boolean(supabase)} busy={googleBusy} error={authError} onSignIn={signInWithGoogle}/>;

  const displayName=user.user_metadata?.full_name||user.user_metadata?.name||user.email?.split("@")[0]||"Your account";
  const avatarURL=user.user_metadata?.avatar_url||user.user_metadata?.picture||"";
  const pageDesc:Record<Page,string>={Overview:"Here’s your financial picture at a glance.",Transactions:"Track every rupee coming in and going out.",Budgets:"Plan spending with simple monthly limits.","Bank accounts":"Your cash accounts, with opening balances and adjustments.",Investments:"Your holdings, separate from your bank balances.",People:"Track money lent to friends, money borrowed, and repayments."};
  return <div className="app-shell">
    <aside className="sidebar"><Brand/><div style={{width:"100%"}}><p className="nav-label">Workspace</p><NavItems page={page} setPage={setPage}/></div><div className="sidebar-bottom"><div className="profile-row"><Avatar name={displayName} url={avatarURL}/><div className="profile-copy" style={{minWidth:0,flex:1}}><div style={{fontWeight:700,fontSize:12,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{displayName}</div><div style={{color:"#9298a5",fontSize:10,marginTop:3,overflow:"hidden",textOverflow:"ellipsis"}}>{user.email}</div></div><button className="icon-btn" aria-label="Sign out" title="Sign out" onClick={signOut}><LogOut size={15}/></button></div></div></aside>
    <main className="main-area"><header className="topbar"><div className="topbar-title">{page}</div><div className="topbar-right"><span className="pill green desktop-only"><span className="dot" style={{background:"#16856b",margin:0}}/> Private workspace</span><button className="icon-btn desktop-only" aria-label="Refresh" onClick={()=>void loadData()}><Activity size={16}/></button><button className="icon-btn" aria-label="Sign out" onClick={signOut}><LogOut size={15}/></button><Avatar name={displayName} url={avatarURL}/></div></header>
      <div className="content"><div className="page-head"><div><div className="eyebrow">{page==="Overview"?monthLabel():"Your finances"}</div><h1 className="page-title">{page==="Overview"?<>Welcome back, {displayName.split(" ")[0]}</>:page}</h1><p className="page-subtitle">{pageDesc[page]}</p></div><button className="btn primary" onClick={()=>openTransaction()}><Plus size={16}/><span className="hide-mobile">Add transaction</span><span className="mobile-add">Add</span></button></div>
      {notice&&<div className="notice" style={{marginBottom:16,display:"flex",alignItems:"center",justifyContent:"space-between",gap:10}}><span>{notice}</span><button className="icon-btn" onClick={()=>setNotice("")} aria-label="Dismiss"><X size={14}/></button></div>}
      {!loading&&accounts.length===0&&transactions.length===0&&investments.length===0&&page==="Overview"&&<div className="notice" style={{marginBottom:16}}>Your workspace is ready. Add a bank or cash account with its previous balance, then start recording transactions. Your data is private to your signed-in account.</div>}
      {page==="Overview"&&<OverviewPage loading={loading} income={income} expense={expense} cash={totalCash} investments={investmentValue} netWorth={netWorth} lastIncome={lastMonthIncome} lastExpense={lastMonthExpense} chartData={chartData} period={period} setPeriod={setPeriod} recent={recentTransactions} accountMap={new Map(accounts.map(a=>[a.id,a.name]))} budgets={currentBudgets} spentForBudget={spentForBudget} expenseByCategory={expenseByCategory} gainLoss={gainLoss} onAddBudget={()=>setModal("budget")} onNavigate={setPage} onEditTransaction={openTransaction} onDeleteTransaction={async t=>{if(debts.some(d=>d.transaction_id===t.id)||debtRepayments.some(r=>r.transaction_id===t.id)){notify("This transaction is linked to a People debt record. Manage it from People so the debt history stays consistent.");return;}if(!window.confirm("Delete this transaction and its refund history?")||!supabase)return;const {error}=await supabase.from("mm_transactions").delete().eq("id",t.id);if(error)notify(error.message);else{setTransactions(v=>v.filter(x=>x.id!==t.id));setRefunds(v=>v.filter(x=>x.transaction_id!==t.id));notify("Transaction deleted.");}}}/>}
      {page==="Transactions"&&<TransactionsPage rows={filteredTransactions} accountMap={new Map(accounts.map(a=>[a.id,a.name]))} searchTerm={searchTerm} setSearchTerm={setSearchTerm} filter={transactionFilter} setFilter={setTransactionFilter} monthFilter={transactionMonth} setMonthFilter={setTransactionMonth} monthOptions={transactionMonths} refundTotals={refundTotals} onAdd={()=>openTransaction()} onTransfer={()=>openTransfer()} onImport={()=>setShowImport(true)} onExport={exportTransactionsCsv} onCategories={()=>setShowCategories(true)} onRefund={t=>setRefundTarget(t)} onEdit={openTransaction} onDelete={async t=>{if(debts.some(d=>d.transaction_id===t.id)||debtRepayments.some(r=>r.transaction_id===t.id)){notify("This transaction is linked to a People debt record. Manage it from People so the debt history stays consistent.");return;}if(!window.confirm("Delete this transaction and its refund history?")||!supabase)return;const {error}=await supabase.from("mm_transactions").delete().eq("id",t.id);if(error)notify(error.message);else{setTransactions(v=>v.filter(x=>x.id!==t.id));setRefunds(v=>v.filter(x=>x.transaction_id!==t.id));notify("Transaction deleted.");}}}/>}
      {page==="Budgets"&&<BudgetsPage budgets={budgets} spend={spentForBudget} onAdd={()=>setModal("budget")} onDelete={async b=>{if(!window.confirm("Delete this budget?")||!supabase)return;const {error}=await supabase.from("mm_budgets").delete().eq("id",b.id);if(error)notify(error.message);else{setBudgets(v=>v.filter(x=>x.id!==b.id));notify("Budget deleted.");}}}/>}
      {page==="Bank accounts"&&<><AccountsPage accounts={cashBalances} transactions={transactions} onTransfer={accountId=>openTransfer(accountId)} onAdd={()=>setModal("account")} onAdjust={id=>{setSelectedAccountId(id);setModal("adjustment");}} onDelete={async a=>{if(!window.confirm("Delete this account?")||!supabase)return;const {error}=await supabase.from("mm_accounts").delete().eq("id",a.id);if(error)notify(error.message);else{setAccounts(v=>v.filter(x=>x.id!==a.id));notify("Account deleted.");void loadData();}}}/><TransfersHistory accounts={accounts} transfers={transfers}/></>}
      {page==="Investments"&&<InvestmentsPage rows={investmentPositions} activities={investmentTransactions} invested={invested} marketValue={investmentValue} gainLoss={gainLoss} realizedGain={realizedInvestmentGain} refreshingPrices={refreshingPrices} onRefreshPrices={()=>void refreshMarketPrices()} onActivity={i=>setInvestmentActionId(i.id)} onAdd={()=>openInvestment()} onEdit={openInvestment} onDelete={async i=>{if(!window.confirm("Delete this holding and its activity history?")||!supabase)return;const {error}=await supabase.from("mm_investments").delete().eq("id",i.id);if(error)notify(error.message);else{setInvestments(v=>v.filter(x=>x.id!==i.id));setInvestmentTransactions(v=>v.filter(x=>x.investment_id!==i.id));notify("Holding deleted.");}}}/>} 
      {page==="People"&&<PeoplePage debts={debtPositions} onAdd={()=>setDebtMode("new")} onRepay={d=>{setRepaymentTarget(d);setDebtMode("repayment");}}/>}
      </div></main><div className="mobile-nav"><NavItems page={page} setPage={setPage} mobile/></div>
    {showImport&&<TransactionImportModal accounts={accounts} categories={categories.map(c=>({kind:c.kind,name:c.name}))} onClose={()=>setShowImport(false)} onImport={importTransactions}/>}
    {showTransfer&&<TransferModal accounts={accounts} initialSourceAccountId={transferSourceAccountId} onClose={()=>{setShowTransfer(false);setTransferSourceAccountId("");}} onSave={saveTransfer}/>} 
    {showCategories&&<CategoriesModal categories={categories} onClose={()=>setShowCategories(false)} onAdd={addCategory} onDelete={deleteCategory}/>}
    {refundTarget&&<RefundModal transaction={refundTarget} refunds={refundsByTransaction.get(refundTarget.id)??[]} onClose={()=>setRefundTarget(null)} onSave={saveRefund}/>}
    {debtMode&&<DebtModal kind={debtMode} accounts={accounts} debt={debtMode==="repayment"?repaymentTarget??undefined:undefined} onClose={()=>{setDebtMode(null);setRepaymentTarget(null);}} onSaveDebt={saveDebt} onSaveRepayment={saveDebtRepayment}/>}
    {modal&&<EntryModal kind={modal} accounts={accounts} selectedAccountId={selectedAccountId} transaction={editingTransaction} investment={editingInvestment} categories={categories} onClose={()=>{setModal(null);setEditingTransaction(null);setEditingInvestment(null);setSelectedAccountId("");}} onSave={async payload=>{
      if(!supabase||!user)return;
      try {
        if(modal==="transaction"){const body=payload as Omit<Transaction,"id"|"created_at">;if(editingTransaction){const refunded=refundTotals.get(editingTransaction.id)??0;if(refunded>0&&(body.kind!=="expense"||Number(body.amount)+0.001<refunded||body.account_id!==editingTransaction.account_id))throw new Error("This expense already has refunds. Keep it as an expense, keep the amount at least equal to total refunds, and keep its original account.");const {data,error}=await supabase.from("mm_transactions").update(body).eq("id",editingTransaction.id).select().single();if(error)throw error;setTransactions(v=>v.map(t=>t.id===editingTransaction.id?data as Transaction:t));}else{const {data,error}=await supabase.from("mm_transactions").insert({...body,user_id:user.id}).select().single();if(error)throw error;setTransactions(v=>[data as Transaction,...v]);}notify(editingTransaction?"Transaction updated.":"Transaction added.");}
        else if(modal==="account"){const body=payload as Omit<Account,"id"|"created_at">;const {data,error}=await supabase.from("mm_accounts").insert({...body,user_id:user.id}).select().single();if(error)throw error;setAccounts(v=>[...v,data as Account]);notify("Account created.");}
        else if(modal==="budget"){const body=payload as Omit<Budget,"id">;const month=new Date();month.setDate(1);const {data,error}=await supabase.from("mm_budgets").upsert({...body,user_id:user.id,month:dateKey(month)},{onConflict:"user_id,category,month"}).select().single();if(error)throw error;setBudgets(v=>[...v.filter(b=>!(b.category===data.category&&b.month.slice(0,7)===data.month.slice(0,7))),data as Budget]);notify("Budget saved.");}
        else if(modal==="investment"){if(editingInvestment){const p=payload as {update:Partial<Investment>};const {data,error}=await supabase.from("mm_investments").update(p.update).eq("id",editingInvestment.id).select().single();if(error)throw error;setInvestments(v=>v.map(i=>i.id===editingInvestment.id?data as Investment:i));notify("Holding updated. Refresh prices to replace a manual quote.");}else{const p=payload as {investment:Omit<Investment,"id">;activity:{action:"buy"|"sell";units:number;unit_price:number;fees:number;occurred_on:string;notes:string|null}|null};const {data,error}=await supabase.from("mm_investments").insert({...p.investment,user_id:user.id}).select().single();if(error)throw error;if(p.activity){const {data:activity,error:activityError}=await supabase.from("mm_investment_transactions").insert({...p.activity,user_id:user.id,investment_id:data.id}).select().single();if(activityError){await supabase.from("mm_investments").delete().eq("id",data.id);throw activityError;}setInvestmentTransactions(v=>[...v,activity as InvestmentActivity]);notify("Investment added with its first purchase. Market value will update when a quote is available.");}else{notify("Fixed deposit added. Its estimated current value and maturity projection are included in your portfolio.");}setInvestments(v=>[data as Investment,...v]);}}
        else if(modal==="adjustment"){const p=payload as {account_id:string;amount:number;note:string;occurred_on:string};const {error}=await supabase.from("mm_account_adjustments").insert({...p,user_id:user.id});if(error)throw error;setAccountAdjustments(v=>[...v,{account_id:p.account_id,amount:p.amount}]);notify("Balance adjustment saved.");}
        setModal(null);setEditingTransaction(null);setEditingInvestment(null);setSelectedAccountId("");
      }catch(err){notify(err instanceof Error?err.message:"Save failed. Check the Supabase schema and RLS policies.");}
    }}/>}
    {investmentAction&&<InvestmentActivityModal investment={investmentAction} onClose={()=>setInvestmentActionId(null)} onSave={saveInvestmentActivity}/>}
  </div>;
}

function Avatar({name,url}:{name:string;url:string}){return <div className="avatar">{url?<img alt="" src={url}/>:name.slice(0,1).toUpperCase()}</div>;}
function NavItems({page,setPage,mobile=false}:{page:Page;setPage:(p:Page)=>void;mobile?:boolean}){return <nav className={mobile?"":"nav-list"}>{nav.map(({name,icon:Icon})=><button key={name} className={"nav-item"+(page===name?" active":"")} title={name} onClick={()=>setPage(name)}><Icon className="nav-icon"/><span className="nav-text">{mobile&&name==="Overview"?"Home":mobile&&name==="Transactions"?"Activity":mobile&&name==="Bank accounts"?"Accounts":mobile&&name==="Investments"?"Invest":name}</span></button>)}</nav>;}
function Metric({label,value,note,icon:Icon,tone="green",loading=false}:{label:string;value:number|string;note:string;icon:typeof TrendingUp;tone?:string;loading?:boolean}){
 const bg:Record<string,string>={green:"#e9f6f1",blue:"#eef2ff",orange:"#fff5e8",red:"#fff0f1"},fg:Record<string,string>={green:"#16856b",blue:"#4b71e8",orange:"#d9913b",red:"#d95b64"};
 return <div className="metric-card"><div className="metric-top"><span>{label}</span><span className="metric-icon" style={{background:bg[tone],color:fg[tone]}}><Icon size={16}/></span></div><div className="metric-value">{loading?<span className="skeleton" style={{display:"block",width:"75%",height:26}}/>:typeof value==="number"?formatINR(value):value}</div><div className="metric-note">{note}</div></div>;
}
function OverviewPage(p:{loading:boolean;income:number;expense:number;cash:number;investments:number;netWorth:number;lastIncome:number;lastExpense:number;chartData:{label:string;income:number;expense:number}[];period:"This month"|"Last 6 months";setPeriod:(v:"This month"|"Last 6 months")=>void;recent:Transaction[];accountMap:Map<string,string>;budgets:Budget[];spentForBudget:(c:string)=>number;expenseByCategory:{category:string;amount:number}[];gainLoss:number;onAddBudget:()=>void;onNavigate:(v:Page)=>void;onEditTransaction:(t:Transaction)=>void;onDeleteTransaction:(t:Transaction)=>void}){
 const flow=p.income-p.expense;const diff=(now:number,prev:number)=>prev===0?(now>0?"New this month":"Compared with last month"):`${now>=prev?"↑":"↓"} ${Math.abs(Math.round((now-prev)/prev*100))}% vs last month`;
 return <div><div className="grid metric-grid"><Metric label="Total balance" value={p.netWorth} note="Cash + current investments" icon={Wallet} loading={p.loading}/><Metric label="Income this month" value={p.income} note={diff(p.income,p.lastIncome)} icon={ArrowDownLeft} tone="blue" loading={p.loading}/><Metric label="Net expenses this month" value={p.expense} note="After recorded refunds"  icon={ArrowUpRight} tone="orange" loading={p.loading}/><Metric label="Investments value" value={p.investments} note={`${p.gainLoss>=0?"+":"−"}${formatINR(Math.abs(p.gainLoss))} total P/L incl. realized sales`} icon={ChartNoAxesCombined} tone={p.gainLoss>=0?"green":"red"} loading={p.loading}/></div>
 <div className="grid dashboard-grid"><section className="panel"><div className="panel-head"><div><h2 className="panel-title">Cash flow</h2><div className="panel-subtitle">Money in vs. money out</div></div><select aria-label="Chart period" className="search" style={{width:"auto",fontSize:11,padding:"8px 10px"}} value={p.period} onChange={e=>p.setPeriod(e.target.value as typeof p.period)}><option>This month</option><option>Last 6 months</option></select></div><div className="panel-body"><div className="legend-row" style={{marginBottom:16}}><span><i className="dot" style={{background:"#16856b"}}/>Cash in (incl. refunds)</span><span><i className="dot" style={{background:"#8fa5f5"}}/>Cash out</span><span style={{marginLeft:"auto",fontWeight:700,color:flow>=0?"#16856b":"#d95b64"}}>{flow>=0?"+":"−"}{formatINR(Math.abs(flow))} net</span></div><div className="chart-wrap">{p.chartData.length?<ResponsiveContainer width="100%" height="100%"><AreaChart data={p.chartData} margin={{top:8,right:4,left:-16,bottom:0}}><defs><linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#16856b" stopOpacity={.17}/><stop offset="100%" stopColor="#16856b" stopOpacity={0}/></linearGradient><linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8fa5f5" stopOpacity={.25}/><stop offset="100%" stopColor="#8fa5f5" stopOpacity={0}/></linearGradient></defs><CartesianGrid stroke="#f0f1f4" strokeDasharray="3 3" vertical={false}/><XAxis dataKey="label" tickLine={false} axisLine={false} tick={{fontSize:10,fill:"#999eaa"}} interval="preserveStartEnd"/><YAxis tickLine={false} axisLine={false} tick={{fontSize:10,fill:"#999eaa"}} tickFormatter={v=>v>=1000?`${Math.round(v/1000)}k`:String(v)} width={36}/><Tooltip formatter={v=>formatINR(Number(v))} contentStyle={{border:"1px solid #eceef2",borderRadius:10,fontSize:11,boxShadow:"none"}}/><Area type="monotone" dataKey="income" name="Income" stroke="#16856b" strokeWidth={2} fill="url(#incomeFill)"/><Area type="monotone" dataKey="expense" name="Expenses" stroke="#8fa5f5" strokeWidth={2} fill="url(#expenseFill)"/></AreaChart></ResponsiveContainer>:<div className="empty">Your cash flow will appear here once you add transactions.</div>}</div></div></section>
 <section className="panel"><div className="panel-head"><div><h2 className="panel-title">Monthly budgets</h2><div className="panel-subtitle">How spending is tracking</div></div><button className="btn subtle" onClick={()=>p.onNavigate("Budgets")}>View all <ChevronDown size={14}/></button></div><div className="panel-body">{p.budgets.length===0?<div className="empty"><Target size={24} style={{margin:"0 auto 10px",opacity:.45}}/><div>No budgets set up yet.</div><button className="btn" style={{marginTop:12}} onClick={p.onAddBudget}><Plus size={14}/> Create budget</button></div>:p.budgets.slice(0,5).map(b=>{const spent=p.spentForBudget(b.category),pct=Math.min(100,spent/num(b.monthly_limit)*100),over=spent>num(b.monthly_limit);return <div className="budget-row" key={b.id}><div className="budget-row-head"><span className="budget-name">{b.category}</span><span className="budget-numbers" style={{color:over?"#d95b64":undefined}}>{formatINR(spent)} / {formatINR(num(b.monthly_limit))}</span></div><div className="budget-track"><div className="progress"><span style={{width:`${pct}%`,background:over?"#d95b64":undefined}}/></div><span style={{fontSize:10,color:over?"#d95b64":"#8d93a0",width:31,textAlign:"right"}}>{Math.round(pct)}%</span></div></div>})}</div></section></div>
 <div className="grid dashboard-grid"><section className="panel"><div className="panel-head"><div><h2 className="panel-title">Recent transactions</h2><div className="panel-subtitle">Your latest activity</div></div><button className="btn subtle" onClick={()=>p.onNavigate("Transactions")}>See all <ChevronDown size={14}/></button></div><div className="panel-body">{p.recent.length===0?<div className="empty">No transactions recorded yet.</div>:p.recent.map(t=><TransactionRow key={t.id} row={t} accountName={t.account_id?p.accountMap.get(t.account_id):undefined} onEdit={()=>p.onEditTransaction(t)} onDelete={()=>p.onDeleteTransaction(t)}/>)}</div></section>
 <section className="panel"><div className="panel-head"><div><h2 className="panel-title">Spending breakdown</h2><div className="panel-subtitle">Top expense categories this month</div></div></div><div className="panel-body">{p.expenseByCategory.length===0?<div className="empty">Category breakdown appears after you log expenses.</div>:p.expenseByCategory.map((r,i)=>{const colors=["#16856b","#7590ed","#d9913b","#b59adb","#d95b64"],pct=p.expense?r.amount/p.expense*100:0;return <div className="budget-row" key={r.category}><div className="budget-row-head"><span className="budget-name">{r.category}</span><span className="budget-numbers">{formatINR(r.amount)} · {Math.round(pct)}%</span></div><div className="progress"><span style={{width:`${pct}%`,background:colors[i]}}/></div></div>})}</div></section></div></div>;
}
function TransactionRow({row,accountName,onEdit,onDelete,refundedAmount=0,onRefund}:{row:Transaction;accountName?:string;onEdit:()=>void;onDelete:()=>void;refundedAmount?:number;onRefund?:()=>void}){
 const income = row.kind === "income";
 const netCost = Math.max(0,num(row.amount)-refundedAmount);
 return <div className="transaction-row">
  <div style={{display:"flex",gap:11,alignItems:"center",minWidth:0}}>
   <div className="metric-icon" style={{flexShrink:0,background:income?"#e9f6f1":"#fff5e8",color:income?"#16856b":"#d9913b"}}>{income?<ArrowDownLeft size={16}/>:<ShoppingBag size={16}/>}</div>
   <div style={{minWidth:0}}><div className="transaction-name" style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{row.description||row.category}</div><div className="transaction-meta">{row.category} · {dateLabel(row.occurred_on)}{accountName?` · ${accountName}`:""}{!income&&refundedAmount>0?` · Refunded ${formatINR(refundedAmount)} · Net ${formatINR(netCost)}`:""}</div></div>
  </div>
  <span className={"pill "+(income?"green":"red")}>{income?"Income":refundedAmount>0?"Expense · refunded":"Expense"}</span>
  <div style={{display:"flex",alignItems:"center",gap:5,flexWrap:"wrap",justifyContent:"flex-end"}}><div className="transaction-amount" style={{color:income?"#16856b":"#252a33"}}>{income?"+":"−"}{formatINR(num(row.amount))}</div>{!income&&onRefund&&(netCost>0.001||refundedAmount>0)&&<button className="icon-btn" aria-label="Record refund" title="Record refund" onClick={onRefund} style={{width:28,height:28,borderColor:"transparent"}}><RotateCcw size={12}/></button>}<button className="icon-btn" aria-label="Edit transaction" onClick={onEdit} style={{width:28,height:28,borderColor:"transparent"}}><Pencil size={12}/></button><button className="icon-btn" aria-label="Delete transaction" onClick={onDelete} style={{width:28,height:28,borderColor:"transparent"}}><Trash2 size={12}/></button></div>
 </div>;
}
function TransactionsPage(p:{
 rows:Transaction[];
 accountMap:Map<string,string>;
 searchTerm:string;
 setSearchTerm:(v:string)=>void;
 filter:"all"|"income"|"expense";
 setFilter:(v:"all"|"income"|"expense")=>void;
 monthFilter:string;
 setMonthFilter:(v:string)=>void;
 monthOptions:string[];
 refundTotals:Map<string,number>;
 onAdd:()=>void;
 onTransfer:()=>void;
 onImport:()=>void;
 onExport:()=>void;
 onCategories:()=>void;
 onRefund:(transaction:Transaction)=>void;
 onEdit:(t:Transaction)=>void;
 onDelete:(t:Transaction)=>void;
}){
 const income=p.rows.filter(t=>t.kind==="income").reduce((s,t)=>s+num(t.amount),0);
 const expense=p.rows.filter(t=>t.kind==="expense").reduce((s,t)=>s+Math.max(0,num(t.amount)-(p.refundTotals.get(t.id)??0)),0);
 return <div>
  <div className="grid metric-grid" style={{marginBottom:16}}><Metric label="Visible income" value={income} note={p.monthFilter==="all"?"All months · current filters":`${monthKeyLabel(p.monthFilter)} · current filters`} icon={ArrowDownLeft}/><Metric label="Net expenses" value={expense} note={`${p.rows.length} transactions shown · after refunds`} icon={ArrowUpRight} tone="orange"/><Metric label="Net cash flow" value={income-expense} note="Income less net expenses" icon={Activity} tone={income>=expense?"green":"red"}/><Metric label="Transaction count" value={String(p.rows.length)} note={p.monthFilter==="all"?"Across all months":`In ${monthKeyLabel(p.monthFilter)}`} icon={ArrowLeftRight} tone="blue"/></div>
  <section className="panel">
   <div className="panel-head"><div><h2 className="panel-title">All transactions</h2><div className="panel-subtitle">Import, export, record refunds, and manage your categories</div></div><div className="filters"><button className="btn" onClick={p.onTransfer}><ArrowDownUp size={14}/> Transfer</button><button className="btn" onClick={p.onCategories}><Layers3 size={14}/> Categories</button><button className="btn" onClick={p.onExport}><Download size={14}/> Export CSV</button><button className="btn" onClick={p.onImport}><Upload size={14}/> Import</button><button className="btn primary" onClick={p.onAdd}><Plus size={15}/> Add</button></div></div>
   <div className="panel-body">
    <div className="filters" style={{marginBottom:14}}><div style={{position:"relative",flex:"1 1 180px"}}><Search size={15} style={{position:"absolute",left:11,top:11,color:"#9ba1ad"}}/><input className="search" style={{paddingLeft:33,width:"100%"}} placeholder="Search transactions" value={p.searchTerm} onChange={e=>p.setSearchTerm(e.target.value)}/></div><select className="search" aria-label="Filter transactions by month" style={{width:"auto"}} value={p.monthFilter} onChange={e=>p.setMonthFilter(e.target.value)}><option value="all">All months</option>{p.monthOptions.map(month=><option key={month} value={month}>{monthKeyLabel(month)}</option>)}</select><select className="search" aria-label="Filter transaction type" style={{width:"auto"}} value={p.filter} onChange={e=>p.setFilter(e.target.value as typeof p.filter)}><option value="all">All types</option><option value="income">Income</option><option value="expense">Expenses</option></select></div>
    {p.rows.length===0?<div className="empty">No matching transactions. Add a transaction to get started.</div>:p.rows.map(t=><TransactionRow key={t.id} row={t} accountName={t.account_id?p.accountMap.get(t.account_id):undefined} refundedAmount={p.refundTotals.get(t.id)??0} onRefund={t.kind==="expense"?()=>p.onRefund(t):undefined} onEdit={()=>p.onEdit(t)} onDelete={()=>p.onDelete(t)}/>)}
   </div>
  </section>
 </div>;
}
function BudgetsPage({budgets,spend,onAdd,onDelete}:{budgets:Budget[];spend:(category:string)=>number;onAdd:()=>void;onDelete:(b:Budget)=>void}){
 const month=todayISO().slice(0,7),current=budgets.filter(b=>b.month.slice(0,7)===month),total=current.reduce((s,b)=>s+num(b.monthly_limit),0),spent=current.reduce((s,b)=>s+spend(b.category),0);
 return <div><div className="grid metric-grid" style={{marginBottom:16}}><Metric label="Budgeted" value={total} note={`${current.length} budgets this month`} icon={Target}/><Metric label="Spent so far" value={spent} note="Recorded expenses in budget categories" icon={ShoppingBag} tone="orange"/><Metric label="Remaining" value={total-spent} note={spent>total?"Over budget":"Available this month"} icon={CircleDollarSign} tone={spent>total?"red":"green"}/><Metric label="Used" value={`${total?Math.round(spent/total*100):0}%`} note="Across current budgets" icon={Activity} tone="blue"/></div><section className="panel"><div className="panel-head"><div><h2 className="panel-title">Monthly budget limits</h2><div className="panel-subtitle">{monthLabel()} · Expenses matched by category</div></div><button className="btn primary" onClick={onAdd}><Plus size={15}/> Add budget</button></div><div className="panel-body">{current.length===0?<div className="empty">No budgets yet. Set monthly limits for food, transport, shopping, or another category.</div>:current.map(b=>{const value=spend(b.category),limit=num(b.monthly_limit),pct=limit?value/limit*100:0,over=value>limit;return <div key={b.id} style={{padding:"17px 0",borderBottom:"1px solid #f0f1f4"}}><div style={{display:"flex",alignItems:"center",gap:12}}><div style={{flex:1}}><div className="budget-name">{b.category}</div><div className="transaction-meta" style={{marginTop:6}}>{formatINR(value)} spent of {formatINR(limit)}</div></div><span className={"pill "+(over?"red":pct>75?"orange":"green")}>{Math.round(pct)}% used</span><button className="icon-btn" onClick={()=>onDelete(b)} aria-label="Delete budget"><Trash2 size={14}/></button></div><div className="progress" style={{marginTop:12,height:8}}><span style={{width:`${Math.min(100,pct)}%`,background:over?"#d95b64":pct>75?"#d9913b":undefined}}/></div>{over&&<div className="transaction-meta" style={{color:"#d95b64",marginTop:8}}>Over by {formatINR(value-limit)}</div>}</div>})}</div></section></div>;
}
function TransfersHistory({accounts,transfers}:{accounts:Account[];transfers:AccountTransfer[]}){
 const names=new Map(accounts.map(a=>[a.id,a.name]));
 const sorted=[...transfers].sort((a,b)=>b.occurred_on.localeCompare(a.occurred_on)||b.created_at.localeCompare(a.created_at)).slice(0,12);
 return <section className="panel" style={{marginTop:16}}><div className="panel-head"><div><h2 className="panel-title">Recent transfers</h2><div className="panel-subtitle">Internal transfers update account balances but do not count as income or expenses.</div></div><span className="pill blue">{transfers.length} total</span></div><div className="panel-body">{sorted.length===0?<div className="empty">No transfers recorded yet. Use Transfer money to move funds between two accounts.</div>:sorted.map(t=><div className="transaction-row" key={t.id}><div style={{display:"flex",gap:11,alignItems:"center",minWidth:0}}><div className="metric-icon" style={{background:"#eef2ff",color:"#4b71e8",flexShrink:0}}><ArrowDownUp size={15}/></div><div style={{minWidth:0}}><div className="transaction-name">{names.get(t.from_account_id)??"Account"} <span style={{color:"#9298a5"}}>→</span> {names.get(t.to_account_id)??"Account"}</div><div className="transaction-meta">{dateLabel(t.occurred_on)}{t.note?" · "+t.note:""}</div></div></div><div className="transaction-amount" style={{whiteSpace:"nowrap"}}>{formatINR(num(t.amount))}</div></div>)}</div></section>;
}
function AccountsPage(p:{accounts:(Account&{balance:number})[];transactions:Transaction[];onTransfer:(accountId?:string)=>void;onAdd:()=>void;onAdjust:(id:string)=>void;onDelete:(a:Account)=>void}){
 const [selected,setSelected]=useState("all"),listed=selected==="all"?p.accounts:p.accounts.filter(a=>a.account_type===selected);
 return <div><div className="grid metric-grid" style={{marginBottom:16}}><Metric label="Available cash" value={p.accounts.reduce((s,a)=>s+a.balance,0)} note="Across all accounts" icon={Wallet}/><Metric label="Bank accounts" value={String(p.accounts.filter(a=>a.account_type==="bank").length)} note="Tracked manually" icon={Landmark} tone="blue"/><Metric label="Cash & wallets" value={String(p.accounts.filter(a=>a.account_type!=="bank").length)} note="Cash and digital wallets" icon={CreditCard} tone="orange"/><Metric label="Opening balances" value={p.accounts.reduce((s,a)=>s+num(a.opening_balance),0)} note="Previous balance at setup" icon={CircleDollarSign} tone="green"/></div><div className="page-head" style={{alignItems:"center",marginTop:8}}><div><h2 className="panel-title">Your accounts</h2><p className="page-subtitle" style={{fontSize:12,marginTop:5}}>Opening balance + income − expenses + refunds + transfers ± adjustments.</p></div><div className="filters"><button className="btn" onClick={()=>p.onTransfer()}><ArrowDownUp size={14}/> Transfer money</button><button className="btn primary" onClick={p.onAdd}><Plus size={15}/> Add account</button></div></div><div className="filters" style={{marginBottom:16}}>{[["all","All accounts"],["bank","Banks"],["cash","Cash"],["wallet","Wallets"]].map(([value,label])=><button className={"btn"+(selected===value?" primary":"")} key={value} onClick={()=>setSelected(value)}>{label}</button>)}</div>{listed.length===0?<div className="panel"><div className="empty">No accounts here yet. Add the current or previous balance as an opening balance.</div></div>:<div className="grid account-grid">{listed.map(a=>{const linked=p.transactions.filter(t=>t.account_id===a.id);return <div className="account-card" key={a.id}><div className="account-card-top"><div style={{display:"flex",gap:11,alignItems:"center"}}><div className="metric-icon" style={{background:"#e9f6f1",color:"#16856b"}}>{a.account_type==="bank"?<Landmark size={17}/>:a.account_type==="wallet"?<CreditCard size={17}/>:<Banknote size={17}/>}</div><div><div className="transaction-name">{a.name}</div><div className="transaction-meta">{a.institution||({bank:"Bank account",cash:"Cash",wallet:"Digital wallet"} as Record<string,string>)[a.account_type]||a.account_type}</div></div></div><button className="icon-btn" onClick={()=>p.onDelete(a)} aria-label="Delete account"><MoreHorizontal size={16}/></button></div><div className="account-balance">{formatINR(a.balance)}</div><div className="transaction-meta">Opening balance: {formatINR(num(a.opening_balance))}</div><button className="btn" style={{width:"100%",marginTop:18,fontSize:11}} onClick={()=>p.onAdjust(a.id)}><Pencil size={13}/> Adjust balance</button><div className="transaction-meta" style={{marginTop:12}}>{linked.length} recorded transactions</div></div>})}</div>}</div>;
}
function InvestmentsPage(p:{
 rows:InvestmentPosition[];
 activities:InvestmentActivity[];
 invested:number;
 marketValue:number;
 gainLoss:number;
 realizedGain:number;
 refreshingPrices:boolean;
 onRefreshPrices:()=>void;
 onActivity:(i:InvestmentPosition)=>void;
 onAdd:()=>void;
 onEdit:(i:InvestmentPosition)=>void;
 onDelete:(i:InvestmentPosition)=>void;
}){
 const [filter,setFilter]=useState("all");
 const [expandedId,setExpandedId]=useState<string|null>(null);
 const filtered=filter==="all"?p.rows:p.rows.filter(i=>i.asset_type===filter);
 const groups=(["stock","mutual_fund","etf","gold","fixed_deposit","other"] as const).map(type=>({type,amount:p.rows.filter(i=>i.asset_type===type).reduce((s,i)=>s+num(i.current_value),0),count:p.rows.filter(i=>i.asset_type===type).length})).filter(g=>g.count>0);
 const unrealized=p.marketValue-p.invested;
 return <div>
  <div className="grid metric-grid" style={{marginBottom:16}}>
   <Metric label="Portfolio value" value={p.marketValue} note="Market quotes + estimated FD interest" icon={ChartNoAxesCombined}/>
   <Metric label="Invested principal" value={p.invested} note="FD principal + remaining investment cost basis" icon={CircleDollarSign} tone="blue"/>
   <Metric label="Unrealized gain / interest" value={(unrealized>=0?"+":"−")+formatINR(Math.abs(unrealized))} note={p.invested?(100*unrealized/p.invested).toFixed(1)+"% on open assets":"Add assets to calculate"} icon={unrealized>=0?TrendingUp:TrendingDown} tone={unrealized>=0?"green":"red"}/>
   <Metric label="Realized P/L" value={(p.realizedGain>=0?"+":"−")+formatINR(Math.abs(p.realizedGain))} note="From recorded sales" icon={Activity} tone={p.realizedGain>=0?"green":"red"}/>
  </div>
  <section className="panel" style={{marginBottom:16}}>
   <div className="panel-head"><div><h2 className="panel-title">Investment allocation</h2><div className="panel-subtitle">By current value · separate from bank cash</div></div><button className="btn primary" onClick={p.onAdd}><Plus size={15}/> Add investment</button></div>
   <div className="panel-body">{groups.length===0?<div className="empty">Add stocks, mutual funds, ETFs, gold, or fixed deposits to start tracking your portfolio.</div>:<><div className="progress" style={{height:10,display:"flex",marginBottom:18}}>{groups.map((g,index)=>{const colors=["#16856b","#4b71e8","#d9913b","#b59adb","#d95b64","#2b8796"];return <span key={g.type} style={{width:String(p.marketValue?g.amount/p.marketValue*100:0)+"%",background:colors[index]}}/>})}</div><div className="grid" style={{gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:13}}>{groups.map((g,index)=>{const colors=["#16856b","#4b71e8","#d9913b","#b59adb","#d95b64","#2b8796"];return <div key={g.type} style={{padding:"12px 13px",background:"#fafbfc",borderRadius:10}}><div style={{display:"flex",alignItems:"center",gap:7,fontSize:11,color:"#747b89"}}><span className="dot" style={{background:colors[index],margin:0}}/>{assetLabels[g.type]}</div><div style={{fontSize:17,fontWeight:750,marginTop:9}}>{formatINR(g.amount)}</div><div className="transaction-meta">{p.marketValue?Math.round(g.amount/p.marketValue*100):0}% of portfolio</div></div>})}</div></>}</div>
  </section>
  <section className="panel">
   <div className="panel-head"><div><h2 className="panel-title">Your holdings</h2><div className="panel-subtitle">Record dated buys/sells and update prices from market data</div></div><div className="filters"><button className="btn" onClick={p.onRefreshPrices} disabled={p.refreshingPrices}>{p.refreshingPrices?<LoaderCircle size={14} className="spin"/>:<Activity size={14}/>} {p.refreshingPrices?"Refreshing…":"Refresh prices"}</button><button className="btn primary" onClick={p.onAdd}><Plus size={15}/> Add investment</button></div></div>
   <div className="panel-body">
    <div className="filters" style={{marginBottom:16}}><select className="search" value={filter} onChange={e=>setFilter(e.target.value)} style={{width:"auto"}}><option value="all">All asset types</option><option value="stock">Stocks</option><option value="mutual_fund">Mutual funds</option><option value="etf">ETFs</option><option value="gold">Gold</option><option value="fixed_deposit">Fixed deposits</option><option value="other">Other</option></select><span className="transaction-meta">Market quotes are indicative. Fixed deposits show estimated accrued interest and maturity value.</span></div>
    {filtered.length===0?<div className="empty">No holdings match this filter. Add an asset and its first purchase.</div>:<div className="table-wrap"><table className="data-table"><thead><tr><th>Asset</th><th>Units</th><th className="right">Cost / principal</th><th className="right">Price / FD rate</th><th className="right">Market value</th><th className="right">Unrealized P/L</th><th>Price source</th><th></th></tr></thead><tbody>{filtered.map(i=>{
      const delta=i.unrealizedGain,Icon=assetIcons[i.asset_type];
      const history=p.activities.filter(a=>a.investment_id===i.id).slice().sort((a,b)=>b.occurred_on.localeCompare(a.occurred_on)||b.created_at.localeCompare(a.created_at));
      const expanded=expandedId===i.id;
      return <Fragment key={i.id}>
       <tr><td><div style={{display:"flex",alignItems:"center",gap:10}}><div className="metric-icon" style={{background:"#eef2ff",color:"#4b71e8",width:32,height:32}}><Icon size={15}/></div><div><div style={{fontWeight:700}}>{i.name}</div><div className="transaction-meta">{assetLabels[i.asset_type]}{i.symbol?" · "+i.symbol:""}</div></div></div></td><td>{i.asset_type==="fixed_deposit"?"FD":i.units.toLocaleString("en-IN",{maximumFractionDigits:6})}</td><td className="right">{i.asset_type==="fixed_deposit"?formatINR(i.costBasis):formatINR(i.units>0?i.costBasis/i.units:0)}</td><td className="right">{i.asset_type==="fixed_deposit"?`${num(i.annual_interest_rate).toFixed(2)}% p.a.`:i.current_price>0?formatINR(i.current_price):"—"}</td><td className="right" style={{fontWeight:700}}>{formatINR(i.marketValue)}</td><td className="right" style={{color:delta>=0?"#16856b":"#d95b64"}}>{delta>=0?"+":"−"}{formatINR(Math.abs(delta))}</td><td>{i.asset_type==="fixed_deposit"?<><div className="pill blue">Estimated FD value</div><div className="transaction-meta">Matures {i.maturity_date?dateLabel(i.maturity_date):"date not set"}</div></>:<><div>{i.price_source||"Manual / not refreshed"}</div><div className="transaction-meta">{i.price_updated_at?new Date(i.price_updated_at).toLocaleString("en-IN",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"}):"No quote timestamp"}</div></>}</td><td><div style={{display:"flex",gap:5}}>{i.asset_type!=="fixed_deposit"&&<><button className="icon-btn" aria-label="Activity history" title="Activity history" onClick={()=>setExpandedId(expanded?null:i.id)}><History size={13}/></button><button className="icon-btn" aria-label="Record buy or sell" title="Record buy or sell" onClick={()=>p.onActivity(i)}><ArrowLeftRight size={13}/></button></>}<button className="icon-btn" aria-label={i.asset_type==="fixed_deposit"?"Edit fixed deposit":"Edit holding"} title={i.asset_type==="fixed_deposit"?"Edit fixed deposit":"Edit holding / current price"} onClick={()=>p.onEdit(i)}><Pencil size={13}/></button><button className="icon-btn" aria-label="Delete holding" title="Delete holding" onClick={()=>p.onDelete(i)}><Trash2 size={13}/></button></div></td></tr>
       {expanded&&<tr><td colSpan={8} style={{background:"#fafbfc",padding:"14px 16px"}}><div style={{fontSize:12,fontWeight:700,marginBottom:10}}>Activity history · {history.length} record{history.length===1?"":"s"}</div>{history.length===0?<div className="transaction-meta">No dated buys or sells are recorded for this holding yet.</div>:<div className="table-wrap"><table className="data-table"><thead><tr><th>Date</th><th>Activity</th><th className="right">Units</th><th className="right">Price per unit</th><th className="right">Fees</th><th>Notes</th></tr></thead><tbody>{history.map(a=><tr key={a.id}><td>{dateLabel(a.occurred_on)}</td><td><span className={"pill "+(a.action==="buy"?"green":"orange")}>{a.action==="buy"?"Buy":"Sell"}</span></td><td className="right">{a.units.toLocaleString("en-IN",{maximumFractionDigits:6})}</td><td className="right">{formatINR(num(a.unit_price))}</td><td className="right">{formatINR(num(a.fees))}</td><td>{a.notes||"—"}</td></tr>)}</tbody></table></div>}</td></tr>}
      </Fragment>;
    })}</tbody></table></div>}
   </div>
  </section>
 </div>;
}
