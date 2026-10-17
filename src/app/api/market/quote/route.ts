import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 15;

type AssetType = "stock" | "etf" | "mutual_fund";
type MarketQuote = {
  symbol: string;
  source: string;
  currency: string;
  currentPrice: number;
  currentDate: string | null;
  historicalPrice: number | null;
  historicalDate: string | null;
};

function dateText(value: Date) {
  return value.toISOString().slice(0, 10);
}

function amfiDate(value: Date) {
  const day = String(value.getUTCDate()).padStart(2, "0");
  const month = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][value.getUTCMonth()];
  return `${day}-${month}-${value.getUTCFullYear()}`;
}

async function authorize(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!token || !url || !key) return false;
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.auth.getUser(token);
  return !error && Boolean(data.user);
}

function normalizeYahooSymbol(symbol: string, exchange: string) {
  const clean = symbol.trim();
  if (/[.=^]/.test(clean)) return clean;
  if (exchange === "NSE") return `${clean}.NS`;
  if (exchange === "BSE") return `${clean}.BO`;
  return clean;
}

async function fetchYahoo(inputSymbol: string, date?: string, exchange = ""): Promise<MarketQuote> {
  const symbol = normalizeYahooSymbol(inputSymbol, exchange);
  // Yahoo's public chart endpoint is unofficial and can change or rate-limit requests.
  // Cache quote responses and retain a manual-price fallback in the UI.
  const encodedSymbol = encodeURIComponent(symbol);
  const currentUrl = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodedSymbol}`);
  currentUrl.searchParams.set("range", "5d");
  currentUrl.searchParams.set("interval", "1d");
  const currentResponse = await fetch(currentUrl, {
    headers: { "User-Agent": "MoneyManager/1.0 (personal portfolio tracker)" },
    next: { revalidate: 900 },
  });
  if (!currentResponse.ok) throw new Error("Yahoo Finance could not be reached. Try again or enter prices manually.");
  const currentJson = await currentResponse.json();
  const result = currentJson?.chart?.result?.[0];
  if (!result) throw new Error(currentJson?.chart?.error?.description || "Symbol not found on Yahoo Finance. Check the ticker suffix (for example, RELIANCE.NS).");
  const meta = result.meta ?? {};
  const closes: Array<number | null> = result.indicators?.quote?.[0]?.close ?? [];
  const times: number[] = result.timestamp ?? [];
  const lastIndex = [...closes.keys()].reverse().find(index => typeof closes[index] === "number" && Number.isFinite(closes[index]));
  const currentPrice = Number(meta.regularMarketPrice ?? (lastIndex === undefined ? NaN : closes[lastIndex]));
  if (String(meta.currency ?? "INR").toUpperCase() !== "INR") {
    throw new Error("This portfolio currently totals holdings in INR. Use an Indian exchange symbol such as RELIANCE.NS or enter a manual INR price; foreign-currency conversion is not enabled yet.");
  }
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) throw new Error("No usable current quote was returned for this symbol.");
  const currentDate = meta.regularMarketTime
    ? dateText(new Date(Number(meta.regularMarketTime) * 1000))
    : (lastIndex === undefined ? null : dateText(new Date(Number(times[lastIndex]) * 1000)));
  let historicalPrice: number | null = null;
  let historicalDate: string | null = null;

  if (date) {
    const requested = new Date(`${date}T00:00:00.000Z`);
    if (!Number.isFinite(requested.getTime())) throw new Error("Invalid transaction date.");
    const period1 = Math.floor(requested.getTime() / 1000) - 10 * 86400;
    const period2 = Math.floor(requested.getTime() / 1000) + 86400;
    const historyUrl = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodedSymbol}`);
    historyUrl.searchParams.set("period1", String(period1));
    historyUrl.searchParams.set("period2", String(period2));
    historyUrl.searchParams.set("interval", "1d");
    const historyResponse = await fetch(historyUrl, {
      headers: { "User-Agent": "MoneyManager/1.0 (personal portfolio tracker)" },
      next: { revalidate: 86400 },
    });
    if (historyResponse.ok) {
      const historyJson = await historyResponse.json();
      const history = historyJson?.chart?.result?.[0];
      const historyTimes: number[] = history?.timestamp ?? [];
      const historyCloses: Array<number | null> = history?.indicators?.quote?.[0]?.close ?? [];
      const candidates = historyTimes.map((time, index) => ({
        date: dateText(new Date(Number(time) * 1000)),
        price: Number(historyCloses[index]),
      })).filter(row => row.date <= date && Number.isFinite(row.price) && row.price > 0)
        .sort((a, b) => b.date.localeCompare(a.date));
      if (candidates[0]) {
        historicalPrice = candidates[0].price;
        historicalDate = candidates[0].date;
      }
    }
  }

  return {
    symbol,
    source: "Yahoo Finance (unofficial)",
    currency: String(meta.currency ?? "INR"),
    currentPrice,
    currentDate,
    historicalPrice,
    historicalDate,
  };
}

