export type FixedDepositFrequency = "daily" | "monthly" | "quarterly" | "half_yearly" | "yearly";

export type InvestmentActivity = {
  id: string;
  investment_id: string;
  action: "buy" | "sell";
  units: number;
  unit_price: number;
  fees: number;
  occurred_on: string;
  created_at: string;
  notes: string | null;
};

export type InvestmentRecord = {
  id: string;
  asset_type: "stock" | "mutual_fund" | "etf" | "gold" | "other" | "fixed_deposit";
  name: string;
  symbol: string | null;
  platform: string | null;
  exchange?: string | null;
  units: number;
  invested_amount: number;
  current_value: number;
  current_price?: number | null;
  price_updated_at?: string | null;
  price_source?: string | null;
  annual_interest_rate?: number | null;
  maturity_date?: string | null;
  compounding_frequency?: FixedDepositFrequency | null;
  purchase_date: string;
  notes: string | null;
};

export type InvestmentPosition = InvestmentRecord & {
  units: number;
  invested_amount: number;
  current_value: number;
  current_price: number;
  costBasis: number;
  marketValue: number;
  unrealizedGain: number;
  realizedGain: number;
};

const n = (value: unknown) => Number(value ?? 0) || 0;
const compoundPeriods: Record<FixedDepositFrequency, number> = {
  daily: 365,
  monthly: 12,
  quarterly: 4,
  half_yearly: 2,
  yearly: 1,
};

/** Estimates an FD's value using the entered annual rate and compounding frequency.
 * Taxes, premature-withdrawal penalties, and bank-specific day-count rules are not modelled.
 */
export function calculateFixedDepositValue(
  principalValue: number,
  annualRateValue: number,
  openedOn: string,
  maturityOn: string | null | undefined,
  frequencyValue: FixedDepositFrequency | null | undefined = "quarterly",
  referenceDate = new Date().toISOString().slice(0, 10),
) {
  const principal = Math.max(0, n(principalValue));
  const annualRate = Math.max(0, n(annualRateValue));
  const frequency = frequencyValue || "quarterly";
  const periodsPerYear = compoundPeriods[frequency] || 4;
  const start = Date.parse(openedOn + "T00:00:00Z");
  const today = Date.parse(referenceDate + "T00:00:00Z");
  const maturity = maturityOn ? Date.parse(maturityOn + "T00:00:00Z") : Number.POSITIVE_INFINITY;
  if (!Number.isFinite(start) || !Number.isFinite(today) || today <= start || annualRate === 0) return principal;
  const end = Math.min(today, Number.isFinite(maturity) ? maturity : today);
  if (end <= start) return principal;
  const yearsElapsed = (end - start) / (365.25 * 24 * 60 * 60 * 1000);
  return principal * Math.pow(1 + annualRate / (100 * periodsPerYear), periodsPerYear * yearsElapsed);
}


export function calculateInvestmentPosition(
  investment: InvestmentRecord,
  activities: InvestmentActivity[],
): InvestmentPosition {
  const history = activities
    .filter(activity => activity.investment_id === investment.id)
    .slice()
    .sort((a, b) => a.occurred_on.localeCompare(b.occurred_on) || a.created_at.localeCompare(b.created_at));

  let units = 0;
  let costBasis = 0;
  let realizedGain = 0;

  if (investment.asset_type === "fixed_deposit") {
    const principal = Math.max(0, n(investment.invested_amount));
    const estimatedValue = calculateFixedDepositValue(
      principal,
      n(investment.annual_interest_rate),
      investment.purchase_date,
      investment.maturity_date,
      investment.compounding_frequency,
    );
    return {
      ...investment,
      units: 1,
      invested_amount: principal,
      current_price: estimatedValue,
      current_value: estimatedValue,
      costBasis: principal,
      marketValue: estimatedValue,
      unrealizedGain: estimatedValue - principal,
      realizedGain: 0,
    };
  }

  if (history.length) {
    for (const activity of history) {
      const quantity = Math.max(0, n(activity.units));
      const price = Math.max(0, n(activity.unit_price));
      const fees = Math.max(0, n(activity.fees));
      if (activity.action === "buy") {
        units += quantity;
        costBasis += quantity * price + fees;
      } else if (units > 0 && quantity > 0) {
        const soldUnits = Math.min(quantity, units);
        const removedCost = (costBasis / units) * soldUnits;
        realizedGain += soldUnits * price - fees - removedCost;
        costBasis = Math.max(0, costBasis - removedCost);
        units = Math.max(0, units - soldUnits);
      }
    }
  } else {
    // Retain compatibility with older holdings created before the activity ledger existed.
    units = n(investment.units);
    costBasis = n(investment.invested_amount);
  }

  const storedPrice = n(investment.current_price);
  const legacyImpliedPrice = units > 0 ? n(investment.current_value) / units : 0;
  const currentPrice = storedPrice > 0 ? storedPrice : legacyImpliedPrice;
  const marketValue = units <= 0 ? 0 : currentPrice > 0 ? units * currentPrice : n(investment.current_value);
  const unrealizedGain = marketValue - costBasis;

  return {
    ...investment,
    units,
    invested_amount: costBasis,
    current_price: currentPrice,
    current_value: marketValue,
    costBasis,
    marketValue,
    unrealizedGain,
    realizedGain,
  };
}
