import { useEffect, useRef, useState } from "react";
import AppErrorBoundary from "./components/AppErrorBoundary";
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
import VehicleFilePage from "./pages/VehicleFilePage";
import VehiclesPage from "./pages/VehiclesPage";
import VendorsPage from "./pages/VendorsPage";
import { MAIN_NAV_PAGES } from "./config/appConfig";
import { fetchCurrentUserProfile } from "./lib/currentUserProfile";
import { hasPermission } from "./lib/permissions";
import { supabase } from "./lib/supabaseClient";

const APP_HISTORY_ROUTE_KEY = "garageAppRoute";
const APP_HISTORY_DEPTH_KEY = "garageAppHistoryDepth";
const FALLBACK_PAGE = "Vehicles";
const vehicleScopedPages = new Set(["vehicleDetail", "vehicleFile"]);
const appRoutePaths = {
  Dashboard: "dashboard",
  Intake: "intake",
  "My Work": "my-work",
  Parts: "parts",
  "Purchase Orders": "purchase-orders",
  Repairs: "repairs",
  Settings: "settings",
  Team: "team",
  Vehicles: "vehicles",
  Vendors: "vendors",
};
const PROFILE_LOAD_TIMEOUT_MS = 15000;

function getDefaultLandingPageForRole(role) {
  return role === "technician" ? "My Work" : FALLBACK_PAGE;
}

function createAppRoute(page, vehicleId = null) {
  return {
    page,
    vehicleId: vehicleScopedPages.has(page) ? vehicleId : null,
  };
}

function parseAppRoutePath(pathValue) {
  const cleanPath = String(pathValue ?? "")
    .split("?")[0]
    .replace(/^#/, "")
    .replace(/^\/+|\/+$/g, "");

  if (!cleanPath) {
    return null;
  }

  const segments = cleanPath.split("/").filter(Boolean);
  const [section, vehicleId, fileSegment] = segments;

  if (section === "vehicles") {
    if (vehicleId && fileSegment === "file") {
      return createAppRoute("vehicleFile", decodeURIComponent(vehicleId));
    }

    if (vehicleId) {
      return createAppRoute("vehicleDetail", decodeURIComponent(vehicleId));
    }

    return createAppRoute("Vehicles");
  }

  const page = Object.entries(appRoutePaths).find(
    ([, routePath]) => routePath === section
  )?.[0];

  return page ? createAppRoute(page) : null;
}

function getRouteFromUrl() {
  if (typeof window === "undefined") {
    return null;
  }

  const hashRoute = parseAppRoutePath(window.location.hash);

  if (hashRoute) {
    return hashRoute;
  }

  const pathRoute = parseAppRoutePath(window.location.pathname);

  if (pathRoute) {
    return pathRoute;
  }

  const params = new URLSearchParams(window.location.search);

  return params.get("poId") ? createAppRoute("Purchase Orders") : null;
}

function getPathForRoute(route) {
  if (route?.page === "vehicleFile" && route.vehicleId) {
    return `/vehicles/${encodeURIComponent(route.vehicleId)}/file`;
  }

  if (route?.page === "vehicleDetail" && route.vehicleId) {
    return `/vehicles/${encodeURIComponent(route.vehicleId)}`;
  }

  return `/${appRoutePaths[route?.page] ?? appRoutePaths[FALLBACK_PAGE]}`;
}

function getSearchForRoute(route, routeSearchParams = null) {
  if (route?.page !== "Purchase Orders" || typeof window === "undefined") {
    return "";
  }

  const currentParams = new URLSearchParams(window.location.search);
  const poId = routeSearchParams?.poId ?? currentParams.get("poId");
  const itemId = routeSearchParams?.itemId ?? currentParams.get("itemId");

  if (!poId) {
    return "";
  }

  const nextParams = new URLSearchParams();
  nextParams.set("poId", poId);

  if (itemId) {
    nextParams.set("itemId", itemId);
  }

  return `?${nextParams.toString()}`;
}

function createBrowserUrlForRoute(route, routeSearchParams = null) {
  const search = getSearchForRoute(route, routeSearchParams);

  return `/${search}#${getPathForRoute(route)}`;
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

  return getRouteFromUrl() ?? createAppRoute(FALLBACK_PAGE);
}

function getInitialHistoryDepth() {
  return 0;
}

function areRoutesEqual(firstRoute, secondRoute) {
  return (
    firstRoute?.page === secondRoute?.page &&
    firstRoute?.vehicleId === secondRoute?.vehicleId
  );
}

function writeBrowserHistoryRoute(
  route,
  depth,
  method = "pushState",
  routeSearchParams = null
) {
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
    createBrowserUrlForRoute(route, routeSearchParams)
  );
}

