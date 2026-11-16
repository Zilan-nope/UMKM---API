import { Sidebar } from './components/layout/Sidebar';
import { Topbar } from './components/layout/Topbar';
import { AppProvider, useApp } from './context/AppContext';
import { AiAssistantPage } from './pages/AiAssistantPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { DatabasePage } from './pages/DatabasePage';
import { OverviewPage } from './pages/OverviewPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';

function MainLayout() {
  const { activePage } = useApp();

  const renderPage = () => {
    switch (activePage) {
      case 'ringkasan':
        return <OverviewPage />;
      case 'database':
        return <DatabasePage />;
      case 'analisis':
        return <AnalyticsPage />;
      case 'asisten-ai':
        return <AiAssistantPage />;
      case 'laporan':
        return <ReportsPage />;
      case 'pengaturan':
        return <SettingsPage />;
      default:
        return <OverviewPage />;
    }
  };

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar />
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-6xl w-full mx-auto">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}

export function App() {
  return (
    <AppProvider>
      <MainLayout />
    </AppProvider>
  );
}

export default App;