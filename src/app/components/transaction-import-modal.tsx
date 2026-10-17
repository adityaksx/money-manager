"use client";

import { useState } from "react";
import * as XLSX from "xlsx";
import { Download, FileSpreadsheet, Upload, X } from "lucide-react";
import type { TransactionKind } from "@/lib/categories";
import { todayISO } from "@/lib/format";

export type ImportTransaction = {
  kind: TransactionKind;
  amount: number;
  category: string;
  description: string;
  occurred_on: string;
  account_id: string | null;
};
type AccountOption = { id: string; name: string };
type CategoryOption = { kind: TransactionKind; name: string };

const norm = (value: unknown) => String(value ?? "").trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
function valueOf(row: Record<string, unknown>, aliases: string[]) {
  for (const [key, value] of Object.entries(row)) if (aliases.includes(norm(key))) return value;
  return "";
}
function dateValue(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return `${parsed.y}-${String(parsed.m).padStart(2,"0")}-${String(parsed.d).padStart(2,"0")}`;
  }
  const text = String(value ?? "").trim();
  if (!text) return null;
  const dmy = text.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (dmy) {
    const day = Number(dmy[1]), month = Number(dmy[2]), year = Number(dmy[3].length === 2 ? `20${dmy[3]}` : dmy[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
    return `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
  }
  const iso = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${String(Number(iso[2])).padStart(2,"0")}-${String(Number(iso[3])).padStart(2,"0")}`;
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : `${parsed.getFullYear()}-${String(parsed.getMonth()+1).padStart(2,"0")}-${String(parsed.getDate()).padStart(2,"0")}`;
}
function numberValue(value: unknown): number {
  if (typeof value === "number") return value;
  const raw = String(value ?? "").trim();
  const parenthesizedNegative = raw.startsWith("(") && raw.endsWith(")");
  const cleaned = raw.replace(/[₹$€£,\s()]/g, "");
  const parsed = Number(cleaned);
  if (!Number.isFinite(parsed)) return parsed;
  return parenthesizedNegative ? -Math.abs(parsed) : parsed;
}
function parseRows(rawRows: Record<string, unknown>[], accounts: AccountOption[], categoryOptions: CategoryOption[]) {
  const rows: ImportTransaction[] = [];
  const errors: string[] = [];
  rawRows.forEach((row, index) => {
    const rowNumber = index + 2;
    const date = dateValue(valueOf(row, ["date","transaction date","occurred on","occurred_on","posted date","value date"]));
    const typeRaw = norm(valueOf(row, ["type","kind","transaction type","txn type","direction","dr cr","credit debit"]));
    const amountCell = valueOf(row, ["amount","amount inr","amount (inr)","value","total","transaction amount"]);
    const debitCell = valueOf(row, ["debit","debit amount","withdrawal","withdrawals","money out"]);
    const creditCell = valueOf(row, ["credit","credit amount","deposit","deposits","money in"]);
    let amount = numberValue(amountCell);
    let kind: TransactionKind;
    if (typeRaw.includes("exp") || typeRaw.includes("debit") || typeRaw === "dr" || typeRaw.includes("withdraw")) kind = "expense";
    else if (typeRaw.includes("inc") || typeRaw.includes("credit") || typeRaw === "cr" || typeRaw.includes("deposit")) kind = "income";
    else if (numberValue(debitCell) > 0 || numberValue(creditCell) > 0) kind = numberValue(debitCell) > 0 ? "expense" : "income";
    else kind = amount < 0 ? "expense" : "income";
    if (!Number.isFinite(amount) || amount === 0) {
      if (numberValue(debitCell) > 0 || numberValue(creditCell) > 0) amount = numberValue(debitCell) > 0 ? numberValue(debitCell) : numberValue(creditCell);
    }
    amount = Math.abs(amount);
    if (!date || !Number.isFinite(amount) || amount <= 0) {
      errors.push(`Row ${rowNumber}: missing or invalid date/amount`);
      return;
    }
    const rawCategory = String(valueOf(row, ["category","expense category","income category","type of expense"]) ?? "").trim();
    const category = rawCategory || (kind === "income" ? "Other income" : "Other");
    const rawDescription = String(valueOf(row, ["description","narration","merchant","details","particulars","notes","memo","name"]) ?? "").trim();
    const rawAccount = norm(valueOf(row, ["account","account name","bank account","source account"]));
    const account = accounts.find(a => norm(a.name) === rawAccount);
    rows.push({ kind, amount: Math.round(amount * 100) / 100, category, description: rawDescription, occurred_on: date, account_id: account?.id ?? null });
    if (rawAccount && !account) errors.push(`Row ${rowNumber}: account "${rawAccount}" did not match an account; imported without an account.`);
    if (rawCategory && !categoryOptions.some(c => c.kind === kind && norm(c.name) === norm(rawCategory))) errors.push(`Row ${rowNumber}: category "${rawCategory}" will be added as a custom ${kind} category.`);
  });
  return { rows, errors };
}

export function downloadTransactionTemplate() {
  const sheet = XLSX.utils.aoa_to_sheet([
    ["date","type","amount","category","description","account"],
    [todayISO(),"expense",1200,"Shopping","Example order","Cash"],
    [todayISO(),"income",5000,"Freelance","Example payment","Bank account"],
  ]);
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Transactions");
  XLSX.writeFile(book, "money-manager-transactions-template.xlsx");
}

export default function TransactionImportModal({
  accounts, categories, onClose, onImport,
}: {
  accounts: AccountOption[];
  categories: CategoryOption[];
  onClose: () => void;
  onImport: (rows: ImportTransaction[]) => Promise<void>;
}) {
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<ImportTransaction[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [fileError, setFileError] = useState("");
  const [busy, setBusy] = useState(false);

  async function chooseFile(file?: File) {
    setFileName(file?.name ?? "");
    setRows([]);
    setErrors([]);
    setFileError("");
    if (!file) return;
    try {
      const ext = file.name.toLowerCase().split(".").pop();
      if (!["csv","xlsx","xls"].includes(ext || "")) throw new Error("Choose a .csv, .xlsx, or .xls file.");
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array", cellDates: false });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) throw new Error("The workbook has no sheet.");
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "", raw: true });
      if (!raw.length) throw new Error("No transaction rows were found. Put column headers in the first row.");
      const parsed = parseRows(raw, accounts, categories);
      if (!parsed.rows.length) throw new Error("No valid transactions could be read. Check the required date, type, and amount columns.");
      setRows(parsed.rows);
      setErrors(parsed.errors);
    } catch (error) {
      setFileError(error instanceof Error ? error.message : "Could not read this spreadsheet.");
    }
  }

  async function submit() {
    if (!rows.length) return;
    setBusy(true);
    setFileError("");
    try { await onImport(rows); onClose(); }
    catch (error) { setFileError(error instanceof Error ? error.message : "Import failed. No successful confirmation was returned."); }
    finally { setBusy(false); }
  }

  return <div className="form-overlay" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
    <section className="form-modal" role="dialog" aria-modal="true" aria-label="Import transactions">
      <div className="modal-head"><div><h2 className="panel-title" style={{fontSize:16}}>Import transactions</h2><div className="panel-subtitle">Load income and expenses from Excel or CSV</div></div><button className="icon-btn" onClick={onClose} aria-label="Close"><X size={16}/></button></div>
      <div className="modal-body">
        <div className="notice" style={{marginBottom:14,lineHeight:1.6}}>Required columns: <b>date</b>, <b>amount</b>. Include a <b>type</b> column with income/expense for reliable classification. Optional: category, description, account. A recognized account name is linked; unmatched accounts import with no account.</div>
        <div className="filters" style={{marginBottom:14}}>
          <label className="btn" style={{cursor:"pointer"}}><Upload size={14}/> Choose Excel / CSV<input type="file" accept=".csv,.xlsx,.xls" style={{display:"none"}} onChange={e=>void chooseFile(e.target.files?.[0])}/></label>
          <button className="btn" type="button" onClick={downloadTransactionTemplate}><Download size={14}/> Template</button>
        </div>
        {fileName&&<div className="transaction-meta" style={{marginBottom:10}}><FileSpreadsheet size={13} style={{display:"inline",verticalAlign:"middle"}}/> {fileName} · {rows.length} valid rows</div>}
        {rows.length>0&&<><div className="grid metric-grid" style={{gridTemplateColumns:"repeat(3,minmax(0,1fr))",marginBottom:12}}><div className="metric-card"><div className="metric-note">Rows ready</div><div className="metric-value">{rows.length}</div></div><div className="metric-card"><div className="metric-note">Income</div><div className="metric-value">{rows.filter(r=>r.kind==="income").length}</div></div><div className="metric-card"><div className="metric-note">Expenses</div><div className="metric-value">{rows.filter(r=>r.kind==="expense").length}</div></div></div>
          <div className="table-wrap"><table className="data-table"><thead><tr><th>Date</th><th>Type</th><th>Category</th><th>Description</th><th className="right">Amount</th></tr></thead><tbody>{rows.slice(0,8).map((r,i)=><tr key={i}><td>{r.occurred_on}</td><td>{r.kind}</td><td>{r.category}</td><td>{r.description||"—"}</td><td className="right">{r.amount.toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})}</td></tr>)}</tbody></table></div>
          {rows.length>8&&<div className="transaction-meta" style={{marginTop:8}}>Showing first 8 of {rows.length} transactions.</div>}</>}
        {errors.length>0&&<div className="setup-card" style={{marginTop:12}}><strong>Import notes ({errors.length})</strong><div style={{maxHeight:120,overflow:"auto",marginTop:6}}>{errors.slice(0,20).map((e,i)=><div key={i} className="transaction-meta">{e}</div>)}</div></div>}
        {fileError&&<div className="auth-error" style={{marginTop:12}}>{fileError}</div>}
        <div className="modal-actions"><button className="btn" type="button" onClick={onClose}>Cancel</button><button className="btn primary" type="button" disabled={!rows.length||busy} onClick={()=>void submit()}>{busy?"Importing…":`Import ${rows.length} transactions`}</button></div>
      </div>
    </section>
  </div>;
}
