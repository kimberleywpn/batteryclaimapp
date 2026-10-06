import { useEffect, useMemo, useState } from "react";
import { Alert, DatePicker, Empty, Segmented, Spin, Statistic, Table, Tooltip } from "antd";
import { Download, Info } from "lucide-react";
import dayjs from "dayjs";
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ResponsiveContainer, Tooltip as ChartTooltip, XAxis, YAxis } from "recharts";
import { api } from "../api";
import { AppButton, AppPagination, CheckFilter, SearchInput } from "../components/AppControls";
import { brandName, stageLabel, titleCase } from "../utils/claimFormatting";

const { RangePicker } = DatePicker;
const dateValue = (value) => (value ? dayjs(value) : null);
const claimSettleDate = (claim) => claim.admin?.settleDate || claim.settleDate || "";
const daysSinceReport = (claim, today = dayjs()) => {
  const reportDate = dayjs(claim.claimDate);
  return reportDate.isValid()
    ? Math.max(0, today.startOf("day").diff(reportDate.startOf("day"), "day"))
    : null;
};

const dashboardExportColumns = [
  ["Case ID", "id"],
  ["Report Date", "claimDate"],
  ["Days Since Report", "daysSinceReport"],
  ["Stage", "status"],
  ["Process Result", "result"],
  ["Dealer", "dealer"],
  ["Branch Code", "branchCode"],
  ["Sales Agent", "salesperson"],
  ["Brand", "brand"],
  ["Battery Model", "model"],
  ["Serial Number", "serial"],
  ["Customer", "customer"],
  ["Battery Batch / Code", "batchCode"],
  ["Production Date", "productDate"],
  ["Factory", "factory"],
  ["First Test Date", "firstTestDate"],
  ["Pre-charge OCV (V)", "preOcv"],
  ["Pre-charge CCA", "preCca"],
  ["Pre-charge Result", "preResult"],
  ["Second Test Date", "secondTestDate"],
  ["After-charge OCV (V)", "postOcv"],
  ["After-charge CCA", "postCca"],
  ["After-charge Result", "postResult"],
  ["WAN No.", "wanNo"],
  ["Replacement Item", "replaceItem"],
  ["Replacement Serial No.", "replaceSerialNo"],
  ["Settle Date", "settleDate"],
];

