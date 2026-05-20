import { useEffect, useState } from "react";
import AppLayout from "./layouts/AppLayout";
import Dashboard from "./pages/Dashboard";
import LoginPage from "./pages/LoginPage";
import VehicleDetailPage from "./pages/VehicleDetailPage";
import VehiclesPage from "./pages/VehiclesPage";
import { supabase } from "./lib/supabaseClient";

const pageDetails = {
  Dashboard: {
    title: "Dashboard",
    description: "Track inventory investment, total spend, and estimated profit.",
  },
  Vehicles: {
    title: "Vehicles",
    description: "Add vehicles to inventory and review purchase details.",
  },
  Repairs: {
    title: "Repairs",
    description: "Repair orders and service history will live here.",
  },
  Parts: {
    title: "Parts",
    description: "Parts inventory, ordering, and usage tracking will live here.",
  },
  Vendors: {
    title: "Vendors",
    description: "Vendor contacts, invoices, and performance will live here.",
  },
  Analytics: {
    title: "Analytics",
    description: "Operational reporting and profitability insights will live here.",
  },
  Settings: {
    title: "Settings",
    description: "Workspace preferences and system settings will live here.",
  },
  vehicleDetail: {
    title: "Vehicle Detail",
    description: "Review vehicle information, repairs, parts, and investment totals.",
  },
};

function PlaceholderPage({ title }) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-8 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
        Coming Soon
      </p>
      <h2 className="mt-3 text-2xl font-bold text-zinc-950">{title}</h2>
      <p className="mt-2 max-w-2xl text-zinc-600">
        This section is ready for the next feature pass. Navigation is wired,
        and the app shell will keep this page consistent with the rest of the
        dashboard.
      </p>
    </section>
  );
}

function App() {
  const [activePage, setActivePage] = useState("Vehicles");
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);
  const [session, setSession] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const currentPage = pageDetails[activePage];
  const navigationPage = activePage === "vehicleDetail" ? "Vehicles" : activePage;
  const userEmail = session?.user?.email ?? "";

  useEffect(() => {
    let isMounted = true;

    async function loadSession() {
      setIsAuthLoading(true);
      setAuthError("");

      try {
        const { data, error } = await supabase.auth.getSession();

        if (!isMounted) {
          return;
        }

        if (error) {
          setAuthError(error.message);
          setSession(null);
        } else {
          setSession(data.session ?? null);
        }
      } catch (error) {
        if (isMounted) {
          setAuthError(error.message ?? "Unable to check your session.");
          setSession(null);
        }
      } finally {
        if (isMounted) {
          setIsAuthLoading(false);
        }
      }
    }

    loadSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setIsAuthLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  function handlePageChange(pageName) {
    setSelectedVehicleId(null);
    setActivePage(pageName);
  }

  function handleSelectVehicle(vehicleId) {
    setSelectedVehicleId(vehicleId);
    setActivePage("vehicleDetail");
  }

  function handleBackToVehicles() {
    setSelectedVehicleId(null);
    setActivePage("Vehicles");
  }

  async function handleLogout() {
    setIsLoggingOut(true);
    setAuthError("");

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        setAuthError(error.message);
        return;
      }

      setSelectedVehicleId(null);
      setActivePage("Vehicles");
    } catch (error) {
      setAuthError(error.message ?? "Unable to log out.");
    } finally {
      setIsLoggingOut(false);
    }
  }

  function renderActivePage() {
    if (activePage === "Dashboard") {
      return <Dashboard />;
    }

    if (activePage === "Vehicles") {
      return <VehiclesPage onSelectVehicle={handleSelectVehicle} />;
    }

    if (activePage === "vehicleDetail") {
      return (
        <VehicleDetailPage
          onBack={handleBackToVehicles}
          vehicleId={selectedVehicleId}
        />
      );
    }

    return <PlaceholderPage title={activePage} />;
  }

  if (isAuthLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
        <section className="rounded-lg border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <p className="font-medium text-zinc-700">Checking your session...</p>
        </section>
      </main>
    );
  }

  if (!session) {
    return <LoginPage />;
  }

  return (
    <AppLayout
      activePage={navigationPage}
      description={currentPage.description}
      isLoggingOut={isLoggingOut}
      onPageChange={handlePageChange}
      onLogout={handleLogout}
      title={currentPage.title}
      userEmail={userEmail}
    >
      {authError && (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {authError}
        </div>
      )}
      {renderActivePage()}
    </AppLayout>
  );
}

export default App;
