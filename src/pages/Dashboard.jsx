import { useEffect, useState } from "react";
import VehicleStatusBadge from "../components/VehicleStatusBadge";
import { supabase } from "../lib/supabaseClient";
import {
  formatVehicleStatus,
  getVehicleStatusClassName,
  vehicleStatusOptions,
} from "../lib/vehicleStatus";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const numberFormatter = new Intl.NumberFormat("en-US");

function formatCurrency(value) {
  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return currencyFormatter.format(0);
  }

  return currencyFormatter.format(numberValue);
}

function formatNumber(value) {
  return numberFormatter.format(value);
}

function numberOrZero(value) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function countVehiclesByStatus(vehicles) {
  const counts = {};

  vehicles.forEach((vehicle) => {
    const status = vehicle.status || "not_available";
    counts[status] = (counts[status] ?? 0) + 1;
  });

  return counts;
}

function isSoldVehicle(vehicle) {
  return String(vehicle.status ?? "").toLowerCase() === "sold";
}

function isActiveVehicle(vehicle) {
  const status = String(vehicle.status ?? "").toLowerCase();
  return status !== "sold" && status !== "archived";
}

function getStatusOverviewRows(statusCounts) {
  const customStatuses = Object.keys(statusCounts).filter(
    (status) => !vehicleStatusOptions.includes(status)
  );

  return [...vehicleStatusOptions, ...customStatuses].map((status) => ({
    count: statusCounts[status] ?? 0,
    status,
  }));
}

function mergeVehiclesWithSummaries(vehicles, summaries) {
  const summariesByStockNumber = new Map(
    summaries.map((summary) => [summary.stock_number, summary])
  );

  return vehicles.map((vehicle) => {
    const summary = summariesByStockNumber.get(vehicle.stock_number) ?? {};

    return {
      ...summary,
      ...vehicle,
      estimated_profit: summary.estimated_profit ?? 0,
      total_invested: summary.total_invested ?? 0,
      status: vehicle.status ?? summary.status,
      title_status: vehicle.title_status ?? summary.title_status,
      vehicle_origin: vehicle.vehicle_origin ?? summary.vehicle_origin,
    };
  });
}

function getActiveInvestmentRows(summaries, vehicles) {
  return mergeVehiclesWithSummaries(vehicles, summaries).filter((vehicle) =>
    isActiveVehicle(vehicle)
  );
}

function getTopInvestmentActiveVehicles(summaries, vehicles) {
  return getActiveInvestmentRows(summaries, vehicles)
    .sort(
      (firstVehicle, secondVehicle) =>
        numberOrZero(secondVehicle.total_invested) -
        numberOrZero(firstVehicle.total_invested)
    )
    .slice(0, 5);
}

function getSalesTotal(sales) {
  return sales.reduce((total, sale) => total + numberOrZero(sale.sale_price), 0);
}

function getSalePriceByVehicleId(sales) {
  const salePriceByVehicleId = new Map();

  sales.forEach((sale) => {
    if (!sale.vehicle_id) {
      return;
    }

    const currentTotal = salePriceByVehicleId.get(sale.vehicle_id) ?? 0;
    salePriceByVehicleId.set(
      sale.vehicle_id,
      currentTotal + numberOrZero(sale.sale_price)
    );
  });

  return salePriceByVehicleId;
}

