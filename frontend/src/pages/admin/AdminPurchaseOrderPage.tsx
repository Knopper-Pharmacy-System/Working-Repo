import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  Paperclip,
  FileText,
  Upload,
  Save,
  Send,
  X,
} from "lucide-react";
import AdminSidebar from "../../components/admin/AdminSidebar";
import AdminHeader from "../../components/admin/AdminHeader";


// --- Types -------------------------------------------------------------------

type PayTerm = "COD" | "7 Days" | "15 Days" | "30 Days" | "90 Days";

interface OrderLine {
  id: number;
  itemName: string;
  sku: string;
  qty: number;
  unit: string;
  unitPrice: number;
}

// --- Sample Data -------------------------------------------------------------

const SAMPLE_SUPPLIERS = [
  "Norvic Drugs Corporation",
  "Zuellig Pharma Corporation",
  "VMED Medical Co",
  "Milaor Trading Corporation",
  "Nestle Philippines Inc.",
  "Del Monte Philippines",
  "Century Pacific Food Inc.",
  "SPL05 Medical Supplies",
  "Pascual Labs",
  "United Lab Inc.",
  "Reckitt Benckiser Philippines",
];

const BRANCHES = ["BMC MAIN", "DIVERSION BRANCH", "PANGANIBAN BRANCH"];

const PAY_TERMS: PayTerm[] = ["COD", "7 Days", "15 Days", "30 Days", "90 Days"];

const CATALOG = [
  {
    itemName: "Paracetamol 500MG Tab (ALVEDON)",
    sku: "101674",
    unit: "Tab",
    unitPrice: 8.5,
  },
  {
    itemName: "Amoxicillin 500MG Cap",
    sku: "56712",
    unit: "Cap",
    unitPrice: 12.75,
  },
  {
    itemName: "Biogesic 500MG Tab",
    sku: "78432",
    unit: "Tab",
    unitPrice: 9.25,
  },
  { itemName: "Neozep Forte Tab", sku: "34567", unit: "Tab", unitPrice: 8.75 },
  {
    itemName: "Cougmax 100mL Syrup",
    sku: "23456",
    unit: "Bot",
    unitPrice: 55.0,
  },
  {
    itemName: "20CC Syringe (ANY BRAND)",
    sku: "2.02E+11",
    unit: "Pcs",
    unitPrice: 5.25,
  },
  {
    itemName: "Disposable Gloves Medium 100pcs",
    sku: "98234",
    unit: "Box",
    unitPrice: 65.0,
  },
  {
    itemName: "Betadine Solution 100mL",
    sku: "45689",
    unit: "Bot",
    unitPrice: 78.25,
  },
  {
    itemName: "Dettol Antiseptic 500mL",
    sku: "67890",
    unit: "Bot",
    unitPrice: 145.0,
  },
  {
    itemName: "Lucky Me Pancit Canton 65g",
    sku: "34512",
    unit: "Pcs",
    unitPrice: 14.0,
  },
  { itemName: "Milo 300g", sku: "45678", unit: "Box", unitPrice: 89.5 },
  { itemName: "Eden Cheese 165g", sku: "56789", unit: "Pcs", unitPrice: 52.5 },
  {
    itemName: "Face Mask 3-ply 50pcs",
    sku: "12345",
    unit: "Box",
    unitPrice: 75.0,
  },
  {
    itemName: "Bandage Gauze 4in x 4yd",
    sku: "78901",
    unit: "Roll",
    unitPrice: 35.0,
  },
  {
    itemName: "Ibuprofen 400MG Tab",
    sku: "01234",
    unit: "Tab",
    unitPrice: 11.25,
  },
];