type AmfiRow = { code: string; isins: string[]; name: string; nav: number; date: string };

function findAmfiRow(text: string, symbol: string, columns: "latest" | "history"): AmfiRow | null {
  const normalized = symbol.trim().toUpperCase();
  let best: AmfiRow | null = null;
  for (const line of text.split(/\r?\n/)) {
    const fields = line.split(";").map(value => value.trim());
    if (fields.length < (columns === "latest" ? 6 : 8)) continue;
    const code = fields[0];
    if (!/^\d+$/.test(code)) continue;
    const isins = columns === "latest" ? [fields[1], fields[2]] : [fields[2], fields[3]];
    const name = columns === "latest" ? fields[3] : fields[1];
    const navText = columns === "latest" ? fields[4] : fields[4];
    const dateRaw = columns === "latest" ? fields[5] : fields[7];
    const [dayText, monthText, yearText] = dateRaw.split("-");
    const monthIndex = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"].indexOf(String(monthText).toLowerCase());
    const rowDate = monthIndex >= 0 ? new Date(Date.UTC(Number(yearText), monthIndex, Number(dayText))) : new Date(dateRaw);
    const nav = Number(navText);
    if (!Number.isFinite(nav) || nav <= 0 || !Number.isFinite(rowDate.getTime())) continue;
    if (code === normalized || isins.some(isin => isin.toUpperCase() === normalized)) {
      const parsedDate = rowDate.toISOString().slice(0, 10);
      if (!best || parsedDate > best.date) best = { code, isins, name, nav, date: parsedDate };
    }
  }
  return best;
}

async function fetchAmfi(symbol: string, date?: string): Promise<MarketQuote> {
  // AMFI is the first-party daily NAV source for Indian mutual fund schemes.
  const currentResponse = await fetch("https://www.amfiindia.com/spages/NAVAll.txt", {
    headers: { "User-Agent": "MoneyManager/1.0 (personal portfolio tracker)" },
    next: { revalidate: 21600 },
  });
  if (!currentResponse.ok) throw new Error("AMFI latest NAV feed is temporarily unavailable.");
  const currentText = await currentResponse.text();
  const current = findAmfiRow(currentText, symbol, "latest");
  if (!current) throw new Error("Mutual fund not found in AMFI's NAV feed. Use its AMFI scheme code or ISIN as the symbol.");

  let historicalPrice: number | null = null;
  let historicalDate: string | null = null;
  if (date) {
    const requested = new Date(`${date}T00:00:00.000Z`);
    if (Number.isFinite(requested.getTime())) {
      const from = new Date(requested.getTime() - 10 * 86400000);
      const historyUrl = new URL("https://portal.amfiindia.com/DownloadNAVHistoryReport_Po.aspx");
      historyUrl.searchParams.set("frmdt", amfiDate(from));
      historyUrl.searchParams.set("todt", amfiDate(requested));
      const historyResponse = await fetch(historyUrl, {
        headers: { "User-Agent": "MoneyManager/1.0 (personal portfolio tracker)" },
        next: { revalidate: 86400 },
      });
      if (historyResponse.ok) {
        const historical = findAmfiRow(await historyResponse.text(), symbol, "history");
        if (historical && historical.date <= date) {
          historicalPrice = historical.nav;
          historicalDate = historical.date;
        }
      }
    }
  }

  return {
    symbol,
    source: "AMFI NAV",
    currency: "INR",
    currentPrice: current.nav,
    currentDate: current.date,
    historicalPrice,
    historicalDate,
  };
}

export async function GET(request: Request) {
  if (!(await authorize(request))) {
    return NextResponse.json({ error: "Sign in to request market prices." }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get("symbol") ?? "").trim();
  const type = (searchParams.get("type") ?? "").trim() as AssetType;
  const date = (searchParams.get("date") ?? "").trim() || undefined;
  const exchange = (searchParams.get("exchange") ?? "").trim().toUpperCase();
  if (!symbol || symbol.length > 100 || /[<>]/.test(symbol)) {
    return NextResponse.json({ error: "Enter a valid ticker, AMFI scheme code, or ISIN." }, { status: 400 });
  }
  if (!["stock", "etf", "mutual_fund"].includes(type)) {
    return NextResponse.json({ error: "Automatic prices are supported for stocks, ETFs, and Indian mutual funds." }, { status: 400 });
  }
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Date must use YYYY-MM-DD format." }, { status: 400 });
  }
  try {
    const quote = type === "mutual_fund" ? await fetchAmfi(symbol, date) : await fetchYahoo(symbol, date, exchange);
    return NextResponse.json(quote, { headers: { "Cache-Control": "private, max-age=0, must-revalidate" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to fetch this market price." }, { status: 502 });
  }
}
