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
  asset_type: "stock" | "mutual_fund" | "etf" | "gold" | "other";
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
