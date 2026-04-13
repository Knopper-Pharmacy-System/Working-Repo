import { useEffect, useMemo, useState } from "react";
import { Calendar, Receipt, RefreshCw, Search, Wallet } from "lucide-react";
import AdminSidebar from "../../components/admin/AdminSidebar";
import AdminHeader from "../../components/admin/AdminHeader";
import AdminFooter from "../../components/admin/AdminFooter";
import { getToken } from "../../hooks/useAuth";

type DailySalesResponse = {
  report_date: string;
  summary: {
    total_transactions: number;
    gross_revenue: number;
    total_refunds_given: number;
    net_revenue: number;
    total_vat_collected: number;
    total_discounts_given: number;
  };
  payment_breakdown: Record<string, number>;
};

type ShiftHistoryItem = {
  shift_id: number;
  username: string;
  full_name: string;
  start_time: string | null;
  end_time: string | null;
  status: string;
};

type ReceiptResponse = {
  receipt_number: string;
  branch: string;
  date: string;
  cashier: string;
  payment_method: string;
  customer_type: string;
  items: Array<{ product_name: string; qty: number; unit_price: number; subtotal: number }>;
  financials: {
    subtotal: number;
    discount_amount: number;
    vat_amount: number;
    grand_total: number;
    amount_tendered: number;
    change_due: number;
  };
};

