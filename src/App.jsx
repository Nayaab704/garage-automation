import { useEffect, useRef, useState } from "react";
import AppLayout from "./layouts/AppLayout";
import Dashboard from "./pages/Dashboard";
import IntakePage from "./pages/IntakePage";
import LoginPage from "./pages/LoginPage";
import MyWorkPage from "./pages/MyWorkPage";
import PartsPage from "./pages/PartsPage";
import PurchaseOrdersPage from "./pages/PurchaseOrdersPage";
import RepairsPage from "./pages/RepairsPage";
import SettingsPage from "./pages/SettingsPage";
import TeamManagementPage from "./pages/TeamManagementPage";
import VehicleDetailPage from "./pages/VehicleDetailPage";
import VehiclesPage from "./pages/VehiclesPage";
import VendorsPage from "./pages/VendorsPage";
import { MAIN_NAV_PAGES } from "./config/appConfig";
import { fetchCurrentUserProfile } from "./lib/currentUserProfile";
import { hasPermission } from "./lib/permissions";
import { supabase } from "./lib/supabaseClient";

const APP_HISTORY_ROUTE_KEY = "garageAppRoute";
const APP_HISTORY_DEPTH_KEY = "garageAppHistoryDepth";
const FALLBACK_PAGE = "Vehicles";

function createAppRoute(page, vehicleId = null) {
  return {
    page,
    vehicleId: page === "vehicleDetail" ? vehicleId : null,
  };
}

function getRouteFromHistoryState(state) {
  const route = state?.[APP_HISTORY_ROUTE_KEY];

  if (!route?.page) {
    return null;
  }

  return createAppRoute(route.page, route.vehicleId ?? null);
}

function getHistoryDepth(state) {
  const depth = Number(state?.[APP_HISTORY_DEPTH_KEY] ?? 0);

  return Number.isFinite(depth) && depth > 0 ? depth : 0;
}

function getInitialAppRoute() {
  if (typeof window === "undefined") {
    return createAppRoute(FALLBACK_PAGE);
  }

  return getRouteFromHistoryState(window.history.state) ?? createAppRoute(FALLBACK_PAGE);
}

function getInitialHistoryDepth() {
  if (typeof window === "undefined") {
    return 0;
  }

  return getHistoryDepth(window.history.state);
}

function areRoutesEqual(firstRoute, secondRoute) {
  return (
    firstRoute?.page === secondRoute?.page &&
    firstRoute?.vehicleId === secondRoute?.vehicleId
  );
}

function writeBrowserHistoryRoute(route, depth, method = "pushState") {
  if (typeof window === "undefined") {
    return;
  }

  window.history[method](
    {
      ...(window.history.state ?? {}),
      [APP_HISTORY_ROUTE_KEY]: route,
      [APP_HISTORY_DEPTH_KEY]: depth,
    },
    "",
    window.location.href
  );
}

