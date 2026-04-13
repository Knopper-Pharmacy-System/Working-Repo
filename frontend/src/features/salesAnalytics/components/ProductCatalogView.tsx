import { useEffect, useMemo, useState } from "react";
import { Search, ChevronLeft, ChevronRight } from "lucide-react";
import { useSalesAnalyticsStore } from "../store/useSalesAnalyticsStore";
import { MANAGER_INPUT_STYLE, MANAGER_PANEL_SOFT_STYLE, MANAGER_PANEL_STYLE } from "./theme";

const money = (value: number) =>
  value.toLocaleString("en-PH", { maximumFractionDigits: 2, minimumFractionDigits: 2 });

const ROWS_PER_PAGE = 50;

const getPageWindow = (currentPage: number, totalPages: number) => {
  const windowSize = 2;
  const pages = new Set<number>();

  pages.add(1);
  pages.add(totalPages);

  for (let page = currentPage - windowSize; page <= currentPage + windowSize; page += 1) {
    if (page >= 1 && page <= totalPages) {
      pages.add(page);
    }
  }

  return Array.from(pages).sort((a, b) => a - b);
};

export default function ProductCatalogView() {
  const productRows = useSalesAnalyticsStore((state) => state.productRows);
  const selectedBranch = useSalesAnalyticsStore((state) => state.selectedBranch);

  const [query, setQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  const departments = useMemo(() => {
    return Array.from(new Set(productRows.map((row) => row.department).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b),
    );
  }, [productRows]);

  const categories = useMemo(() => {
    return Array.from(new Set(productRows.map((row) => row.category).filter(Boolean))).sort((a, b) =>
      a.localeCompare(b),
    );
  }, [productRows]);

  const filteredRows = useMemo(() => {
    const keyword = query.trim().toLowerCase();

    return productRows.filter((row) => {
      const searchableText = [row.itemCode, row.barcode, row.description, row.department, row.category]
        .join(" ")
        .toLowerCase();

      const matchesSearch = !keyword || searchableText.includes(keyword);
      const matchesDepartment = departmentFilter === "all" || row.department === departmentFilter;
      const matchesCategory = categoryFilter === "all" || row.category === categoryFilter;

      return matchesSearch && matchesDepartment && matchesCategory;
    });
  }, [productRows, query, departmentFilter, categoryFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / ROWS_PER_PAGE));

  useEffect(() => {
    setCurrentPage(1);
  }, [query, departmentFilter, categoryFilter, selectedBranch]);

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages));
  }, [totalPages]);

  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * ROWS_PER_PAGE;
    return filteredRows.slice(start, start + ROWS_PER_PAGE);
  }, [filteredRows, currentPage]);

  const pageWindow = useMemo(() => getPageWindow(currentPage, totalPages), [currentPage, totalPages]);
  const startRow = filteredRows.length === 0 ? 0 : (currentPage - 1) * ROWS_PER_PAGE + 1;
  const endRow = Math.min(filteredRows.length, currentPage * ROWS_PER_PAGE);

  if (!productRows.length) {
    return (
      <section className="rounded-2xl p-6" style={MANAGER_PANEL_STYLE}>
        <h3 className="text-lg font-bold text-slate-900">Product Catalog</h3>
        <p className="mt-2 text-sm text-slate-600">
          Upload Product Details / Master List to view and search your catalog here.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-blue-200 bg-blue-50/50 p-4 shadow-sm" style={MANAGER_PANEL_SOFT_STYLE}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            Catalog records
          </p>
          <p className="text-xs text-slate-600">
            {filteredRows.length.toLocaleString("en-PH")} matching rows • Branch: {selectedBranch}
          </p>
        </div>

        <label className="relative w-full max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search Item Code, Description, Barcode, or Department"
            className="w-full rounded-xl py-2 pl-9 pr-3 text-sm outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-blue-300"
            style={MANAGER_INPUT_STYLE}
          />
        </label>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Department</span>
          <select
            value={departmentFilter}
            onChange={(event) => setDepartmentFilter(event.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-1 ring-transparent focus:ring-2 focus:ring-blue-300"
          >
            <option value="all">All Departments</option>
            {departments.map((department) => (
              <option key={department} value={department}>
                {department}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">Category</span>
          <select
            value={categoryFilter}
            onChange={(event) => setCategoryFilter(event.target.value)}
            className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 outline-none ring-1 ring-transparent focus:ring-2 focus:ring-blue-300"
          >
            <option value="all">All Categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </select>
        </label>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
          Page {currentPage} of {totalPages}
        </div>
      </div>

      <div className="mt-4 overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full table-fixed divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="w-[18%] px-3 py-3 text-left font-semibold text-slate-700">Item Code</th>
              <th className="w-[32%] px-3 py-3 text-left font-semibold text-slate-700">Description</th>
              <th className="w-[16%] px-3 py-3 text-left font-semibold text-slate-700">Category</th>
              <th className="w-[12%] px-3 py-3 text-right font-semibold text-slate-700">SRP</th>
              <th className="w-[12%] px-3 py-3 text-right font-semibold text-slate-700">Cost</th>
              <th className="w-[10%] px-3 py-3 text-right font-semibold text-slate-700">Reorder</th>
              <th className="w-[10%] px-3 py-3 text-right font-semibold text-slate-700">Stock</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {paginatedRows.length > 0 ? (
              paginatedRows.map((row, index) => (
                <tr key={`${row.itemCode}-${row.barcode}-${currentPage}-${index}`} className="transition hover:bg-blue-50/50">
                  <td className="px-3 py-3 align-top font-medium text-slate-900">{row.itemCode || "-"}</td>
                  <td className="px-3 py-3 align-top text-slate-700">
                    <div className="max-w-full truncate">{row.description || "-"}</div>
                    <div className="mt-1 truncate text-xs text-slate-500">Barcode: {row.barcode || "-"}</div>
                  </td>
                  <td className="px-3 py-3 align-top text-slate-600">{row.category || "-"}</td>
                  <td className="px-3 py-3 align-top text-right text-slate-700">{money(row.price)}</td>
                  <td className="px-3 py-3 align-top text-right text-slate-700">{money(row.cost)}</td>
                  <td className="px-3 py-3 align-top text-right text-slate-700">{row.reorderPoint.toLocaleString("en-PH")}</td>
                  <td className="px-3 py-3 align-top text-right text-slate-700">{row.currentStock.toLocaleString("en-PH")}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td className="px-4 py-8 text-center text-slate-500" colSpan={7}>
                  No catalog rows match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-600">
          Showing {startRow} to {endRow} of {filteredRows.length.toLocaleString("en-PH")} rows
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            disabled={currentPage === 1}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronLeft size={16} />
            Prev
          </button>

          <div className="flex flex-wrap items-center gap-2">
            {pageWindow.map((page, index) => {
              const previous = pageWindow[index - 1];
              const gap = index > 0 && previous !== undefined && page - previous > 1;

              return (
                <div key={page} className="flex items-center gap-2">
                  {gap ? <span className="px-1 text-slate-400">...</span> : null}
                  <button
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`min-w-10 rounded-xl px-3 py-2 text-sm font-semibold transition ${
                      page === currentPage
                        ? "bg-[#1E40AF] text-white shadow-sm"
                        : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {page}
                  </button>
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
            disabled={currentPage === totalPages}
            className="inline-flex items-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}
