import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import AppBackground from "../components/ui/AppBackground";
import { pageContainerClassName } from "../components/ui/uiStyles";

function AppLayout({
  activePage = "Vehicles",
  children,
  currentProfile,
  isLoggingOut = false,
  isProfileLoading = false,
  onBack,
  onPageChange,
  onLogout,
  profileError = "",
  showBackButton = false,
  showTitle = false,
  title = "Vehicles",
  userEmail,
}) {
  return (
    <AppBackground>
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
          onBack={onBack}
          onPageChange={onPageChange}
          onLogout={onLogout}
          profileError={profileError}
          showBackButton={showBackButton}
          showTitle={showTitle}
          title={title}
          userEmail={userEmail}
        />

        <main className="px-4 py-5 sm:px-6 lg:px-8">
          <div className={pageContainerClassName}>{children}</div>
        </main>
      </div>
    </AppBackground>
  );
}

export default AppLayout;
