
import { useCallback, useEffect, useState } from "react";
import api from "../api/axios";

export default function AuditLogsPage() {
  const [logs, setLogs] = useState([]);
  const [search, setSearch] = useState("");
  const [action, setAction] = useState("");
  const [entityName, setEntityName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await api.get("/audit-logs", {
        params: {
          search: search.trim(),
          action,
          entityName,
        },
      });

      setLogs(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      setError(
        err.response?.data?.message || "Could not load audit logs."
      );
    } finally {
      setLoading(false);
    }
  }, [search, action, entityName]);

  useEffect(() => {
    const timer = setTimeout(loadLogs, 250);
    return () => clearTimeout(timer);
  }, [loadLogs]);

  return (
    <section>
      <div className="mb-4">
        <h2>Audit Logs</h2>
        <p className="text-secondary mb-0">
          Review recorded actions and changes made in AcxiomCRM.
        </p>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="panel">
        <div className="d-flex flex-wrap gap-2 justify-content-between mb-3">
          <h5>System Activity History</h5>
          <div className="d-flex flex-wrap gap-2">
            <input
              className="form-control search-box"
              placeholder="Search logs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <select
              className="form-select"
              value={action}
              onChange={(e) => setAction(e.target.value)}
            >
              <option value="">All actions</option>
              {["REGISTER", "LOGIN", "LOGOUT", "CREATE", "UPDATE", "DELETE"].map((x) => (
                <option key={x} value={x}>{x}</option>
              ))}
            </select>

            <select
              className="form-select"
              value={entityName}
              onChange={(e) => setEntityName(e.target.value)}
            >
              <option value="">All modules</option>
              {["User", "Customer", "Lead", "Opportunity", "FollowUp", "Activity"].map((x) => (
                <option key={x} value={x}>{x}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <p>Loading audit logs...</p>
        ) : (
          <div className="table-responsive">
            <table className="table align-middle">
              <thead>
                <tr>
                  <th>Date &amp; Time</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Module</th>
                  <th>Record ID</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log._id}>
                    <td>
                      {log.createdDate
                        ? new Date(log.createdDate).toLocaleString("en-IN")
                        : log.createdAt
                          ? new Date(log.createdAt).toLocaleString("en-IN")
                          : "—"}
                    </td>
                    <td>
                      {typeof log.userId === "object" && log.userId
                        ? log.userId.name || log.userId.email || "User"
                        : "User"}
                    </td>
                    <td>
                      <span className="badge text-bg-secondary">
                        {log.action || "—"}
                      </span>
                    </td>
                    <td>{log.entityName || "—"}</td>
                    <td className="small">{log.recordId || "—"}</td>
                    <td>{log.details || "—"}</td>
                  </tr>
                ))}

                {logs.length === 0 && (
                  <tr>
                    <td colSpan="6" className="text-center text-secondary">
                      No audit records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
