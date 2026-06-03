import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

function AppLayout({
  activePage = "Vehicles",
  children,
  currentProfile,
  isLoggingOut = false,
  isProfileLoading = false,
  onPageChange,
  onLogout,
  profileError = "",
  showTitle = false,
  title = "Vehicles",
  userEmail,
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-50">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0"
      >
        <div className="absolute -right-28 -top-32 h-80 w-80 rounded-full bg-emerald-200/35 blur-3xl" />
        <div className="absolute -bottom-36 -left-28 h-96 w-96 rounded-full bg-slate-200/50 blur-3xl" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/70 via-transparent to-slate-100/70" />
      </div>

      <div className="relative z-10">
        <Sidebar
          activePage={activePage}
          currentProfile={currentProfile}
          onPageChange={onPageChange}
        />

        <div className="min-h-screen lg:pl-64">
          <Topbar
            activePage={activePage}
            currentProfile={currentProfile}
            isLoggingOut={isLoggingOut}
            isProfileLoading={isProfileLoading}
            onPageChange={onPageChange}
            onLogout={onLogout}
            profileError={profileError}
            showTitle={showTitle}
            title={title}
            userEmail={userEmail}
          />

          <main className="px-4 py-5 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default AppLayout;
