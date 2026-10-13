
import { useEffect, useState } from "react";
import api from "../api/axios";

const emptyLead = {
  leadName: "",
  email: "",
  phone: "",
  companyName: "",
  source: "Website",
  status: "New",
  expectedValue: 0,
};

const statuses = ["New", "Contacted", "Qualified", "Lost", "Converted"];
const sources = ["Website", "Referral", "Social Media", "Cold Call", "Other"];

export default function LeadsPage() {
  const [leads, setLeads] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lead, setLead] = useState({ ...emptyLead });
  const [editingId, setEditingId] = useState(null);

  async function loadLeads() {
    try {
      setError("");
      const { data } = await api.get("/leads", {
        params: { search, status: statusFilter },
      });
      setLeads(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.response?.data?.message || "Could not load leads");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(loadLeads, 250);
    return () => clearTimeout(timer);
  }, [search, statusFilter]);

  function updateLead(e) {
    setLead((current) => ({
      ...current,
      [e.target.name]: e.target.value,
    }));
  }

  function startEdit(item) {
    setEditingId(item._id);
    setLead({
      leadName: item.leadName || "",
      email: item.email || "",
      phone: item.phone || "",
      companyName: item.companyName || "",
      source: item.source || "Website",
      status: item.status || "New",
      expectedValue: item.expectedValue ?? 0,
    });
    setError("");
    setSuccess("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setLead({ ...emptyLead });
    setError("");
  }

  async function saveLead(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const payload = {
        ...lead,
        leadName: lead.leadName.trim(),
        email: lead.email.trim(),
        phone: lead.phone.trim(),
        companyName: lead.companyName.trim(),
        expectedValue: Number(lead.expectedValue),
      };

      if (!/^[6-9]\d{9}$/.test(payload.phone)) {
        throw new Error("Enter a valid 10-digit Indian mobile number.");
      }

      if (payload.expectedValue < 0 || !Number.isFinite(payload.expectedValue)) {
        throw new Error("Expected value must be a valid non-negative number.");
      }

      if (editingId) {
        await api.put(`/leads/${editingId}`, payload);
        setSuccess("Lead updated successfully.");
      } else {
        await api.post("/leads", payload);
        setSuccess("Lead created successfully.");
      }

      setLead({ ...emptyLead });
      setEditingId(null);
      await loadLeads();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Could not save lead"
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteLead(id) {
    if (!window.confirm("Delete this lead? This action cannot be undone.")) {
      return;
    }

    try {
      setError("");
      setSuccess("");
      await api.delete(`/leads/${id}`);
      setSuccess("Lead deleted successfully.");
      if (editingId === id) cancelEdit();
      await loadLeads();
    } catch (err) {
      setError(err.response?.data?.message || "Could not delete lead");
    }
  }

  return (
    <section>
      <div className="mb-4">
        <h2>Lead Management</h2>
        <p className="text-secondary mb-0">
          Track prospective customers, lead status and expected sales value.
        </p>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="panel mb-4">
        <h5>{editingId ? "Edit Lead" : "Add Lead"}</h5>

        <form onSubmit={saveLead}>
          <div className="row g-3 mt-1">
            <div className="col-md-6">
              <label className="form-label">Lead name *</label>
              <input
                className="form-control"
                name="leadName"
                value={lead.leadName}
                onChange={updateLead}
                required
                maxLength={100}
              />
            </div>

            <div className="col-md-6">
              <label className="form-label">Email</label>
              <input
                className="form-control"
                name="email"
                type="email"
                value={lead.email}
                onChange={updateLead}
                maxLength={150}
              />
            </div>

            <div className="col-md-6">
              <label className="form-label">Phone *</label>
              <input
                className="form-control"
                name="phone"
                type="tel"
                value={lead.phone}
                onChange={updateLead}
                required
                pattern="[6-9][0-9]{9}"
                title="Enter a valid 10-digit Indian mobile number"
                maxLength={10}
              />
            </div>

            <div className="col-md-6">
              <label className="form-label">Company</label>
              <input
                className="form-control"
                name="companyName"
                value={lead.companyName}
                onChange={updateLead}
                maxLength={150}
              />
            </div>

            <div className="col-md-4">
              <label className="form-label">Source</label>
              <select
                className="form-select"
                name="source"
                value={lead.source}
                onChange={updateLead}
              >
                {sources.map((source) => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-4">
              <label className="form-label">Status</label>
              <select
                className="form-select"
                name="status"
                value={lead.status}
                onChange={updateLead}
              >
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-4">
              <label className="form-label">Expected value (₹)</label>
              <input
                className="form-control"
                type="number"
                name="expectedValue"
                min="0"
                step="0.01"
                value={lead.expectedValue}
                onChange={updateLead}
                required
              />
            </div>

            <div className="col-12 d-flex flex-wrap gap-2">
              <button
                className="btn btn-primary"
                type="submit"
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Update Lead"
                    : "+ Save Lead"}
              </button>

              {editingId && (
                <button
                  className="btn btn-outline-secondary"
                  type="button"
                  onClick={cancelEdit}
                  disabled={saving}
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        </form>
      </div>

      <div className="panel">
        <div className="d-flex flex-wrap gap-2 justify-content-between mb-3">
          <h5>Lead List ({leads.length})</h5>

          <div className="d-flex flex-wrap gap-2">
            <input
              className="form-control search-box"
              placeholder="Search leads..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <select
              className="form-select"
              style={{ width: "auto", minWidth: "140px" }}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All statuses</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <p>Loading leads...</p>
        ) : (
          <div className="table-responsive">
            <table className="table align-middle">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Company</th>
                  <th>Phone</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th>Value</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {leads.map((item) => (
                  <tr key={item._id}>
                    <td>
                      <div className="fw-semibold">{item.leadName}</div>
                      <small className="text-secondary">
                        {item.email || "No email"}
                      </small>
                    </td>
                    <td>{item.companyName || "—"}</td>
                    <td>{item.phone}</td>
                    <td>{item.source}</td>
                    <td>
                      <span className="badge text-bg-info">
                        {item.status}
                      </span>
                    </td>
                    <td>
                      ₹
                      {Number(item.expectedValue || 0).toLocaleString(
                        "en-IN"
                      )}
                    </td>
                    <td>
                      <div className="d-flex gap-2">
                        <button
                          className="btn btn-sm btn-outline-primary"
                          onClick={() => startEdit(item)}
                          type="button"
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => deleteLead(item._id)}
                          type="button"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {leads.length === 0 && (
                  <tr>
                    <td colSpan="7" className="text-center text-secondary">
                      No leads found. Add your first lead above.
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