function withTimeout(promise, timeoutMs, message) {
  let timeoutId;

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = window.setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    window.clearTimeout(timeoutId);
  });
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
  vehicleFile: {
    title: "Vehicle File",
    description: "Complete work, parts, labor, costs, activity, and documents for this vehicle.",
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
          Your account is pending admin approval. Please contact the admin.
        </h1>
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

function ProfileLoadError({ isLoggingOut, onLogout, onRetry }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-4">
      <section className="w-full max-w-md rounded-lg border border-amber-200 bg-white p-8 text-center shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wide text-amber-700">
          Profile Unavailable
        </p>
        <h1 className="mt-3 text-2xl font-bold text-zinc-950">
          Unable to load your profile.
        </h1>
        <p className="mt-2 text-sm leading-6 text-zinc-600">
          Please retry. If this keeps happening, log out and sign in again.
        </p>
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
            onClick={onRetry}
            type="button"
          >
            Retry
          </button>
          <button
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isLoggingOut}
            onClick={onLogout}
            type="button"
          >
            {isLoggingOut ? "Logging Out..." : "Logout"}
          </button>
        </div>
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
  const [purchaseOrderFocus, setPurchaseOrderFocus] = useState(null);
  const [profileRetryKey, setProfileRetryKey] = useState(0);
  const [appHistoryDepth, setAppHistoryDepth] = useState(() =>
    getInitialHistoryDepth()
  );
  const hasInitializedHistoryRef = useRef(false);
  const initialRouteWasExplicitRef = useRef(
    typeof window !== "undefined" && Boolean(getRouteFromUrl())
  );
  const currentRouteRef = useRef(currentRoute);
  const appHistoryDepthRef = useRef(appHistoryDepth);
  const activePage = currentRoute.page;
  const selectedVehicleId = currentRoute.vehicleId;
  const canViewDashboard = hasPermission(currentProfile?.role, "dashboard:view");
  const canManageUsers = hasPermission(currentProfile?.role, "user:manage");
  const defaultLandingPage = getDefaultLandingPageForRole(currentProfile?.role);
  const effectiveActivePage =
    activePage === "Dashboard" && !canViewDashboard
      ? defaultLandingPage
      : activePage === "Team" && !canManageUsers
        ? defaultLandingPage
        : activePage;
  const currentPage = pageDetails[effectiveActivePage];
  const showShellTitle = !MAIN_NAV_PAGES.includes(effectiveActivePage);
  const navigationPage = vehicleScopedPages.has(effectiveActivePage)
    ? "Vehicles"
    : effectiveActivePage;
  const userEmail = session?.user?.email ?? "";
  const userMetadata = session?.user?.user_metadata ?? null;
  const showAppBackButton =
    appHistoryDepth > 0 || effectiveActivePage !== defaultLandingPage;

  currentRouteRef.current = currentRoute;
  appHistoryDepthRef.current = appHistoryDepth;

  useEffect(() => {
    let isMounted = true;

    async function loadSession() {
      setIsAuthLoading(true);
      setAuthError("");

      try {
        const { data, error } = await withTimeout(
          supabase.auth.getSession(),
          PROFILE_LOAD_TIMEOUT_MS,
          "Unable to check your session."
        );

        if (!isMounted) {
          return;
        }

        if (error) {
          setAuthError("Unable to check your session.");
          setSession(null);
        } else {
          setSession(data.session ?? null);
        }
      } catch (error) {
        if (isMounted) {
          if (import.meta.env.DEV) {
            console.error("Unable to check session:", error);
          }
          setAuthError("Unable to check your session.");
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
        initialRouteWasExplicitRef.current = false;
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
        const { data, error } = await withTimeout(
          fetchCurrentUserProfile(session.user.id),
          PROFILE_LOAD_TIMEOUT_MS,
          "Unable to load profile."
        );

        if (!isMounted) {
          return;
        }

        if (error) {
          if (import.meta.env.DEV) {
            console.error("Unable to load profile:", error);
          }
          setCurrentProfile(null);
          setProfileError("Unable to load profile.");
          return;
        }

        if (!data) {
          setCurrentProfile(null);
          setProfileError("Profile not found. Please contact admin.");
          return;
        }

        setCurrentProfile(data);

        if (data.is_active === true) {
          const route = currentRouteRef.current;
          const depth = appHistoryDepthRef.current;
          const landingRoute = createAppRoute(
            getDefaultLandingPageForRole(data.role)
          );
          const isDefaultRootRoute =
            !initialRouteWasExplicitRef.current &&
            depth === 0 &&
            route.page === FALLBACK_PAGE &&
            !route.vehicleId;

          if (
            isDefaultRootRoute &&
            !areRoutesEqual(route, landingRoute)
          ) {
            writeBrowserHistoryRoute(landingRoute, 0, "replaceState");
            setCurrentRoute(landingRoute);
            setAppHistoryDepth(0);
          }
        }
      } catch (error) {
        if (isMounted) {
          if (import.meta.env.DEV) {
            console.error("Unable to load profile:", error);
          }
          setCurrentProfile(null);
          setProfileError("Unable to load profile.");
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
  }, [profileRetryKey, session?.user?.id]);

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
        return createAppRoute(defaultLandingPage);
      }

      if (route.page === "Dashboard" && !canViewDashboard) {
        return createAppRoute(defaultLandingPage);
      }

      if (route.page === "Team" && !canManageUsers) {
        return createAppRoute(defaultLandingPage);
      }

      if (vehicleScopedPages.has(route.page) && !route.vehicleId) {
        return createAppRoute(defaultLandingPage);
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
  }, [canManageUsers, canViewDashboard, defaultLandingPage]);

  function handlePageChange(pageName) {
    navigateToRoute(pageName);
  }

  function handleViewPurchaseOrders(target = null) {
    setPurchaseOrderFocus(target?.poId ? target : null);
    navigateToRoute("Purchase Orders", null, target?.poId ? target : null);
  }

  function handleSelectVehicle(vehicleId) {
    navigateToRoute("vehicleDetail", vehicleId);
  }

  function handleOpenVehicleFile(vehicleId) {
    navigateToRoute("vehicleFile", vehicleId);
  }

  function handleOpenVehicleDetail(vehicleId) {
    navigateToRoute("vehicleDetail", vehicleId);
  }

  function normalizeAppRoute(pageName, vehicleId = null) {
    if (pageName === "Dashboard" && !canViewDashboard) {
      return createAppRoute(defaultLandingPage);
    }

    if (pageName === "Team" && !canManageUsers) {
      return createAppRoute(defaultLandingPage);
    }

    if (vehicleScopedPages.has(pageName) && !vehicleId) {
      return createAppRoute(defaultLandingPage);
    }

    return createAppRoute(pageName, vehicleId);
  }

  function navigateToRoute(pageName, vehicleId = null, routeSearchParams = null) {
    const nextRoute = normalizeAppRoute(pageName, vehicleId);

    if (areRoutesEqual(currentRoute, nextRoute)) {
      if (routeSearchParams) {
        writeBrowserHistoryRoute(
          nextRoute,
          appHistoryDepth,
          "replaceState",
          routeSearchParams
        );
      }
      return;
    }

    const nextDepth = appHistoryDepth + 1;

    writeBrowserHistoryRoute(nextRoute, nextDepth, "pushState", routeSearchParams);
    setCurrentRoute(nextRoute);
    setAppHistoryDepth(nextDepth);
  }

  function handleRetryProfile() {
    setProfileError("");
    setProfileRetryKey((currentKey) => currentKey + 1);
  }

  function navigateToFallback() {
    const fallbackRoute = createAppRoute(defaultLandingPage);

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

  function handleVehicleFileBack() {
    if (appHistoryDepth > 0 && typeof window !== "undefined") {
      window.history.back();
      return;
    }

    if (selectedVehicleId) {
      navigateToRoute("vehicleDetail", selectedVehicleId);
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
          onOpenVehicleFile={handleOpenVehicleFile}
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
          onViewPurchaseOrders={handleViewPurchaseOrders}
        />
      );
    }

    if (effectiveActivePage === "Purchase Orders") {
      return (
        <PurchaseOrdersPage
          currentProfile={currentProfile}
          focusTarget={purchaseOrderFocus}
          onFocusHandled={() => setPurchaseOrderFocus(null)}
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
          onOpenVehicleFile={handleOpenVehicleFile}
          onViewPurchaseOrders={handleViewPurchaseOrders}
          vehicleId={selectedVehicleId}
        />
      );
    }

    if (effectiveActivePage === "vehicleFile") {
      return (
        <VehicleFilePage
          currentProfile={currentProfile}
          onBack={handleVehicleFileBack}
          onOpenVehicleDetail={handleOpenVehicleDetail}
          onViewPurchaseOrders={handleViewPurchaseOrders}
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

  if (!currentProfile && profileError) {
    return (
      <ProfileLoadError
        isLoggingOut={isLoggingOut}
        onLogout={handleLogout}
        onRetry={handleRetryProfile}
      />
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
      <AppErrorBoundary
        canViewDashboard={canViewDashboard}
        onGoDashboard={() => navigateToRoute("Dashboard")}
        onGoVehicles={() => navigateToRoute("Vehicles")}
        resetKey={`${effectiveActivePage}:${selectedVehicleId ?? ""}`}
      >
        {renderActivePage()}
      </AppErrorBoundary>
    </AppLayout>
  );
}

export default App;