const INITIAL_LINES: OrderLine[] = [
  {
    id: 1,
    itemName: "Paracetamol 500MG Tab (ALVEDON)",
    sku: "101674",
    qty: 100,
    unit: "Tab",
    unitPrice: 8.5,
  },
  {
    id: 2,
    itemName: "Amoxicillin 500MG Cap",
    sku: "56712",
    qty: 50,
    unit: "Cap",
    unitPrice: 12.75,
  },
  {
    id: 3,
    itemName: "20CC Syringe (ANY BRAND)",
    sku: "2.02E+11",
    qty: 200,
    unit: "Pcs",
    unitPrice: 5.25,
  },
];

// --- Helpers -----------------------------------------------------------------

function fmtMoney(n: number) {
  return n.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function today() {
  return new Date().toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });
}

function genPONumber() {
  const d = new Date();
  const seq = String(Math.floor(Math.random() * 900) + 100);
  return "PO-" + d.getFullYear() + "-" + seq;
}

// --- Sub-components ----------------------------------------------------------

function SectionCard({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={"rounded-xl p-5 flex flex-col gap-4 " + className}
      style={{
        background: "#fff",
        border: "1px solid rgba(47,47,47,0.12)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
      }}
    >
      <div
        className="flex items-center gap-2 pb-1"
        style={{ borderBottom: "1.5px solid #e1e7f5" }}
      >
        <span
          className="font-bold"
          style={{ color: "#062d8c", fontSize: "14px" }}
        >
          {title}
        </span>
      </div>
      {children}
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-xs font-semibold" style={{ color: "#707070" }}>
      {children}
    </span>
  );
}

function ReadonlyField({ value }: { value: string }) {
  return (
    <div
      className="h-9 px-3 rounded-lg flex items-center text-sm"
      style={{
        background: "#f5f4f4",
        border: "1px solid #e0e0e0",
        color: "#001d63",
      }}
    >
      {value}
    </div>
  );
}

function SelectField({
  value,
  onChange,
  options,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 px-3 pr-8 rounded-lg text-sm appearance-none outline-none"
        style={{
          background: "#fff",
          border: "1px solid #dad8d8",
          color: value ? "#001d63" : "#aaa",
        }}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      <ChevronDown
        size={13}
        className="absolute right-2.5 top-2.75 pointer-events-none"
        style={{ color: "#062d8c" }}
      />
    </div>
  );
}

// --- Item selector dropdown inside table cell --------------------------------

function ItemSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (item: {
    itemName: string;
    sku: string;
    unit: string;
    unitPrice: number;
  }) => void;
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => {
          const found = CATALOG.find((c) => c.itemName === e.target.value);
          if (found) onChange(found);
        }}
        className="w-full h-8 px-2 pr-6 rounded text-xs appearance-none outline-none"
        style={{
          background: "#fff",
          border: "1px solid #dad8d8",
          color: "#001d63",
          minWidth: "180px",
        }}
      >
        <option value="">-- select item --</option>
        {CATALOG.map((c) => (
          <option key={c.sku} value={c.itemName}>
            {c.itemName}
          </option>
        ))}
      </select>
      <ChevronDown
        size={11}
        className="absolute right-1.5 top-2 pointer-events-none"
        style={{ color: "#062d8c" }}
      />
    </div>
  );
}

// --- Main Page ---------------------------------------------------------------

