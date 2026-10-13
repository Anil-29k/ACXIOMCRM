
export default function MainLayout({
  user,
  activePage,
  onNavigate,
  onLogout,
  children,
}) {
  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: "▦" },
    { id: "customers", label: "Customers", icon: "♙" },
    { id: "leads", label: "Leads", icon: "◎" },
    { id: "opportunities", label: "Opportunities", icon: "↗" },
    { id: "followups", label: "Follow-ups", icon: "◷" },
    { id: "activities", label: "Activities", icon: "↻" },
    { id: "auditlogs", label: "Audit Logs", icon: "📝" },
  ];

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h4>◆ AcxiomCRM</h4>
        <hr />

        <nav>
          {menuItems.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-item ${activePage === item.id ? "active" : ""
                }`}
              onClick={() => onNavigate(item.id)}
            >
              <span>{item.icon}</span> {item.label}
            </button>
          ))}
        </nav>

        <div className="mt-auto small text-white-50">
          {user?.name}
          <br />
          {user?.role}

          <button
            className="btn btn-outline-light btn-sm mt-3 w-100"
            onClick={onLogout}
          >
            Logout
          </button>
        </div>
      </aside>

      <main className="main-content">{children}</main>
    </div>
  );
}