const exportRow = (claim) => {
  const warehouse = claim.warehouse || {};
  const admin = claim.admin || {};
  const days = daysSinceReport(claim);
  return {
    id: claim.id || "",
    claimDate: claim.claimDate || "",
    daysSinceReport: days === null ? "" : days,
    status: stageLabel(claim.status),
    result: admin.result || "",
    dealer: claim.dealerName || claim.customer || "",
    branchCode: claim.branchName || "",
    salesperson: claim.salesperson || "",
    brand: brandName(claim.itemGroup),
    model: claim.model || "",
    serial: claim.serial || "",
    customer: claim.customer || "",
    batchCode: warehouse.batchCode || "",
    productDate: warehouse.productDate || "",
    factory: warehouse.factory || "",
    firstTestDate: warehouse.firstTestDate || "",
    preOcv: warehouse.preOcv || "",
    preCca: warehouse.preCca || "",
    preResult: warehouse.preResult || "",
    secondTestDate: warehouse.secondTestDate || "",
    postOcv: warehouse.postOcv || "",
    postCca: warehouse.postCca || "",
    postResult: warehouse.postResult || warehouse.result || "",
    wanNo: admin.wanNo || "",
    replaceItem: admin.replaceItem || admin.replaceBrand || "",
    replaceSerialNo: admin.replaceSerialNo || "",
    settleDate: admin.settleDate || claim.settleDate || "",
  };
};

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function downloadDashboardExport(claims, summaryRows) {
  const XLSX = await import("xlsx");
  const rows = claims.map(exportRow);
  const caseSheet = XLSX.utils.aoa_to_sheet([
    dashboardExportColumns.map(([label]) => label),
    ...rows.map((row) => dashboardExportColumns.map(([, key]) => row[key])),
  ]);
  caseSheet["!autofilter"] = { ref: caseSheet["!ref"] };
  caseSheet["!cols"] = dashboardExportColumns.map(([label, key]) => ({
    wch: Math.min(
      28,
      Math.max(label.length + 2, ...rows.slice(0, 250).map((row) => String(row[key] || "").length + 2)),
    ),
  }));
  const summarySheet = XLSX.utils.aoa_to_sheet([
    ["Management Dashboard Export", ""],
    ...summaryRows,
  ]);
  summarySheet["!cols"] = [{ wch: 25 }, { wch: 42 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");
  XLSX.utils.book_append_sheet(workbook, caseSheet, "Cases");
  downloadBlob(
    new Blob([XLSX.write(workbook, { bookType: "xlsx", type: "array" })], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    `battery-claims-dashboard-${dayjs().format("DD-MM-YYYY")}.xlsx`,
  );
}

const localDay = (date) => {
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60000).toISOString().slice(0, 10);
};
function periodDates(period) {
  const now = new Date();
  let start;
  if (period === "Daily") start = now;
  else if (period === "Weekly") {
    start = new Date(now);
    const day = start.getDay();
    start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
  } else if (period === "Quarterly") {
    start = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  } else if (period === "Yearly") start = new Date(now.getFullYear(), 0, 1);
  else start = new Date(now.getFullYear(), now.getMonth(), 1);
  return [localDay(start), localDay(now)];
}
function dealerTree(records) {
  const groups = new Map();
  for (const row of records) {
    const dealer = row.dealerName || row.customer || "Not Recorded",
      branch = row.branchName || "";
    if (!groups.has(dealer)) groups.set(dealer, new Map());
    groups.get(dealer).set(branch, `${dealer}|${branch}`);
  }
  return [...groups]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dealer, branches]) =>
      branches.size === 1 && branches.has("")
        ? { label: dealer, value: branches.get("") }
        : {
            label: dealer,
            value: `dealer:${dealer}`,
            children: [...branches]
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([branch, value]) => ({
                label: branch || "No Branch",
                value,
              })),
          },
    );
}
const flatOptions = (values) =>
  [...new Set(values.filter(Boolean))]
    .sort()
    .map((value) => ({ label: value, value }));