function SummaryCard({ label, value, valueClassName = "text-slate-950" }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${valueClassName}`}>{value}</p>
    </article>
  );
}

function HighestInvestmentVehicles({ vehicles }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-slate-950">
          Highest Investment Active Vehicles
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Top 5 active vehicles by total invested.
        </p>
      </div>

      {vehicles.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
          No investment summary data found yet.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {vehicles.map((vehicle, index) => (
            <div
              className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
              key={`${vehicle.stock_number}-${index}`}
            >
              <div>
                <div className="flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-700">
                    {index + 1}
                  </span>
                  <div>
                    <p className="font-bold text-slate-950">
                      {vehicle.stock_number ?? "No Stock Number"}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {vehicle.make ?? "Unknown"} {vehicle.model ?? "Vehicle"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <VehicleStatusBadge status={vehicle.status} />
                <span className="rounded-md bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                  {formatCurrency(vehicle.total_invested)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function SoldVehiclesSummary({ salePriceByVehicleId, vehicles }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-slate-950">
          Sold Vehicles Summary
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Sold inventory with recorded sale prices.
        </p>
      </div>

      {vehicles.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-500">
          No sold vehicles found yet.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {vehicles.map((vehicle, index) => {
            const salePrice = salePriceByVehicleId.get(vehicle.id);

            return (
              <div
                className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                key={vehicle.id ?? `${vehicle.stock_number}-${index}`}
              >
                <div>
                  <p className="font-bold text-slate-950">
                    {vehicle.stock_number ?? "No Stock Number"}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {vehicle.make ?? "Unknown"} {vehicle.model ?? "Vehicle"}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  <VehicleStatusBadge status={vehicle.status} />
                  <span className="rounded-md bg-emerald-50 px-3 py-2 text-sm font-bold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                    {salePrice === undefined
                      ? "Sale price not recorded"
                      : formatCurrency(salePrice)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function StatusOverview({ rows }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-slate-950">Status Overview</h2>
        <p className="mt-1 text-sm text-slate-500">
          Vehicle count by workflow status.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {rows.map((row) => (
          <div
            className="flex items-center justify-between gap-3 rounded-md border border-slate-100 bg-slate-50 px-4 py-3"
            key={row.status}
          >
            <span
              className={`rounded-full px-3 py-1 text-sm font-semibold ring-1 ring-inset ${getVehicleStatusClassName(
                row.status
              )}`}
            >
              {formatVehicleStatus(row.status)}
            </span>
            <span className="text-lg font-bold text-slate-950">
              {formatNumber(row.count)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function Dashboard() {
  const [investmentSummaries, setInvestmentSummaries] = useState([]);
  const [sales, setSales] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function fetchDashboardData() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const [summaryResponse, vehiclesResponse, salesResponse] =
          await Promise.all([
            supabase
              .from("vehicle_investment_summary")
              .select(
                "stock_number, make, model, purchase_price, total_invested, estimated_profit"
              )
              .order("stock_number", { ascending: true }),
            supabase
              .from("vehicles")
              .select(
                "id, stock_number, make, model, status, title_status, vehicle_origin"
              )
              .order("stock_number", { ascending: true }),
            supabase
              .from("sales")
              .select("id, vehicle_id, sale_price, sale_date")
              .order("sale_date", { ascending: false }),
          ]);

        if (!isMounted) {
          return;
        }

        if (summaryResponse.error) {
          setErrorMessage(summaryResponse.error.message);
          setInvestmentSummaries([]);
          setSales([]);
          setVehicles([]);
          return;
        }

        if (vehiclesResponse.error) {
          setErrorMessage(vehiclesResponse.error.message);
          setInvestmentSummaries([]);
          setSales([]);
          setVehicles([]);
          return;
        }

        if (salesResponse.error) {
          setErrorMessage(salesResponse.error.message);
          setInvestmentSummaries([]);
          setSales([]);
          setVehicles([]);
          return;
        }

        setInvestmentSummaries(summaryResponse.data ?? []);
        setSales(salesResponse.data ?? []);
        setVehicles(vehiclesResponse.data ?? []);
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error.message ?? "Something went wrong.");
          setInvestmentSummaries([]);
          setSales([]);
          setVehicles([]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchDashboardData();

    return () => {
      isMounted = false;
    };
  }, []);

  const activeVehicles = vehicles.filter(isActiveVehicle);
  const soldVehicles = vehicles.filter(isSoldVehicle);
  const activeInvestmentRows = getActiveInvestmentRows(
    investmentSummaries,
    vehicles
  );
  const activeInventoryInvestment = activeInvestmentRows.reduce(
    (total, vehicle) => total + numberOrZero(vehicle.total_invested),
    0
  );
  const activeEstimatedProfit = activeInvestmentRows.reduce(
    (total, vehicle) => total + numberOrZero(vehicle.estimated_profit),
    0
  );
  const totalRevenue = getSalesTotal(sales);
  const salePriceByVehicleId = getSalePriceByVehicleId(sales);
  const statusCounts = countVehiclesByStatus(vehicles);
  const topInvestmentActiveVehicles = getTopInvestmentActiveVehicles(
    investmentSummaries,
    vehicles
  );
  const statusOverviewRows = getStatusOverviewRows(statusCounts);

  return (
    <div className="space-y-6">
      {isLoading && (
        <section className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
          <p className="font-medium text-slate-700">
            Loading dashboard analytics...
          </p>
        </section>
      )}

      {!isLoading && errorMessage && (
        <section className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-800">
          <h2 className="font-semibold">Unable to load dashboard data</h2>
          <p className="mt-2 text-sm">{errorMessage}</p>
        </section>
      )}

      {!isLoading && !errorMessage && (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            <SummaryCard
              label="Total Vehicles"
              value={formatNumber(vehicles.length)}
            />
            <SummaryCard
              label="Active Inventory Count"
              value={formatNumber(activeVehicles.length)}
            />
            <SummaryCard
              label="Sold Vehicles Count"
              value={formatNumber(soldVehicles.length)}
            />
            <SummaryCard
              label="Active Inventory Investment"
              value={formatCurrency(activeInventoryInvestment)}
            />
            <SummaryCard
              label="Total Revenue from Sold Vehicles"
              value={formatCurrency(totalRevenue)}
              valueClassName="text-emerald-700"
            />
            <SummaryCard
              label="Estimated Profit for Active Inventory"
              value={formatCurrency(activeEstimatedProfit)}
              valueClassName={
                activeEstimatedProfit < 0
                  ? "text-red-700"
                  : "text-emerald-700"
              }
            />
          </section>

          {vehicles.length === 0 && investmentSummaries.length === 0 ? (
            <section className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">
                No vehicles found
              </h2>
              <p className="mt-2 text-slate-600">
                Add vehicles to Supabase and they will appear here.
              </p>
            </section>
          ) : (
            <section className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
              <HighestInvestmentVehicles
                vehicles={topInvestmentActiveVehicles}
              />
              <StatusOverview rows={statusOverviewRows} />
              <SoldVehiclesSummary
                salePriceByVehicleId={salePriceByVehicleId}
                vehicles={soldVehicles}
              />
            </section>
          )}
        </>
      )}
    </div>
  );
}

export default Dashboard;