const pageDetails = {
  Dashboard: {
    title: "Dashboard",
    description: "Track inventory investment, total spend, and estimated profit.",
  },
  Intake: {
    title: "Intake",
    description: "Start a new vehicle record with a VIN-first intake workflow.",
  },
  "My Work": {
    title: "My Work",
    description: "Track your active work, labor, and recent activity.",
  },
  Vehicles: {
    title: "Vehicles",
    description: "Browse inventory and open vehicle workspaces.",
  },
  Repairs: {
    title: "Repairs",
    description: "Track active work orders, technician assignments, and repair status.",
  },
  Parts: {
    title: "Parts",
    description: "Review requested parts and create purchase orders for work orders.",
  },
  "Purchase Orders": {
    title: "Purchase Orders",
    description: "Track purchase orders, received parts, and vendor ordering status.",
  },
  Vendors: {
    title: "Vendors",
    description: "Manage supplier, service, auction, and partner contacts.",
  },
  Team: {
    title: "Team Management",
    description: "Approve users, assign roles, and manage team access.",
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
  const [currentRoute, setCurrentRoute] = useState(() => getInitialAppRoute());
  const [session, setSession] = useState(null);
  const [currentProfile, setCurrentProfile] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [profileError, setProfileError] = useState("");
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [appHistoryDepth, setAppHistoryDepth] = useState(() =>
    getInitialHistoryDepth()
  );
  const hasInitializedHistoryRef = useRef(false);
  const activePage = currentRoute.page;
  const selectedVehicleId = currentRoute.vehicleId;
  const canViewDashboard = hasPermission(currentProfile?.role, "dashboard:view");
  const canManageUsers = hasPermission(currentProfile?.role, "user:manage");
  const effectiveActivePage =
    activePage === "Dashboard" && !canViewDashboard
      ? "Vehicles"
      : activePage === "Team" && !canManageUsers
        ? "Vehicles"
        : activePage;
  const currentPage = pageDetails[effectiveActivePage];
  const showShellTitle = !MAIN_NAV_PAGES.includes(effectiveActivePage);
  const navigationPage =
    effectiveActivePage === "vehicleDetail" ? "Vehicles" : effectiveActivePage;
  const userEmail = session?.user?.email ?? "";
  const userMetadata = session?.user?.user_metadata ?? null;
  const showAppBackButton =
    appHistoryDepth > 0 || effectiveActivePage !== FALLBACK_PAGE;

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
      if (!nextSession) {
        const fallbackRoute = createAppRoute(FALLBACK_PAGE);

        writeBrowserHistoryRoute(fallbackRoute, 0, "replaceState");
        setCurrentRoute(fallbackRoute);
        setAppHistoryDepth(0);
        hasInitializedHistoryRef.current = false;
      }

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

  useEffect(() => {
    if (!session || hasInitializedHistoryRef.current) {
      return;
    }

    writeBrowserHistoryRoute(currentRoute, appHistoryDepth, "replaceState");
    hasInitializedHistoryRef.current = true;
  }, [appHistoryDepth, currentRoute, session]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    function normalizeRouteForAccess(route) {
      if (!route) {
        return createAppRoute(FALLBACK_PAGE);
      }

      if (route.page === "Dashboard" && !canViewDashboard) {
        return createAppRoute(FALLBACK_PAGE);
      }

      if (route.page === "Team" && !canManageUsers) {
        return createAppRoute(FALLBACK_PAGE);
      }

      if (route.page === "vehicleDetail" && !route.vehicleId) {
        return createAppRoute(FALLBACK_PAGE);
      }

      return route;
    }

    function handlePopState(event) {
      const nextRoute = normalizeRouteForAccess(
        getRouteFromHistoryState(event.state)
      );

      setCurrentRoute(nextRoute);
      setAppHistoryDepth(getHistoryDepth(event.state));
    }

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [canManageUsers, canViewDashboard]);

  function handlePageChange(pageName) {
    navigateToRoute(pageName);
  }

  function handleSelectVehicle(vehicleId) {
    navigateToRoute("vehicleDetail", vehicleId);
  }

  function normalizeAppRoute(pageName, vehicleId = null) {
    if (pageName === "Dashboard" && !canViewDashboard) {
      return createAppRoute(FALLBACK_PAGE);
    }

    if (pageName === "Team" && !canManageUsers) {
      return createAppRoute(FALLBACK_PAGE);
    }

    if (pageName === "vehicleDetail" && !vehicleId) {
      return createAppRoute(FALLBACK_PAGE);
    }

    return createAppRoute(pageName, vehicleId);
  }

  function navigateToRoute(pageName, vehicleId = null) {
    const nextRoute = normalizeAppRoute(pageName, vehicleId);

    if (areRoutesEqual(currentRoute, nextRoute)) {
      return;
    }

    const nextDepth = appHistoryDepth + 1;

    writeBrowserHistoryRoute(nextRoute, nextDepth);
    setCurrentRoute(nextRoute);
    setAppHistoryDepth(nextDepth);
  }

  function navigateToFallback() {
    const fallbackRoute = createAppRoute(FALLBACK_PAGE);

    if (!areRoutesEqual(currentRoute, fallbackRoute)) {
      writeBrowserHistoryRoute(fallbackRoute, 0, "replaceState");
      setCurrentRoute(fallbackRoute);
    }

    setAppHistoryDepth(0);
  }

  function handleAppBack() {
    if (appHistoryDepth > 0 && typeof window !== "undefined") {
      window.history.back();
      return;
    }

    navigateToFallback();
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

      const fallbackRoute = createAppRoute(FALLBACK_PAGE);

      writeBrowserHistoryRoute(fallbackRoute, 0, "replaceState");
      setCurrentRoute(fallbackRoute);
      setAppHistoryDepth(0);
      hasInitializedHistoryRef.current = false;
      setCurrentProfile(null);
    } catch (error) {
      setAuthError(error.message ?? "Unable to log out.");
    } finally {
      setIsLoggingOut(false);
    }
  }

  function renderActivePage() {
    if (effectiveActivePage === "Dashboard") {
      return (
        <Dashboard
          currentProfile={currentProfile}
          onNavigate={handlePageChange}
          onSelectVehicle={handleSelectVehicle}
        />
      );
    }

    if (effectiveActivePage === "Vehicles") {
      return (
        <VehiclesPage
          currentProfile={currentProfile}
          onSelectVehicle={handleSelectVehicle}
        />
      );
    }

    if (effectiveActivePage === "My Work") {
      return (
        <MyWorkPage
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

    if (effectiveActivePage === "Parts") {
      return (
        <PartsPage
          currentProfile={currentProfile}
          onSelectVehicle={handleSelectVehicle}
          onViewPurchaseOrders={() => handlePageChange("Purchase Orders")}
        />
      );
    }

    if (effectiveActivePage === "Purchase Orders") {
      return (
        <PurchaseOrdersPage
          currentProfile={currentProfile}
          onSelectVehicle={handleSelectVehicle}
        />
      );
    }

    if (effectiveActivePage === "Repairs") {
      return (
        <RepairsPage
          currentProfile={currentProfile}
          onSelectVehicle={handleSelectVehicle}
        />
      );
    }

    if (effectiveActivePage === "Vendors") {
      return <VendorsPage currentProfile={currentProfile} />;
    }

    if (effectiveActivePage === "Team") {
      return <TeamManagementPage currentProfile={currentProfile} />;
    }

    if (effectiveActivePage === "vehicleDetail") {
      return (
        <VehicleDetailPage
          currentProfile={currentProfile}
          onBack={handleAppBack}
          vehicleId={selectedVehicleId}
        />
      );
    }

    if (effectiveActivePage === "Settings") {
      return (
        <SettingsPage
          currentProfile={currentProfile}
          onCurrentProfileUpdated={setCurrentProfile}
        />
      );
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

  if (!currentProfile || currentProfile.is_active === false) {
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
      isLoggingOut={isLoggingOut}
      isProfileLoading={isProfileLoading}
      onBack={handleAppBack}
      onPageChange={handlePageChange}
      onLogout={handleLogout}
      profileError={profileError}
      showBackButton={showAppBackButton}
      showTitle={showShellTitle}
      title={currentPage.title}
      userEmail={userEmail}
      userMetadata={userMetadata}
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
