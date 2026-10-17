export type TransactionKind = "income" | "expense";
export type CategoryRecord = { id: string; user_id: string; kind: TransactionKind; name: string; is_default: boolean; created_at?: string };

export const DEFAULT_CATEGORIES: Record<TransactionKind, string[]> = {
  income: ["Salary", "Freelance", "Interest", "Investment income", "Gift received", "Borrowed money", "Loan repayment received", "Other income"],
  expense: ["Food & drinks", "Groceries", "Transport", "Shopping", "Bills", "Education", "Entertainment", "Health", "Rent", "Travel", "Subscriptions", "Personal care", "Home", "Loans given", "Loan repayment paid", "Other"],
};
