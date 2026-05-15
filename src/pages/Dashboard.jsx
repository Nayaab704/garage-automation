import { useEffect, useState } from "react";
import VehicleCard from "../components/VehicleCard";
import { supabase } from "../lib/supabaseClient";

function Dashboard() {
  const [vehicles, setVehicles] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function fetchVehicles() {
      setIsLoading(true);
      setErrorMessage("");

      try {
        const { data, error } = await supabase
          .from("vehicle_investment_summary")
          .select(
            "stock_number, make, model, purchase_price, total_invested, estimated_profit",
          )
          .order("stock_number", { ascending: true });

        if (!isMounted) {
          return;
        }

        if (error) {
          setErrorMessage(error.message);
          setVehicles([]);
        } else {
          setVehicles(data ?? []);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error.message ?? "Something went wrong.");
          setVehicles([]);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    fetchVehicles();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Garage Management
          </p>
          <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
            Vehicle Investment Dashboard
          </h1>
          <p className="mt-3 max-w-2xl text-slate-600">
            Track purchase cost, investment totals, and estimated profit for
            every vehicle in inventory.
          </p>
        </header>

        {isLoading && (
          <section className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
            <p className="font-medium text-slate-700">Loading vehicles...</p>
          </section>
        )}

        {!isLoading && errorMessage && (
          <section className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-800">
            <h2 className="font-semibold">Unable to load dashboard data</h2>
            <p className="mt-2 text-sm">{errorMessage}</p>
          </section>
        )}

        {!isLoading && !errorMessage && vehicles.length === 0 && (
          <section className="rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              No vehicles found
            </h2>
            <p className="mt-2 text-slate-600">
              Add vehicles to Supabase and they will appear here.
            </p>
          </section>
        )}

        {!isLoading && !errorMessage && vehicles.length > 0 && (
          <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {vehicles.map((vehicle) => (
              <VehicleCard
                key={vehicle.stock_number}
                vehicle={vehicle}
              />
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

export default Dashboard;
