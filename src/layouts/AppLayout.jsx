import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";

function AppLayout({
  activePage = "Vehicles",
  children,
  onPageChange,
  title = "Vehicles",
  description = "Manage garage inventory and operations.",
}) {
  return (
    <div className="min-h-screen bg-zinc-50">
      <Sidebar
        activePage={activePage}
        onPageChange={onPageChange}
      />

      <div className="min-h-screen lg:pl-64">
        <Topbar
          activePage={activePage}
          description={description}
          onPageChange={onPageChange}
          title={title}
        />

        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
    </div>
  );
}

export default AppLayout;