export default function AdminPurchaseOrder() {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // -- PO state --
  const [poNumber] = useState(genPONumber);
  const [poDate] = useState(today);
  const [refDoc, setRefDoc] = useState("REF-2026-001");
  const [attachedFile, setAttachedFile] = useState<string | null>(null);
  const [supplier, setSupplier] = useState("Norvic Drugs Corporation");
  const [deliverTo, setDeliverTo] = useState("BMC MAIN");
  const [expectedDate, setExpectedDate] = useState("04/30/2026");
  const [payTerm, setPayTerm] = useState<PayTerm>("COD");
  const [remarks, setRemarks] = useState("");
  const [lines, setLines] = useState<OrderLine[]>(INITIAL_LINES);
  const [nextId, setNextId] = useState(4);

  // -- Clock / network --
  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const h = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", h);
    window.addEventListener("offline", h);
    return () => {
      window.removeEventListener("online", h);
      window.removeEventListener("offline", h);
    };
  }, []);

  // -- Line item helpers --
  function addLine() {
    setLines((prev) => [
      ...prev,
      { id: nextId, itemName: "", sku: "", qty: 1, unit: "Pcs", unitPrice: 0 },
    ]);
    setNextId((n) => n + 1);
  }

  function removeLine(id: number) {
    setLines((prev) => prev.filter((l) => l.id !== id));
  }

  function updateLine(id: number, patch: Partial<OrderLine>) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  // -- Totals --
  const subtotal = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const tax = subtotal * 0.12;
  const total = subtotal + tax;

  // -- Input shared style --
  const inputCls = "w-full h-9 px-3 rounded-lg text-sm outline-none";
  const inputSty = {
    background: "#fff",
    border: "1px solid #dad8d8",
    color: "#001d63",
  } as React.CSSProperties;

  const colSty = { color: "#001d63", fontSize: "13px" } as React.CSSProperties;

  return (
    <div
      className="min-h-screen w-full overflow-y-auto overflow-x-hidden"
      style={{
        background: "linear-gradient(180deg, #062d8c 40%, #3266e6 100%)",
      }}
    >
      <AdminSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        activeItem="New Purchase Order"
        onNavigate={() => {}}
      />

      <div className="relative z-10 w-full max-w-450 mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 flex flex-col gap-5">
        {/* Header */}
        <AdminHeader
          onMenuClick={() => setSidebarOpen(true)}
          currentTime={currentTime}
          isOnline={isOnline}
        />

        {/* ================================================================
            Main Card
        ================================================================ */}
        <div
          className="rounded-2xl pb-6 flex flex-col gap-0"
          style={{
            background: "#f0f0f0",
            border: "1px solid rgba(47,47,47,0.68)",
            boxShadow: "0 0 50px 0px #062d8c",
          }}
        >
          {/* --- Top bar ------------------------------------------------- */}
          <div className="px-7 pt-6 pb-5">
            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 mb-3">
              <span
                className="text-xs font-semibold"
                style={{ color: "#5a7ab5" }}
              >
                Ordering and Deliveries
              </span>
              <ChevronRight size={13} style={{ color: "#5a7ab5" }} />
              <span
                className="text-xs font-semibold"
                style={{ color: "#062d8c" }}
              >
                Purchase Order
              </span>
            </div>

            {/* Title row */}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <h1
                  className="font-extrabold"
                  style={{ color: "#062d8c", fontSize: "22px" }}
                >
                  Create Purchase Order
                </h1>
                {/* PO Number badge */}
                <span
                  className="px-3 py-1 rounded-lg text-xs font-bold tracking-wider"
                  style={{ background: "#e1e7f5", color: "#062d8c" }}
                >
                  {poNumber}
                </span>
                {/* Draft badge */}
                <span
                  className="px-3 py-1 rounded-full text-xs font-bold"
                  style={{
                    background: "rgba(255,209,80,0.35)",
                    color: "#c89400",
                  }}
                >
                  DRAFT
                </span>
              </div>

              {/* Step indicators */}
              <div className="flex items-center gap-2">
                {["Details", "Items", "Review"].map((step, i) => (
                  <div key={step} className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{
                          background: i === 0 ? "#062d8c" : "#e1e7f5",
                          color: i === 0 ? "#fff" : "#9aabbf",
                        }}
                      >
                        {i + 1}
                      </div>
                      <span
                        className="text-xs font-semibold hidden sm:inline"
                        style={{ color: i === 0 ? "#062d8c" : "#9aabbf" }}
                      >
                        {step}
                      </span>
                    </div>
                    {i < 2 && (
                      <div
                        className="w-8 h-px"
                        style={{ background: "#c5d2e8" }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ---- Divider ---- */}
          <div
            className="mx-7"
            style={{ borderTop: "1px solid rgba(47,47,47,0.12)" }}
          />

          {/* ================================================================
              Form Body
          ================================================================ */}
          <div className="px-7 pt-5 flex flex-col gap-5">
            {/* Row 1 - 2 columns: Document Details | Delivery Details */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* ----- Document Details ----- */}
              <SectionCard title="Document Details">
                {/* PO Number (readonly) */}
                <div className="flex flex-col gap-1">
                  <FieldLabel>PO Number</FieldLabel>
                  <ReadonlyField value={poNumber} />
                </div>

                {/* PO Date (readonly) */}
                <div className="flex flex-col gap-1">
                  <FieldLabel>PO Date</FieldLabel>
                  <ReadonlyField value={poDate} />
                </div>

                {/* Reference Document # */}
                <div className="flex flex-col gap-1">
                  <FieldLabel>Reference Document #</FieldLabel>
                  <input
                    type="text"
                    value={refDoc}
                    onChange={(e) => setRefDoc(e.target.value)}
                    placeholder="e.g. REF-2026-001"
                    className={inputCls}
                    style={inputSty}
                  />
                </div>

                {/* Attach Document */}
                <div className="flex flex-col gap-1">
                  <FieldLabel>Attach Document</FieldLabel>
                  <label
                    className="flex flex-col items-center justify-center gap-2 rounded-xl cursor-pointer transition-colors py-5"
                    style={{
                      border: "2px dashed #c5d2e8",
                      background: "#f8faff",
                      color: "#5a7ab5",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLLabelElement).style.background =
                        "#eef3ff";
                      (e.currentTarget as HTMLLabelElement).style.borderColor =
                        "#062d8c";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLLabelElement).style.background =
                        "#f8faff";
                      (e.currentTarget as HTMLLabelElement).style.borderColor =
                        "#c5d2e8";
                    }}
                  >
                    <input
                      type="file"
                      className="hidden"
                      accept=".pdf,.doc,.docx,.jpg,.png"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setAttachedFile(file.name);
                      }}
                    />
                    {attachedFile ? (
                      <div className="flex items-center gap-2">
                        <FileText size={18} style={{ color: "#062d8c" }} />
                        <span
                          className="text-xs font-semibold"
                          style={{ color: "#062d8c" }}
                        >
                          {attachedFile}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setAttachedFile(null);
                          }}
                          className="hover:opacity-70"
                        >
                          <X size={13} style={{ color: "#f10000" }} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <Upload size={22} style={{ color: "#5a7ab5" }} />
                        <span className="text-xs font-semibold">
                          Click to upload or drag & drop
                        </span>
                        <span className="text-xs" style={{ color: "#9aabbf" }}>
                          PDF, DOC, DOCX, JPG, PNG
                        </span>
                      </>
                    )}
                  </label>
                </div>

                {/* Attached file chips (sample) */}
                <div className="flex flex-wrap gap-2">
                  {["PO-sample-ref.pdf", "Quotation.docx"].map((f) => (
                    <div
                      key={f}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg"
                      style={{
                        background: "#e1e7f5",
                        border: "1px solid #c5d2e8",
                      }}
                    >
                      <Paperclip size={11} style={{ color: "#062d8c" }} />
                      <span
                        className="text-xs font-semibold"
                        style={{ color: "#062d8c" }}
                      >
                        {f}
                      </span>
                    </div>
                  ))}
                </div>
              </SectionCard>

              {/* ----- Delivery Details ----- */}
              <SectionCard title="Delivery Details">
                {/* Select Supplier */}
                <div className="flex flex-col gap-1">
                  <FieldLabel>Select Supplier</FieldLabel>
                  <SelectField
                    value={supplier}
                    onChange={setSupplier}
                    options={SAMPLE_SUPPLIERS}
                    placeholder="-- choose supplier --"
                  />
                  {/* Supplier info pill */}
                  {supplier && (
                    <div
                      className="flex items-center gap-2 mt-1 px-3 py-2 rounded-lg"
                      style={{
                        background: "#f0f5ff",
                        border: "1px solid #c5d2e8",
                      }}
                    >
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                        style={{ background: "#062d8c" }}
                      >
                        <span
                          className="text-white font-bold"
                          style={{ fontSize: "10px" }}
                        >
                          {supplier.charAt(0)}
                        </span>
                      </div>
                      <div className="flex flex-col">
                        <span
                          className="text-xs font-bold"
                          style={{ color: "#001d63" }}
                        >
                          {supplier}
                        </span>
                        <span className="text-xs" style={{ color: "#9aabbf" }}>
                          Verified Supplier
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Deliver To */}
                <div className="flex flex-col gap-1">
                  <FieldLabel>Deliver To (Branch)</FieldLabel>
                  <SelectField
                    value={deliverTo}
                    onChange={setDeliverTo}
                    options={BRANCHES}
                    placeholder="-- select branch --"
                  />
                </div>

                {/* Expected Delivery Date */}
                <div className="flex flex-col gap-1">
                  <FieldLabel>Expected Delivery Date</FieldLabel>
                  <input
                    type="text"
                    value={expectedDate}
                    onChange={(e) => setExpectedDate(e.target.value)}
                    placeholder="MM/DD/YYYY"
                    className={inputCls}
                    style={inputSty}
                  />
                </div>

                {/* Remarks */}
                <div className="flex flex-col gap-1 flex-1">
                  <FieldLabel>Remarks / Notes</FieldLabel>
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Enter any special instructions or notes for this order..."
                    rows={4}
                    className="w-full px-3 py-2 rounded-lg text-sm outline-none resize-none"
                    style={{ ...inputSty, lineHeight: "1.5" }}
                  />
                </div>
              </SectionCard>
            </div>

            {/* ============================================================
                Payment Terms
            ============================================================ */}
            <SectionCard title="Payment Terms">
              <div className="flex flex-wrap gap-3">
                {PAY_TERMS.map((term) => {
                  const active = payTerm === term;
                  return (
                    <button
                      key={term}
                      onClick={() => setPayTerm(term)}
                      className="px-5 py-2.5 rounded-xl text-sm font-bold transition-all"
                      style={{
                        background: active ? "#062d8c" : "#fff",
                        color: active ? "#fff" : "#707070",
                        border: active
                          ? "1.5px solid #062d8c"
                          : "1.5px solid #dad8d8",
                        boxShadow: active
                          ? "0 4px 12px rgba(6,45,140,0.25)"
                          : "0 2px 4px rgba(0,0,0,0.06)",
                        transform: active ? "translateY(-1px)" : "none",
                      }}
                    >
                      {term}
                    </button>
                  );
                })}
              </div>
              {/* Term description */}
              <p className="text-xs" style={{ color: "#9aabbf" }}>
                {payTerm === "COD"
                  ? "Cash on Delivery: Payment is due upon receipt of goods."
                  : `Net ${payTerm}: Payment is due within ${payTerm.replace(" Days", "")} days from invoice date.`}
              </p>
            </SectionCard>

            {/* ============================================================
                Order Items
            ============================================================ */}
            <div
              className="rounded-xl flex flex-col gap-0"
              style={{
                background: "#fff",
                border: "1px solid rgba(47,47,47,0.12)",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              }}
            >
              {/* Items header */}
              <div
                className="px-5 py-4 flex items-center justify-between"
                style={{ borderBottom: "1.5px solid #e1e7f5" }}
              >
                <span
                  className="font-bold"
                  style={{ color: "#062d8c", fontSize: "14px" }}
                >
                  Order Items
                </span>
                <button
                  onClick={addLine}
                  className="flex items-center gap-1.5 h-8 px-4 rounded-xl text-xs font-bold text-white transition-opacity hover:opacity-90"
                  style={{
                    background: "#1536ef",
                    boxShadow: "0 4px 4px rgba(0,0,0,0.1)",
                  }}
                >
                  <Plus size={13} />
                  Add Item
                </button>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table
                  className="w-full text-sm border-collapse"
                  style={{ minWidth: "700px" }}
                >
                  <thead>
                    <tr
                      style={{
                        background: "#e1e7f5",
                        borderBottom: "1px solid #dbdee4",
                      }}
                    >
                      {[
                        "#",
                        "Item Name",
                        "SKU",
                        "Qty",
                        "Unit",
                        "Unit Price (PHP)",
                        "Amount (PHP)",
                        "",
                      ].map((h, i) => (
                        <th
                          key={i}
                          className={`px-3 py-2.5 font-semibold whitespace-nowrap ${i === 6 || i === 5 ? "text-right" : i === 7 ? "text-center" : "text-left"}`}
                          style={{ color: "#001d63", fontSize: "13px" }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lines.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="text-center py-10"
                          style={{ color: "#aaa" }}
                        >
                          No items added. Click "Add Item" to begin.
                        </td>
                      </tr>
                    ) : (
                      lines.map((line, idx) => {
                        const amount = line.qty * line.unitPrice;
                        return (
                          <tr
                            key={line.id}
                            style={{
                              background: idx % 2 === 0 ? "#f5f4f4" : "#e6e6e6",
                            }}
                          >
                            {/* # */}
                            <td
                              className="px-3 py-2 w-8 text-center"
                              style={{ color: "#9aabbf", fontSize: "12px" }}
                            >
                              {idx + 1}
                            </td>

                            {/* Item Name */}
                            <td
                              className="px-3 py-2"
                              style={{ minWidth: "200px" }}
                            >
                              {line.itemName ? (
                                <div className="flex items-center gap-2">
                                  <span style={colSty}>{line.itemName}</span>
                                  <button
                                    onClick={() =>
                                      updateLine(line.id, {
                                        itemName: "",
                                        sku: "",
                                        unit: "Pcs",
                                        unitPrice: 0,
                                      })
                                    }
                                    className="opacity-40 hover:opacity-80"
                                  >
                                    <X size={11} style={{ color: "#f10000" }} />
                                  </button>
                                </div>
                              ) : (
                                <ItemSelector
                                  value={line.itemName}
                                  onChange={(item) => updateLine(line.id, item)}
                                />
                              )}
                            </td>

                            {/* SKU */}
                            <td className="px-3 py-2 w-24" style={colSty}>
                              {line.sku || (
                                <span style={{ color: "#ccc" }}>---</span>
                              )}
                            </td>

                            {/* Qty */}
                            <td className="px-3 py-2 w-20">
                              <input
                                type="number"
                                value={line.qty}
                                min={1}
                                onChange={(e) =>
                                  updateLine(line.id, {
                                    qty: parseInt(e.target.value) || 1,
                                  })
                                }
                                className="w-16 h-7 px-2 rounded text-xs text-center outline-none"
                                style={{
                                  background: "#fff",
                                  border: "1px solid #dad8d8",
                                  color: "#001d63",
                                }}
                              />
                            </td>

                            {/* Unit */}
                            <td className="px-3 py-2 w-20" style={colSty}>
                              {line.unit || (
                                <span style={{ color: "#ccc" }}>---</span>
                              )}
                            </td>

                            {/* Unit Price */}
                            <td
                              className="px-3 py-2 w-28 text-right"
                              style={colSty}
                            >
                              {line.unitPrice > 0 ? (
                                fmtMoney(line.unitPrice)
                              ) : (
                                <span style={{ color: "#ccc" }}>---</span>
                              )}
                            </td>

                            {/* Amount */}
                            <td
                              className="px-3 py-2 w-28 text-right font-semibold"
                              style={{
                                color: amount > 0 ? "#001d63" : "#ccc",
                                fontSize: "13px",
                              }}
                            >
                              {amount > 0 ? fmtMoney(amount) : "---"}
                            </td>

                            {/* Delete */}
                            <td className="px-3 py-2 w-10 text-center">
                              <button
                                onClick={() => removeLine(line.id)}
                                className="hover:opacity-80 transition-opacity p-1 rounded"
                                style={{ color: "#f10000" }}
                                title="Remove line"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div
                className="flex justify-end px-5 py-4"
                style={{ borderTop: "1.5px solid #e1e7f5" }}
              >
                <div className="flex flex-col gap-1.5 min-w-60">
                  {/* Subtotal */}
                  <div className="flex items-center justify-between gap-8">
                    <span className="text-sm" style={{ color: "#707070" }}>
                      Subtotal
                    </span>
                    <span
                      className="text-sm font-semibold"
                      style={{ color: "#001d63" }}
                    >
                      PHP {fmtMoney(subtotal)}
                    </span>
                  </div>
                  {/* VAT */}
                  <div className="flex items-center justify-between gap-8">
                    <span className="text-sm" style={{ color: "#707070" }}>
                      VAT (12%)
                    </span>
                    <span
                      className="text-sm font-semibold"
                      style={{ color: "#001d63" }}
                    >
                      PHP {fmtMoney(tax)}
                    </span>
                  </div>
                  {/* Divider */}
                  <div
                    className="my-1"
                    style={{ borderTop: "1.5px solid #e1e7f5" }}
                  />
                  {/* Total */}
                  <div className="flex items-center justify-between gap-8">
                    <span
                      className="font-bold"
                      style={{ color: "#062d8c", fontSize: "14px" }}
                    >
                      Total
                    </span>
                    <span
                      className="font-extrabold"
                      style={{ color: "#062d8c", fontSize: "16px" }}
                    >
                      PHP {fmtMoney(total)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ============================================================
                Footer Action Buttons
            ============================================================ */}
            <div className="flex items-center justify-between flex-wrap gap-3 pt-1 pb-1">
              {/* Left: order summary */}
              <p className="text-xs" style={{ color: "#9aabbf" }}>
                {lines.length} line item{lines.length !== 1 ? "s" : ""} &middot;
                Pay term: {payTerm} &middot; Deliver to: {deliverTo}
              </p>

              {/* Right: action buttons */}
              <div className="flex items-center gap-3">
                {/* Cancel */}
                <button
                  onClick={() => navigate("/")}
                  className="h-10 px-5 rounded-xl text-sm font-bold transition-opacity hover:opacity-80"
                  style={{
                    background: "#efefef",
                    color: "#0b0b0b",
                    border: "1px solid #dad8d8",
                    boxShadow: "0 4px 4px rgba(0,0,0,0.08)",
                  }}
                >
                  Cancel
                </button>

                {/* Save as Draft */}
                <button
                  className="flex items-center gap-2 h-10 px-5 rounded-xl text-sm font-bold transition-opacity hover:opacity-80"
                  style={{
                    background: "#f2f2f2",
                    color: "#5f5f5f",
                    border: "1px solid #dad8d8",
                    boxShadow: "0 4px 4px rgba(0,0,0,0.08)",
                  }}
                >
                  <Save size={14} />
                  Save as Draft
                </button>

                {/* Submit Order */}
                <button
                  className="flex items-center gap-2 h-10 px-5 rounded-xl text-sm font-bold text-white transition-opacity hover:opacity-90"
                  style={{
                    background: "#1536ef",
                    boxShadow: "0 4px 12px rgba(21,54,239,0.3)",
                  }}
                >
                  <Send size={14} />
                  Submit Order
                </button>
              </div>
            </div>
          </div>
          {/* end form body */}
        </div>
        {/* end main card */}

        {/* Footer */}
        <div
          className="text-center pb-4"
          style={{ color: "rgba(255,255,255,0.3)", fontSize: "12px" }}
        >
          Knopper POS Admin Dashboard &middot; {new Date().getFullYear()}
        </div>
      </div>
    </div>
  );
}
