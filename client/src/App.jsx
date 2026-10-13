
import { useEffect, useState } from "react";
import api from "./api/axios";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import CustomersPage from "./pages/CustomersPage";
import LeadsPage from "./pages/LeadsPage";
import OpportunitiesPage from "./pages/OpportunitiesPage";
import FollowUpsPage from "./pages/FollowUpsPage";
import MainLayout from "./layouts/MainLayout";
import ActivitiesPage from "./pages/ActivitiesPage";
import AuditLogsPage from "./pages/AuditLogsPage";
import UsersPage from "./pages/UsersPage";
import "./App.css";
import "./theme-overrides.css";

export default function App() {
  const [token, setToken] = useState(
    () => localStorage.getItem("token") || ""
  );

  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("user")) || null;
    } catch {
      return null;
    }
  });

  const [activePage, setActivePage] = useState("dashboard");
  const [stats, setStats] = useState({
    customers: 0,
    leads: 0,
    opportunities: 0,
    pipelineValue: 0,
    leadByStatus: {},
    opportunityByStage: {},
  });

  useEffect(() => {
    if (!token || !user) return;

    let cancelled = false;

    async function loadStats() {
      try {
        const response = await api.get("/dashboard/stats");
        const data = response.data;

        if (cancelled) return;

        setStats({
          customers: data.customers?.total ?? 0,
          leads: data.leads?.total ?? 0,
          opportunities: data.opportunities?.total ?? 0,
          pipelineValue: data.opportunities?.pipelineValue ?? 0,
          leadByStatus: data.leads?.byStatus ?? {},
          opportunityByStage: data.opportunities?.byStage ?? {},
        });
      } catch (error) {
        if (!cancelled) {
          console.error(
            "Could not load dashboard statistics:",
            error.response?.data?.message || error.message
          );
        }
      }
    }

    loadStats();

    return () => {
      cancelled = true;
    };
  }, [token, user]);

  function handleLogin(data) {
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));

    setToken(data.token);
    setUser(data.user);
    setActivePage("dashboard");
  }

  function handleLogout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    setToken("");
    setUser(null);
    setActivePage("dashboard");
  }

  function renderPage() {
    switch (activePage) {
      case "customers":
        return <CustomersPage />;

      case "leads":
        return <LeadsPage />;

      case "opportunities":
        return <OpportunitiesPage />;

      case "followups":
        return <FollowUpsPage />;
      
      case "activities":
        return <ActivitiesPage />;

      case "audit-logs":
        return <AuditLogsPage />;

      case "users":
        return <UsersPage />;

      default:
        return (
          <DashboardPage
            user={user}
            customerCount={stats.customers}
            leadCount={stats.leads}
            opportunityCount={stats.opportunities}
            pipelineValue={stats.pipelineValue}
            leadByStatus={stats.leadByStatus}
            opportunityByStage={stats.opportunityByStage}
          />
        );
    }
  }

  if (!token || !user) {
    return <LoginPage onLogin={handleLogin} />;
  }

  return (
    <MainLayout
      user={user}
      activePage={activePage}
      onNavigate={setActivePage}
      onLogout={handleLogout}
    >
      {renderPage()}
    </MainLayout>
  );
}