const PROD_API_BASE_URL = "https://web-production-783f2.up.railway.app";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || PROD_API_BASE_URL;
const PANEL_CARD_STYLE = { background: "linear-gradient(180deg, rgba(250,252,255,0.98) 0%, rgba(233,240,253,0.95) 100%)", border: "1px solid rgba(77,108,196,0.22)", boxShadow: "0 18px 48px rgba(1,24,84,0.16), inset 0 1px 0 rgba(255,255,255,0.88)" };
const METRIC_CARD_STYLE = { background: "linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(233,241,255,0.96) 100%)", border: "1px solid rgba(77,108,196,0.24)", boxShadow: "0 18px 42px rgba(1,24,84,0.18), inset 0 1px 0 rgba(255,255,255,0.88)" };
const TABLE_CARD_STYLE = { border: "1px solid rgba(115,139,205,0.24)", background: "linear-gradient(180deg, #ffffff 0%, #f4f7ff 100%)", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.9), 0 10px 28px rgba(11,37,97,0.09)" };
const toIsoDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const peso = (value: number) => `₱${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export default function AdminTransactionsPage() {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lastSync, setLastSync] = useState(new Date());
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(toIsoDate(new Date()));
  const [receiptId, setReceiptId] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);
  const [dailySales, setDailySales] = useState<DailySalesResponse | null>(null);
  const [shifts, setShifts] = useState<ShiftHistoryItem[]>([]);
  const [receipt, setReceipt] = useState<ReceiptResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [receiptLoading, setReceiptLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { const timer = window.setInterval(() => setCurrentTime(new Date()), 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => { const handleStatus = () => setIsOnline(navigator.onLine); window.addEventListener('online', handleStatus); window.addEventListener('offline', handleStatus); return () => { window.removeEventListener('online', handleStatus); window.removeEventListener('offline', handleStatus); }; }, []);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const token = getToken();
        if (!token) { setError('No auth token found. Please log in again.'); return; }
        const headers = { Authorization: `Bearer ${token}` };
        const [dailyResponse, shiftsResponse] = await Promise.all([
          fetch(`${API_BASE_URL}/pos/daily-sales?date=${selectedDate}`, { headers }),
          fetch(`${API_BASE_URL}/pos/shift-history`, { headers }),
        ]);
        const dailyPayload = await dailyResponse.json();
        const shiftsPayload = await shiftsResponse.json();
        if (!dailyResponse.ok) { setError(dailyPayload.message || dailyPayload.error || 'Failed to load daily sales.'); setDailySales(null); } else { setDailySales(dailyPayload as DailySalesResponse); }
        if (!shiftsResponse.ok) { setShifts([]); } else { setShifts((shiftsPayload.shifts || []) as ShiftHistoryItem[]); }
        setLastSync(new Date());
      } catch { setError('Network error while loading transactions.'); }
      finally { setIsLoading(false); }
    };
    void load();
  }, [refreshVersion, selectedDate]);

  const lookupReceipt = async () => {
    if (!receiptId.trim()) return;
    setReceiptLoading(true);
    try {
      const token = getToken();
      if (!token) return;
      const response = await fetch(`${API_BASE_URL}/pos/receipt/${receiptId.trim()}`, { headers: { Authorization: `Bearer ${token}` } });
      const payload = await response.json();
      if (!response.ok) { setReceipt(null); setError(payload.message || payload.error || 'Receipt not found.'); return; }
      setReceipt(payload as ReceiptResponse);
      setError(null);
    } catch { setReceipt(null); setError('Network error while looking up receipt.'); }
    finally { setReceiptLoading(false); }
  };

  const paymentSummary = useMemo(() => Object.entries(dailySales?.payment_breakdown || {}), [dailySales]);

  return (
    <div className="min-h-screen w-full overflow-y-auto overflow-x-hidden relative" style={{ background: "radial-gradient(circle at top left, rgba(113,160,255,0.18) 0%, transparent 26%), radial-gradient(circle at top right, rgba(11,49,153,0.28) 0%, transparent 30%), linear-gradient(180deg, #041f63 0%, #0b3499 42%, #2c63e0 100%)" }}>
      <div className="absolute inset-x-0 top-0 h-[320px] pointer-events-none" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0) 100%)" }} />
      <div className="absolute -top-24 -left-16 w-72 h-72 rounded-full blur-3xl pointer-events-none" style={{ background: "rgba(124, 160, 255, 0.18)" }} />
      <div className="absolute top-40 right-0 w-96 h-96 rounded-full blur-3xl pointer-events-none" style={{ background: "rgba(8, 29, 96, 0.22)" }} />
      <AdminSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} activeItem="Transactions" />
      <div className="relative z-10 w-full max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 flex flex-col gap-5">
        <AdminHeader onMenuClick={() => setSidebarOpen(true)} currentTime={currentTime} lastSync={lastSync} isOnline={isOnline} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[11px] font-bold tracking-[0.35em] uppercase" style={{ color: "rgba(216,231,255,0.66)" }}>Transaction Control</p><h2 className="font-bold text-2xl tracking-wide mt-1" style={{ color: "rgba(245,249,255,0.96)" }}>Transactions</h2><p className="text-sm mt-1" style={{ color: "rgba(218,232,255,0.74)" }}>Daily sales pulse, receipt lookup, and shift transaction context.</p></div><div className="flex items-center gap-2"><div className="relative flex items-center gap-2 h-11 px-4 rounded-2xl" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(226,235,255,0.93) 100%)", border: "1px solid rgba(112,136,214,0.34)", boxShadow: "0 16px 32px rgba(3,31,99,0.22), inset 0 1px 0 rgba(255,255,255,0.85)" }}><Calendar size={16} className="text-[#103182]" /><input type="date" value={selectedDate} max={toIsoDate(new Date())} onChange={(event) => setSelectedDate(event.target.value)} className="bg-transparent outline-none text-sm font-semibold text-[#103182]" /></div><button type="button" onClick={() => setRefreshVersion((value) => value + 1)} className="h-11 px-4 rounded-2xl text-sm font-bold text-white transition-opacity hover:opacity-90 flex items-center gap-2" style={{ background: "linear-gradient(180deg, #2449ff 0%, #1133f2 100%)", border: "1px solid rgba(183,205,255,0.28)", boxShadow: "0 12px 24px rgba(2,24,95,0.28)" }}><RefreshCw size={15} /> Refresh</button></div></div>
        {error ? <div className="rounded-xl px-4 py-3 text-sm font-medium" style={{ background: "rgba(255,255,255,0.14)", color: "#f4f7ff", border: "1px solid rgba(255,255,255,0.3)" }}>{error}</div> : null}
        <div className="rounded-[28px] p-5 sm:p-6" style={PANEL_CARD_STYLE}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-5">
            <div className="rounded-xl p-5" style={METRIC_CARD_STYLE}><p className="text-base font-extrabold tracking-wide uppercase" style={{ color: '#062d8c' }}>Transactions</p><p className="mt-2 leading-none" style={{ color: '#1536ef', fontSize: '3rem', fontWeight: 800 }}>{isLoading ? '—' : dailySales?.summary.total_transactions ?? 0}</p><div className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-600"><Receipt size={14} /> Receipts issued</div></div>
            <div className="rounded-xl p-5" style={METRIC_CARD_STYLE}><p className="text-base font-extrabold tracking-wide uppercase" style={{ color: '#062d8c' }}>Gross</p><p className="mt-2 leading-none" style={{ color: '#062d8c', fontSize: '2.2rem', fontWeight: 800 }}>{isLoading ? '—' : peso(dailySales?.summary.gross_revenue || 0)}</p><div className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-600"><Wallet size={14} /> Before refunds</div></div>
            <div className="rounded-xl p-5" style={METRIC_CARD_STYLE}><p className="text-base font-extrabold tracking-wide uppercase" style={{ color: '#062d8c' }}>Net</p><p className="mt-2 leading-none" style={{ color: '#00a83d', fontSize: '2.2rem', fontWeight: 800 }}>{isLoading ? '—' : peso(dailySales?.summary.net_revenue || 0)}</p><div className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-600"><Wallet size={14} /> After refunds</div></div>
            <div className="rounded-xl p-5" style={METRIC_CARD_STYLE}><p className="text-base font-extrabold tracking-wide uppercase" style={{ color: '#062d8c' }}>Refunds</p><p className="mt-2 leading-none" style={{ color: '#c62828', fontSize: '2.2rem', fontWeight: 800 }}>{isLoading ? '—' : peso(dailySales?.summary.total_refunds_given || 0)}</p><div className="mt-3 flex items-center gap-2 text-xs font-semibold text-slate-600"><Wallet size={14} /> Money returned</div></div>
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_1.2fr] gap-4">
            <div className="rounded-xl p-4" style={TABLE_CARD_STYLE}>
              <p className="text-sm font-bold text-[#062d8c] mb-3">Receipt Lookup</p>
              <div className="flex gap-2 mb-4"><div className="flex h-11 flex-1 items-center gap-2 rounded-2xl px-4" style={{ background: "linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(242,246,255,0.94) 100%)", border: "1px solid rgba(112,136,214,0.28)" }}><Search size={14} className="text-[#707070]" /><input type="text" placeholder="Enter receipt number" value={receiptId} onChange={(event) => setReceiptId(event.target.value)} className="flex-1 bg-transparent text-sm outline-none text-[#001d63]" /></div><button type="button" onClick={() => void lookupReceipt()} className="rounded-2xl px-4 text-sm font-bold text-white" style={{ background: '#1133f2' }}>{receiptLoading ? '...' : 'Lookup'}</button></div>
              {receipt ? <div className="space-y-3 text-sm"><div className="rounded-xl bg-[#eef3ff] px-4 py-3"><p className="font-extrabold text-[#062d8c]">{receipt.receipt_number}</p><p className="text-xs text-slate-500">{receipt.branch} · {receipt.date}</p><p className="text-sm mt-2 text-[#001d63]">Cashier: {receipt.cashier}</p><p className="text-sm text-[#001d63]">Payment: {receipt.payment_method}</p></div><div className="rounded-xl bg-[#f7f9ff] px-4 py-3"><p className="text-xs text-slate-500">Grand Total</p><p className="text-xl font-black text-[#00a83d]">{peso(receipt.financials.grand_total)}</p><p className="text-xs text-slate-500 mt-2">Items</p><p className="text-sm text-[#001d63]">{receipt.items.length}</p></div></div> : <p className="text-sm text-slate-500">Search a receipt to inspect transaction details.</p>}
            </div>
            <div className="rounded-xl overflow-hidden" style={TABLE_CARD_STYLE}><div className="px-4 py-3 border-b border-[#dbe3f7]"><p className="text-sm font-bold text-[#062d8c]">Recent Shift History</p><p className="text-xs text-slate-500">Open/closed shifts in current branch</p></div><div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm"><thead><tr className="bg-[#e8eefb] text-[#062d8c]"><th className="px-3 py-2 text-left text-xs font-bold">Shift</th><th className="px-3 py-2 text-left text-xs font-bold">Cashier</th><th className="px-3 py-2 text-left text-xs font-bold">Opened</th><th className="px-3 py-2 text-left text-xs font-bold">Closed</th><th className="px-3 py-2 text-left text-xs font-bold">Status</th></tr></thead><tbody>{shifts.length === 0 ? <tr><td colSpan={5} className="px-3 py-8 text-center text-slate-500">No shift history available.</td></tr> : shifts.slice(0, 8).map((shift, index) => <tr key={shift.shift_id} style={{ background: index % 2 === 0 ? '#f7f9ff' : '#edf2ff' }}><td className="px-3 py-2 text-[#001d63] font-semibold">#{shift.shift_id}</td><td className="px-3 py-2 text-[#001d63]">{shift.full_name || shift.username}</td><td className="px-3 py-2 text-[#001d63]">{shift.start_time || '—'}</td><td className="px-3 py-2 text-[#001d63]">{shift.end_time || 'Still Open'}</td><td className="px-3 py-2 text-[#001d63]">{shift.status}</td></tr>)}</tbody></table></div></div>
          </div>
          <div className="mt-4 rounded-xl p-4" style={TABLE_CARD_STYLE}><p className="text-sm font-bold text-[#062d8c] mb-2">Payment Breakdown</p><div className="grid grid-cols-1 md:grid-cols-3 gap-3">{paymentSummary.length === 0 ? <p className="text-sm text-slate-500">No payment mix available for this date.</p> : paymentSummary.map(([method, amount]) => <div key={method} className="rounded-xl bg-[#eef3ff] px-4 py-3"><p className="text-xs text-slate-500">{method}</p><p className="text-lg font-black text-[#1536ef]">{peso(Number(amount))}</p></div>)}</div></div>
        </div>
        <AdminFooter lastSync={lastSync} />
      </div>
    </div>
  );
}
