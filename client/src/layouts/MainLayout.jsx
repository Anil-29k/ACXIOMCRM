export default function MainLayout({ user, activePage, onNavigate, onLogout, children }) {
  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: "D" },
    { id: "customers", label: "Customers", icon: "C" },
    { id: "leads", label: "Leads", icon: "L" },
    { id: "opportunities", label: "Opportunities", icon: "O" },
    { id: "followups", label: "Follow-ups", icon: "F" },
    { id: "activities", label: "Activities", icon: "A" },
    ...(user?.role === "Admin" || user?.role === "Manager" ? [{ id: "audit-logs", label: "Audit Logs", icon: "R" }] : []),
    ...(user?.role === "Admin" ? [{ id: "users", label: "Users & Roles", icon: "U" }] : []),
  ];

  return <div className="app-shell">
    <aside className="sidebar">
      <h4><span className="brand-dot">A</span> AcxiomCRM</h4>
      <div className="sidebar-caption">SALES OPERATIONS</div>
      <hr />
      <nav>{menuItems.map(item => <button key={item.id} type="button" className={`nav-item ${activePage === item.id ? "active" : ""}`} onClick={() => onNavigate(item.id)}><span>{item.icon}</span>{item.label}</button>)}</nav>
      <div className="mt-auto user-panel">
        <div className="user-avatar">{user?.name?.charAt(0)?.toUpperCase() || "U"}</div>
        <div className="user-details"><strong>{user?.name}</strong><small>{user?.role === "SalesExecutive" ? "Sales Executive" : user?.role}</small></div>
        <button className="btn btn-outline-light btn-sm logout-button" onClick={onLogout}>Logout</button>
      </div>
    </aside>
    <main className="main-content">{children}</main>
  </div>;
}
