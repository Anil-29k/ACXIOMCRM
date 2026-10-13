const stats = [
  { key: "customers", label: "Total Customers", icon: "C", tone: "blue" },
  { key: "leads", label: "Total Leads", icon: "L", tone: "violet" },
  { key: "opportunities", label: "Opportunities", icon: "O", tone: "orange" },
  { key: "pipelineValue", label: "Pipeline Value", icon: "₹", tone: "green" },
];

export default function DashboardPage({ user, customerCount = 0, leadCount = 0, opportunityCount = 0, pipelineValue = 0, leadByStatus = {}, opportunityByStage = {} }) {
  const values = { customers: customerCount, leads: leadCount, opportunities: opportunityCount, pipelineValue: `₹${Number(pipelineValue).toLocaleString("en-IN")}` };
  return <section>
    <div className="page-heading"><div><div className="eyebrow">OVERVIEW</div><h2>Good to see you, {user?.name?.split(" ")[0] || "there"}</h2><p className="text-secondary">Here is what is happening across your sales workspace.</p></div><span className="role-badge">{user?.role === "SalesExecutive" ? "Sales Executive" : user?.role || "User"}</span></div>
    <div className="row g-3">{stats.map(stat => <div className="col-6 col-xl-3" key={stat.key}><div className="stat-card"><div className={`stat-icon ${stat.tone}`}>{stat.icon}</div><div><p>{stat.label}</p><h3>{values[stat.key]}</h3></div><span className="stat-trend">Live</span></div></div>)}</div>
    <div className="row g-3 mt-1"><div className="col-lg-8"><div className="panel welcome-panel"><div><div className="eyebrow">ACXIOMCRM WORKSPACE</div><h4>Keep your pipeline moving</h4><p className="text-secondary">Manage customers, qualify leads, plan follow-ups, and turn opportunities into closed business.</p></div><div className="welcome-orb">↗</div></div></div><div className="col-lg-4"><div className="panel quick-panel"><div className="eyebrow">YOUR ACCESS</div><h5>{user?.role === "Admin" ? "Full administration" : user?.role === "Manager" ? "Team workspace" : "Assigned workspace"}</h5><p className="text-secondary mb-0">Your dashboard and records are protected by role-based access.</p></div></div></div>
    <div className="row g-3 mt-1"><div className="col-lg-6"><div className="panel chart-panel"><div className="eyebrow">LEAD STATUS</div><h5>Lead funnel</h5>{["New", "Contacted", "Qualified", "Unqualified", "Converted", "Lost"].map(status => <div className="bar-row" key={status}><span>{status}</span><div className="bar-track"><i style={{ width: `${Math.min(100, (leadByStatus[status] || 0) * 18)}%` }} /></div><b>{leadByStatus[status] || 0}</b></div>)}</div></div><div className="col-lg-6"><div className="panel chart-panel"><div className="eyebrow">OPPORTUNITY PIPELINE</div><h5>Pipeline by stage</h5>{["Qualification", "Needs Analysis", "Proposal", "Negotiation", "Won", "Lost"].map(stage => <div className="bar-row" key={stage}><span>{stage}</span><div className="bar-track"><i className="pipeline-bar" style={{ width: `${Math.min(100, (opportunityByStage[stage] || 0) * 18)}%` }} /></div><b>{opportunityByStage[stage] || 0}</b></div>)}</div></div></div>
  </section>;
}