export default function ManagementDashboard({ claims, session, CasePreviewComponent }) {
  const initial = periodDates("Monthly");
  const [from, setFrom] = useState(initial[0]);
  const [to, setTo] = useState(initial[1]);
  const [period, setPeriod] = useState("Monthly");
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dealers, setDealers] = useState([]);
  const [agents, setAgents] = useState([]);
  const [brands, setBrands] = useState([]);
  const [results, setResults] = useState(["Compensation Of Claims"]);
  const [sort, setSort] = useState({ key: "quantity", direction: "desc" });
  const [salesPage, setSalesPage] = useState(1);
  const [casePage, setCasePage] = useState(1);
  const [selection, setSelection] = useState(null);
  const [preview, setPreview] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const salesUser = session.role === "sales";
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    api(
      `/api/dashboard-sales?${new URLSearchParams({ from, to, customer: "", agent: "" })}`,
    )
      .then((data) => {
        if (active) setSales(data.records || []);
      })
      .catch((err) => active && setError(err.message))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [from, to]);
  const allDealerRecords = useMemo(
    () => [...claims, ...sales],
    [claims, sales],
  );
  const dealerOptions = useMemo(
    () => dealerTree(allDealerRecords),
    [allDealerRecords],
  );
  const agentOptions = useMemo(
    () =>
      flatOptions([
        ...claims.map((c) => c.salesperson),
        ...sales.map((r) => r.salesperson),
      ]),
    [claims, sales],
  );
  const brandOptions = useMemo(
    () =>
      flatOptions([
        ...claims.map((c) => brandName(c.itemGroup)),
        ...sales.map((r) => brandName(r.itemGroup)),
      ]),
    [claims, sales],
  );
  const resultOptions = useMemo(
    () =>
      flatOptions(
        claims.map((c) => titleCase(c.admin?.result) || "Not Recorded"),
      ),
    [claims],
  );
  const dealerKey = (row) =>
    `${row.dealerName || row.customer || "Not Recorded"}|${row.branchName || ""}`;
  const matches = (row) =>
    (!dealers.length || dealers.includes(dealerKey(row))) &&
    (!agents.length || agents.includes(row.salesperson || "Not Recorded")) &&
    (!brands.length || brands.includes(brandName(row.itemGroup)));
  const dashboardClaims = useMemo(
    () =>
      claims.filter(
        (c) => {
          const settleDate = claimSettleDate(c);
          return (
            settleDate &&
            (!from || settleDate >= from) &&
            (!to || settleDate <= to) &&
            matches(c)
          );
        },
      ),
    [claims, from, to, dealers, agents, brands],
  );
  const filteredClaims = useMemo(
    () =>
      dashboardClaims.filter(
        (c) =>
          (!results.length ||
            results.includes(titleCase(c.admin?.result) || "Not Recorded")),
      ),
    [dashboardClaims, results],
  );
  const ageingClaims = useMemo(
    () =>
      claims.filter(
        (claim) =>
          !["complete", "cancelled"].includes(claim.status) &&
          matches(claim) &&
          daysSinceReport(claim) !== null,
      ),
    [claims, dealers, agents, brands],
  );
  const ageing = useMemo(
    () => ({
      current: ageingClaims.filter((claim) => daysSinceReport(claim) <= 14),
      warning: ageingClaims.filter((claim) => {
        const days = daysSinceReport(claim);
        return days > 14 && days <= 21;
      }),
      critical: ageingClaims.filter((claim) => daysSinceReport(claim) > 21),
    }),
    [ageingClaims],
  );
  const completed = filteredClaims.filter((c) => c.status === "complete");
  const filteredSales = sales.filter(matches);
  const salesRows = useMemo(() => {
    const models = new Map();
    for (const row of filteredSales) {
      const model = row.model || "Not Recorded";
      const item = models.get(model) || {
        model,
        quantity: 0,
        claims: 0,
        rate: null,
      };
      item.quantity += Number(row.netQuantity || 0);
      models.set(model, item);
    }
    for (const claim of completed) {
      const model = claim.model || "Not Recorded";
      const item = models.get(model) || {
        model,
        quantity: 0,
        claims: 0,
        rate: null,
      };
      item.claims++;
      models.set(model, item);
    }
    for (const item of models.values())
      item.rate = item.quantity > 0 ? item.claims / item.quantity : null;
    const direction = sort.direction === "asc" ? 1 : -1;
    return [...models.values()].sort((a, b) => {
      const av = a[sort.key],
        bv = b[sort.key];
      return (
        (typeof av === "string"
          ? av.localeCompare(bv)
          : (av ?? -Infinity) - (bv ?? -Infinity)) * direction
      );
    });
  }, [filteredSales, completed, sort]);
  const netSales = filteredSales.reduce(
      (sum, row) => sum + Number(row.netQuantity || 0),
      0,
    ),
    claimRate =
      netSales > 0
        ? `${((completed.length / netSales) * 100).toFixed(2)}%`
        : "N/A";
  const trendData = useMemo(() => {
    const days = Math.max(1, dayjs(to).diff(dayjs(from), "day") + 1);
    const daily = days <= 45;
    const buckets = new Map();
    const add = (date, key, amount) => {
      if (!date) return;
      const parsed = dayjs(String(date).slice(0, 10));
      if (!parsed.isValid()) return;
      const bucket = daily
        ? parsed.format("YYYY-MM-DD")
        : parsed.startOf("month").format("YYYY-MM-DD");
      const item = buckets.get(bucket) || { bucket, sales: 0, claims: 0 };
      item[key] += amount;
      buckets.set(bucket, item);
    };
    for (const row of filteredSales)
      add(row.activityDate, "sales", Number(row.netQuantity || 0));
    for (const claim of completed) add(claimSettleDate(claim), "claims", 1);
    return [...buckets.values()]
      .sort((a, b) => a.bucket.localeCompare(b.bucket))
      .map((item) => ({
        ...item,
        label: dayjs(item.bucket).format(daily ? "D MMM" : "MMM YY"),
        rate: item.sales > 0 ? Number(((item.claims / item.sales) * 100).toFixed(2)) : 0,
      }));
  }, [filteredSales, completed, from, to]);
  const resultChartData = useMemo(() => {
    const counts = new Map();
    for (const claim of dashboardClaims.filter((c) => c.status === "complete")) {
      const name = titleCase(claim.admin?.result) || "Not Recorded";
      const quantity = Number(claim.quantity ?? claim.claimQuantity ?? claim.admin?.claimQuantity ?? 1);
      counts.set(name, (counts.get(name) || 0) + (Number.isFinite(quantity) && quantity > 0 ? quantity : 1));
    }
    return [...counts]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [dashboardClaims]);
  const claimQtyByModelData = useMemo(() => {
    const counts = new Map();
    for (const claim of dashboardClaims.filter((c) => c.status === "complete")) {
      const model = claim.batteryModel || claim.model || claim.itemDescription || "Not Recorded";
      const quantity = Number(claim.quantity ?? claim.claimQuantity ?? claim.admin?.claimQuantity ?? 1);
      counts.set(model, (counts.get(model) || 0) + (Number.isFinite(quantity) && quantity > 0 ? quantity : 1));
    }
    return [...counts]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 6);
  }, [dashboardClaims]);
  const modelChartData = useMemo(
    () =>
      [...salesRows]
        .filter((row) => row.quantity > 0)
        .sort((a, b) => (b.rate || 0) - (a.rate || 0))
        .slice(0, 8)
        .map((row) => ({
          model: row.model,
          rate: Number(((row.rate || 0) * 100).toFixed(2)),
          claims: row.claims,
          sales: row.quantity,
        })),
    [salesRows],
  );
  const resultColors = [
    "var(--sky-blue-light)",
    "var(--light-caramel)",
    "var(--dry-sage)",
    "var(--dusty-mauve)",
    "var(--apricot-cream)",
    "var(--soft-blush)",
    "var(--charcoal-blue)",
  ];
  const breakdowns = salesUser
    ? [
        ["Result", "result"],
        ["Dealer Claim Quantity", "dealer"],
        ["Brand", "brand"],
        ["Battery Model", "model"],
      ]
    : [
        ["Result", "result"],
        ["Dealer", "dealer"],
        ["Sales Agent", "salesperson"],
        ["Brand", "brand"],
        ["Battery Model", "model"],
      ];
  const claimValue = (claim, key) =>
    key === "result"
      ? titleCase(claim.admin?.result) || "Not Recorded"
      : key === "dealer"
        ? claim.dealerName || claim.customer || "Not Recorded"
        : key === "brand"
          ? brandName(claim.itemGroup)
          : claim[key] || "Not Recorded";
  const selectedClaims =
    selection?.type === "ageing"
      ? ageing[selection.bucket]
      : filteredClaims.filter(
          (c) => !selection || claimValue(c, selection.key) === selection.value,
        );
  const exportCases = async () => {
    setExportError("");
    setExporting(true);
    try {
      const ageingLabel =
        selection?.type === "ageing"
          ? selection.bucket === "critical"
            ? "Over 21 Days"
            : selection.bucket === "warning"
              ? "15-21 Days"
              : "Within 14 Days"
          : "All Matching Cases";
      await downloadDashboardExport(selectedClaims, [
        ["Exported Cases", selectedClaims.length],
        ["Report Period", `${from || "Any"} to ${to || "Any"}`],
        ["Case Selection", ageingLabel],
        ["Generated", dayjs().format("DD-MM-YYYY HH:mm")],
      ]);
    } catch (exportFailure) {
      setExportError(exportFailure.message || "The Excel export could not be created.");
    } finally {
      setExporting(false);
    }
  };
  const visibleSales = salesRows.slice((salesPage - 1) * 10, salesPage * 10),
    visibleCases = selectedClaims.slice((casePage - 1) * 10, casePage * 10);
  useEffect(() => {
    setSalesPage(1);
    setCasePage(1);
    setSelection(null);
  }, [from, to, dealers, agents, brands, results]);
  const setQuick = (value) => {
    const dates = periodDates(value);
    setFrom(dates[0]);
    setTo(dates[1]);
    setPeriod(value);
  };
  const clear = () => {
    setDealers([]);
    setAgents([]);
    setBrands([]);
    setResults([]);
  };
  const sortOrder = (key) =>
    sort.key === key ? (sort.direction === "asc" ? "ascend" : "descend") : null;
  const salesColumns = [
    {
      title: "Battery Model",
      dataIndex: "model",
      key: "model",
      sorter: (a, b) => a.model.localeCompare(b.model),
      sortOrder: sortOrder("model"),
    },
    {
      title: "Sales Quantity",
      dataIndex: "quantity",
      key: "quantity",
      sorter: (a, b) => a.quantity - b.quantity,
      sortOrder: sortOrder("quantity"),
      render: (value) => value.toLocaleString(),
    },
    {
      title: "Claims",
      dataIndex: "claims",
      key: "claims",
      sorter: (a, b) => a.claims - b.claims,
      sortOrder: sortOrder("claims"),
    },
    {
      title: "Claim Rate",
      dataIndex: "rate",
      key: "rate",
      sorter: (a, b) => (a.rate ?? -Infinity) - (b.rate ?? -Infinity),
      sortOrder: sortOrder("rate"),
      render: (value) =>
        value === null ? "N/A" : `${(value * 100).toFixed(2)}%`,
    },
  ];
  const caseColumns = [
    {
      title: "Serial Number",
      dataIndex: "serial",
      render: (value, claim) => (
        <AppButton className="serial-link" onClick={() => setPreview(claim)}>
          {value}
        </AppButton>
      ),
    },
    {
      title: "Dealer / Branch",
      render: (_, claim) => (
        <>
          {claim.dealerName || claim.customer || "Not Recorded"}
          {claim.branchName && (
            <small className="branch-code">{claim.branchName}</small>
          )}
        </>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      render: (value) => stageLabel(value),
    },
    {
      title: "Days Since Report",
      key: "ageing",
      render: (_, claim) => {
        const days = daysSinceReport(claim);
        return days === null ? "Not Recorded" : `${days} day${days === 1 ? "" : "s"}`;
      },
    },
  ];
  return (
    <>
      <section className="dashboard-period">
        <RangePicker
          value={[dateValue(from), dateValue(to)]}
          onChange={(dates) => {
            setFrom(dates?.[0]?.format("YYYY-MM-DD") || "");
            setTo(dates?.[1]?.format("YYYY-MM-DD") || "");
            setPeriod("");
          }}
          format="DD-MM-YYYY"
          allowClear={false}
        />
        <Segmented
          className="dashboard-period-segmented"
          options={["Daily", "Weekly", "Monthly", "Quarterly", "Yearly"]}
          value={period || undefined}
          onChange={setQuick}
        />
      </section>
      <section className="dashboard-filters-react">
        <CheckFilter
          label="Dealer / Branch"
          options={dealerOptions}
          selected={dealers}
          onChange={setDealers}
          selectAll
        />
        {!salesUser && (
          <CheckFilter
            label="Sales Agent"
            options={agentOptions}
            selected={agents}
            onChange={setAgents}
            selectAll
          />
        )}
        <CheckFilter
          label="Brand"
          options={brandOptions}
          selected={brands}
          onChange={setBrands}
          selectAll
        />
        <CheckFilter
          label="Process Result"
          options={resultOptions}
          selected={results}
          onChange={setResults}
          selectAll
        />
        <AppButton className="clear-action" onClick={clear}>
          Clear Filters
        </AppButton>
      </section>
      {error && (
        <Alert className="app-alert" type="error" showIcon message={error} />
      )}
      {exportError && (
        <Alert className="app-alert" type="error" showIcon message={exportError} />
      )}
      {!loading && !error && (
        <section className="dashboard-visuals">
          <article className="surface dashboard-chart dashboard-trend-chart">
            <div className="section-title">
              <div>
                <h2>Sales And Claims Trend</h2>
                <p>Net sales, completed claims and claim rate by period</p>
              </div>
            </div>
            {trendData.length ? (
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={trendData} margin={{ top: 12, right: 12, bottom: 0, left: -12 }}>
                  <CartesianGrid stroke="var(--ash-grey)" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
                  <YAxis yAxisId="count" tickLine={false} axisLine={false} fontSize={11} />
                  <YAxis yAxisId="rate" orientation="right" tickFormatter={(value) => `${value}%`} tickLine={false} axisLine={false} fontSize={11} />
                  <ChartTooltip contentStyle={{ background: "var(--chart-tooltip-bg)", borderColor: "var(--ash-grey)", borderRadius: 5 }} formatter={(value, name) => [name === "Claim Rate" ? `${value}%` : Number(value).toLocaleString(), name]} />
                  <Legend />
                  <Bar yAxisId="count" dataKey="sales" name="Net Sales" fill="var(--sky-blue-light)" radius={[3, 3, 0, 0]} maxBarSize={34} />
                  <Line yAxisId="count" type="monotone" dataKey="claims" name="Claims" stroke="var(--light-caramel)" strokeWidth={2.5} dot={{ r: 3 }} />
                  <Line yAxisId="rate" type="monotone" dataKey="rate" name="Claim Rate" stroke="var(--dusty-mauve)" strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No Trend Data" />
            )}
          </article>
          <article className="surface dashboard-chart dashboard-result-chart">
            <div className="section-title">
              <div>
                <h2>Claim Quantity By Model</h2>
                <p>Top models by claim quantity</p>
              </div>
            </div>
            {claimQtyByModelData.length ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={claimQtyByModelData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={92} paddingAngle={2}>
                    {claimQtyByModelData.map((item, index) => (
                      <Cell key={item.name} fill={resultColors[index % resultColors.length]} />
                    ))}
                  </Pie>
                  <ChartTooltip contentStyle={{ background: "var(--chart-tooltip-bg)", borderColor: "var(--ash-grey)", borderRadius: 5 }} formatter={(value) => [Number(value).toLocaleString(), "Claim Quantity"]} />
                  <Legend iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No Claim Data" />
            )}
          </article>
          <article className="surface dashboard-chart dashboard-model-chart">
            <div className="section-title">
              <div>
                <h2>Highest Claim Rate By Model</h2>
                <p>Top models with recorded sales, ranked by claim rate</p>
              </div>
            </div>
            {modelChartData.length ? (
              <ResponsiveContainer width="100%" height={Math.max(260, modelChartData.length * 42)}>
                <BarChart data={modelChartData} layout="vertical" margin={{ top: 4, right: 28, bottom: 0, left: 10 }}>
                  <CartesianGrid stroke="var(--ash-grey)" horizontal={false} />
                  <XAxis type="number" tickFormatter={(value) => `${value}%`} tickLine={false} axisLine={false} fontSize={11} />
                  <YAxis type="category" dataKey="model" width={150} tickLine={false} axisLine={false} fontSize={11} />
                  <ChartTooltip contentStyle={{ background: "var(--chart-tooltip-bg)", borderColor: "var(--ash-grey)", borderRadius: 5 }} formatter={(value, name, item) => [`${value}% (${item.payload.claims} claims / ${Number(item.payload.sales).toLocaleString()} sales)`, "Claim Rate"]} />
                  <Bar dataKey="rate" name="Claim Rate" fill="var(--dry-sage)" radius={[0, 3, 3, 0]} maxBarSize={22} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No Model Data" />
            )}
          </article>
        </section>
      )}
      <section className="surface dashboard-ageing">
        <div className="section-title">
          <div>
            <h2>Active Case Ageing</h2>
            <p>Days since report date. Dealer, agent and brand filters apply.</p>
          </div>
        </div>
        <div className="ageing-cards">
          {[
            ["current", "Within 14 Days", "current"],
            ["warning", "15-21 Days", "warning"],
            ["critical", "Over 21 Days", "critical"],
          ].map(([bucket, label, tone]) => (
            <button
              type="button"
              className={`ageing-card ${tone}${selection?.type === "ageing" && selection.bucket === bucket ? " active" : ""}`}
              key={bucket}
              onClick={() => {
                setSelection({ type: "ageing", bucket });
                setCasePage(1);
              }}
            >
              <strong>{ageing[bucket].length.toLocaleString()}</strong>
              <span>{label}</span>
              <small>View Cases</small>
            </button>
          ))}
        </div>
      </section>
      <section className="surface dashboard-sales">
        <div className="section-title">
          <h2>Battery Sales &amp; Claim Rate</h2>
          <Tooltip title="Sales use invoice date; claims use settle date. Valid credit notes reduce sales in the period the credit note was issued. Cancelled documents are excluded. Repeat claims count separately.">
            <Info size={17} />
          </Tooltip>
        </div>
        <div className="dashboard-summary">
          <strong>Sales Quantity: {netSales.toLocaleString()}</strong>
          <span>Completed Claims: {completed.length.toLocaleString()}</span>
          <strong>Period Claim Rate: {claimRate}</strong>
        </div>
        {loading ? (
          <Spin description="Loading AutoCount Sales...">
            <div className="loading-block" />
          </Spin>
        ) : (
          <div className="dashboard-table ant-dashboard-table">
            <Table
              columns={salesColumns}
              dataSource={visibleSales}
              rowKey="model"
              pagination={false}
              sortDirections={["ascend", "descend", "ascend"]}
              onChange={(_, __, sorter) => {
                if (
                  !Array.isArray(sorter) &&
                  sorter.columnKey &&
                  sorter.order
                ) {
                  setSort({
                    key: sorter.columnKey,
                    direction: sorter.order === "ascend" ? "asc" : "desc",
                  });
                  setSalesPage(1);
                }
              }}
              locale={{ emptyText: "No Sales Or Claims In This Period" }}
              size="small"
              scroll={{ x: 560 }}
            />
            <AppPagination
              page={salesPage}
              total={salesRows.length}
              pageSize={10}
              onChange={setSalesPage}
            />
          </div>
        )}
      </section>
      <section className="dashboard-breakdowns-react">
        {breakdowns.map(([label, key]) => {
          const counts = new Map();
          for (const claim of filteredClaims) {
            const value = claimValue(claim, key);
            counts.set(value, (counts.get(value) || 0) + 1);
          }
          return (
            <section className="surface" key={key}>
              <h3>{label}</h3>
              <div>
                {[...counts]
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 12)
                  .map(([value, count]) => (
                    <AppButton
                      key={value}
                      className={
                        selection?.key === key && selection.value === value
                          ? "active"
                          : ""
                      }
                      onClick={() => {
                        setSelection({ key, value });
                        setCasePage(1);
                      }}
                    >
                      <span>{value}</span>
                      <strong>{count}</strong>
                    </AppButton>
                  ))}
              </div>
            </section>
          );
        })}
      </section>
      <section className="surface dashboard-cases">
        <div className="section-title">
          <h2>
            {selection?.type === "ageing"
              ? selection.bucket === "critical"
                ? "Cases Over 21 Days"
                : selection.bucket === "warning"
                  ? "Cases 15-21 Days"
                  : "Cases Within 14 Days"
              : "Cases"}
          </h2>
          <div className="dashboard-case-actions">
            {selection && (
              <AppButton className="clear-action" onClick={() => setSelection(null)}>
                Clear Selection
              </AppButton>
            )}
            <AppButton
              className="secondary dashboard-export"
              onClick={exportCases}
              disabled={exporting || !selectedClaims.length}
            >
              <Download size={16} />
              {exporting ? "Preparing..." : "Export Excel"}
            </AppButton>
          </div>
        </div>
        <p>{selectedClaims.length.toLocaleString()} Matching Cases</p>
        <div className="dashboard-table ant-dashboard-table">
          <Table
            columns={caseColumns}
            dataSource={visibleCases}
            rowKey="id"
            pagination={false}
            locale={{ emptyText: "No Matching Cases" }}
            size="small"
            scroll={{ x: 560 }}
          />
          <AppPagination
            page={casePage}
            total={selectedClaims.length}
            pageSize={10}
            onChange={setCasePage}
          />
        </div>
      </section>
      {preview && (
        <CasePreviewComponent claim={preview} onClose={() => setPreview(null)} />
      )}
    </>
  );
}
