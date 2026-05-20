import { useEffect, useState } from "react";
import AppLayout from "./layouts/AppLayout";
import Dashboard from "./pages/Dashboard";
import IntakePage from "./pages/IntakePage";
import LoginPage from "./pages/LoginPage";
import SettingsPage from "./pages/SettingsPage";
import VehicleDetailPage from "./pages/VehicleDetailPage";
import VehiclesPage from "./pages/VehiclesPage";
import { fetchCurrentUserProfile } from "./lib/currentUserProfile";
import { hasPermission } from "./lib/permissions";
import { supabase } from "./lib/supabaseClient";

const pageDetails = {
  Dashboard: {
    title: "Dashboard",
    description: "Track inventory investment, total spend, and estimated profit.",
  },
  Intake: {
    title: "Intake",
    description: "Start a new vehicle record with a VIN-first intake workflow.",
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
    description: "Manage team access, roles, and workspace settings.",
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

function AccountPendingApproval({ isLoggingOut, onLogout }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <section className="w-full max-w-md rounded-lg border border-zinc-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">
          Account Pending Approval
        </p>
        <h1 className="mt-3 text-2xl font-bold text-zinc-950">
          Your account is waiting for admin approval.
        </h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          Please contact an admin or owner to activate your account.
        </p>
        <button
          className="mt-6 w-full rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={isLoggingOut}
          onClick={onLogout}
          type="button"
        >
          {isLoggingOut ? "Logging Out..." : "Logout"}
        </button>
      </section>
    </main>
  );
}

function App() {
  const [activePage, setActivePage] = useState("Vehicles");
  const [selectedVehicleId, setSelectedVehicleId] = useState(null);
  const [session, setSession] = useState(null);
  const [currentProfile, setCurrentProfile] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [profileError, setProfileError] = useState("");
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const canViewDashboard = hasPermission(currentProfile?.role, "dashboard:view");
  const effectiveActivePage =
    activePage === "Dashboard" && !canViewDashboard ? "Vehicles" : activePage;
  const currentPage = pageDetails[effectiveActivePage];
  const navigationPage =
    effectiveActivePage === "vehicleDetail" ? "Vehicles" : effectiveActivePage;
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

  useEffect(() => {
    let isMounted = true;

    async function loadCurrentProfile() {
      if (!session?.user?.id) {
        setCurrentProfile(null);
        setProfileError("");
        setIsProfileLoading(false);
        return;
      }

      setIsProfileLoading(true);
      setProfileError("");

      try {
        const { data, error } = await fetchCurrentUserProfile(session.user.id);

        if (!isMounted) {
          return;
        }

        if (error) {
          setCurrentProfile(null);
          setProfileError(error.message);
          return;
        }

        if (!data) {
          setCurrentProfile(null);
          setProfileError("Profile not found. Please contact admin.");
          return;
        }

        setCurrentProfile(data);
      } catch (error) {
        if (isMounted) {
          setCurrentProfile(null);
          setProfileError(error.message ?? "Unable to load your profile.");
        }
      } finally {
        if (isMounted) {
          setIsProfileLoading(false);
        }
      }
    }

    loadCurrentProfile();

    return () => {
      isMounted = false;
    };
  }, [session?.user?.id]);

  function handlePageChange(pageName) {
    if (pageName === "Dashboard" && !canViewDashboard) {
      setSelectedVehicleId(null);
      setActivePage("Vehicles");
      return;
    }

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
    setProfileError("");

    try {
      const { error } = await supabase.auth.signOut();

      if (error) {
        setAuthError(error.message);
        return;
      }

      setSelectedVehicleId(null);
      setCurrentProfile(null);
      setActivePage("Vehicles");
    } catch (error) {
      setAuthError(error.message ?? "Unable to log out.");
    } finally {
      setIsLoggingOut(false);
    }
  }

  function renderActivePage() {
    if (effectiveActivePage === "Dashboard") {
      return <Dashboard currentProfile={currentProfile} />;
    }

    if (effectiveActivePage === "Vehicles") {
      return (
        <VehiclesPage
          currentProfile={currentProfile}
          onSelectVehicle={handleSelectVehicle}
        />
      );
    }

    if (effectiveActivePage === "Intake") {
      return (
        <IntakePage
          currentProfile={currentProfile}
          onViewVehicles={() => handlePageChange("Vehicles")}
        />
      );
    }

    if (effectiveActivePage === "vehicleDetail") {
      return (
        <VehicleDetailPage
          currentProfile={currentProfile}
          onBack={handleBackToVehicles}
          vehicleId={selectedVehicleId}
        />
      );
    }

    if (effectiveActivePage === "Settings") {
      return <SettingsPage currentProfile={currentProfile} />;
    }

    return <PlaceholderPage title={effectiveActivePage} />;
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

  if (isProfileLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
        <section className="rounded-lg border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <p className="font-medium text-zinc-700">Loading profile...</p>
        </section>
      </main>
    );
  }

  if (currentProfile && currentProfile.is_active === false) {
    return (
      <AccountPendingApproval
        isLoggingOut={isLoggingOut}
        onLogout={handleLogout}
      />
    );
  }

  return (
    <AppLayout
      activePage={navigationPage}
      currentProfile={currentProfile}
      description={currentPage.description}
      isLoggingOut={isLoggingOut}
      isProfileLoading={isProfileLoading}
      onPageChange={handlePageChange}
      onLogout={handleLogout}
      profileError={profileError}
      title={currentPage.title}
      userEmail={userEmail}
    >
      {authError && (
        <div className="mb-6 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {authError}
        </div>
      )}
      {profileError && (
        <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {profileError}
        </div>
      )}
      {renderActivePage()}
    </AppLayout>
  );
}

export default App;
