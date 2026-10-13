
const stats = [
  { key: "customers", label: "Total Customers", icon: "♙" },
  { key: "leads", label: "Total Leads", icon: "◎" },
  { key: "opportunities", label: "Opportunities", icon: "↗" },
  { key: "pipelineValue", label: "Pipeline Value", icon: "₹" },
];

export default function DashboardPage({
  user,
  customerCount = 0,
  leadCount = 0,
  opportunityCount = 0,
  pipelineValue = 0,
}) {
  const values = {
    customers: customerCount,
    leads: leadCount,
    opportunities: opportunityCount,
    pipelineValue: `₹${Number(pipelineValue).toLocaleString("en-IN")}`,
  };

  return (
    <section>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2>Dashboard</h2>
          <p className="text-secondary mb-0">
            Welcome back, {user?.name || "User"}
          </p>
        </div>

        <span className="badge text-bg-primary">
          {user?.role || "User"}
        </span>
      </div>

      <div className="row g-3">
        {stats.map((stat) => (
          <div className="col-6 col-xl-3" key={stat.key}>
            <div className="stat-card">
              <p>
                <span className="me-2">{stat.icon}</span>
                {stat.label}
              </p>
              <h3>{values[stat.key]}</h3>
            </div>
          </div>
        ))}
      </div>

      <div className="panel mt-4">
        <h5>Getting started</h5>
        <p className="text-secondary mb-0">
          Manage your customers, track leads, and monitor sales
          opportunities from AcxiomCRM.
        </p>
      </div>
    </section>
  );
}
