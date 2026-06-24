import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import ReturnToVehicleBanner from "../components/ReturnToVehicleBanner";
import AppBackground from "../components/ui/AppBackground";
import { pageContainerClassName } from "../components/ui/uiStyles";

function AppLayout({
  activePage = "Vehicles",
  children,
  currentProfile,
  isLoggingOut = false,
  isProfileLoading = false,
  onPageChange,
  onLogout,
  onReturnToVehicle,
  profileError = "",
  returnToVehicleContext = null,
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
          onPageChange={onPageChange}
          onLogout={onLogout}
          profileError={profileError}
          showTitle={showTitle}
          title={title}
          userEmail={userEmail}
        />

        <main className="px-4 py-5 sm:px-6 lg:px-8">
          <div className={pageContainerClassName}>
            <ReturnToVehicleBanner
              context={returnToVehicleContext}
              onReturn={onReturnToVehicle}
            />
            {children}
          </div>
        </main>
      </div>
    </AppBackground>
  );
}

export default AppLayout;
