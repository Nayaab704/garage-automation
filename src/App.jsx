import { useState } from "react";
import AppLayout from "./layouts/AppLayout";
import Dashboard from "./pages/Dashboard";
import VehicleDetailPage from "./pages/VehicleDetailPage";
import VehiclesPage from "./pages/VehiclesPage";

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
  const currentPage = pageDetails[activePage];
  const navigationPage = activePage === "vehicleDetail" ? "Vehicles" : activePage;

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

  return (
    <AppLayout
      activePage={navigationPage}
      description={currentPage.description}
      onPageChange={handlePageChange}
      title={currentPage.title}
    >
      {renderActivePage()}
    </AppLayout>
  );
}

export default App;
