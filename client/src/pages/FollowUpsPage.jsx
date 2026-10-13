
import { useCallback, useEffect, useState } from "react";
import api from "../api/axios";

const emptyFollowUp = {
  title: "",
  description: "",
  type: "Call",
  dueDate: "",
  status: "Pending",
  priority: "Medium",
  customer: "",
  lead: "",
  opportunity: "",
};

const types = ["Call", "Email", "Meeting", "Task", "Other"];
const statuses = ["Pending", "Completed", "Missed", "Cancelled"];
const priorities = ["Low", "Medium", "High"];

function getId(value) {
  if (!value) return "";
  return typeof value === "object" ? value._id || "" : value;
}

function getErrorMessage(error, fallback) {
  return error.response?.data?.message || error.message || fallback;
}

export default function FollowUpsPage() {
  const [followUps, setFollowUps] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [leads, setLeads] = useState([]);
  const [opportunities, setOpportunities] = useState([]);

  const [followUp, setFollowUp] = useState({ ...emptyFollowUp });
  const [editingId, setEditingId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [f, c, l, o] = await Promise.all([
        api.get("/followups", {
          params: { search: search.trim(), status: statusFilter },
        }),
        api.get("/customers"),
        api.get("/leads"),
        api.get("/opportunities"),
      ]);

      const followUpData = f.data;
      const customerData = c.data;
      const leadData = l.data;
      const opportunityData = o.data;

      setFollowUps(
        Array.isArray(followUpData)
          ? followUpData
          : followUpData.followUps || []
      );

      setCustomers(
        Array.isArray(customerData)
          ? customerData
          : customerData.customers || []
      );

      setLeads(
        Array.isArray(leadData) ? leadData : leadData.leads || []
      );

      setOpportunities(
        Array.isArray(opportunityData)
          ? opportunityData
          : opportunityData.opportunities || []
      );
    } catch (err) {
      setError(getErrorMessage(err, "Could not load follow-ups."));
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(() => loadData(), 250);
    return () => clearTimeout(timer);
  }, [loadData]);

  function updateField(e) {
    const { name, value } = e.target;

    setFollowUp((current) => {
      const next = { ...current, [name]: value };

      // Only one related record is permitted.
      if (value && name === "customer") {
        next.lead = "";
        next.opportunity = "";
      } else if (value && name === "lead") {
        next.customer = "";
        next.opportunity = "";
      } else if (value && name === "opportunity") {
        next.customer = "";
        next.lead = "";
      }

      return next;
    });
  }

  function startEdit(item) {
    const customer = getId(item.customer);
    const lead = getId(item.lead);
    const opportunity = getId(item.opportunity);

    // Keep at most one relationship if an older record is invalid.
    let selectedCustomer = customer;
    let selectedLead = lead;
    let selectedOpportunity = opportunity;

    if (selectedCustomer) {
      selectedLead = "";
      selectedOpportunity = "";
    } else if (selectedLead) {
      selectedOpportunity = "";
    }

    setEditingId(item._id);
    setFollowUp({
      title: item.title || "",
      description: item.description || "",
      type: item.type || "Call",
      dueDate: item.dueDate
        ? new Date(item.dueDate).toISOString().slice(0, 16)
        : "",
      status: item.status || "Pending",
      priority: item.priority || "Medium",
      customer: selectedCustomer,
      lead: selectedLead,
      opportunity: selectedOpportunity,
    });

    setError("");
    setSuccess("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setFollowUp({ ...emptyFollowUp });
    setError("");
    setSuccess("");
  }

  async function saveFollowUp(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (saving) return;
    setSaving(true);

    try {
      if (!followUp.title.trim()) {
        throw new Error("Subject is required.");
      }

      if (!followUp.dueDate) {
        throw new Error("Please select a follow-up date and time.");
      }

      const selectedDate = new Date(followUp.dueDate);

      if (Number.isNaN(selectedDate.getTime())) {
        throw new Error("Please enter a valid date and time.");
      }

      const payload = {
        title: followUp.title.trim(),
        description: followUp.description.trim(),
        type: followUp.type,
        dueDate: selectedDate.toISOString(),
        status: followUp.status,
        priority: followUp.priority,
        customer: followUp.customer || null,
        lead: followUp.lead || null,
        opportunity: followUp.opportunity || null,
      };

      const linkedRecords = [
        payload.customer,
        payload.lead,
        payload.opportunity,
      ].filter(Boolean);

      if (linkedRecords.length > 1) {
        throw new Error("Select only one related record.");
      }

      if (editingId) {
        await api.put(`/followups/${editingId}`, payload);
        setSuccess("Follow-up updated successfully.");
      } else {
        await api.post("/followups", payload);
        setSuccess("Follow-up scheduled successfully.");
      }

      setEditingId(null);
      setFollowUp({ ...emptyFollowUp });
      await loadData();
    } catch (err) {
      setError(getErrorMessage(err, "Could not save follow-up."));
    } finally {
      setSaving(false);
    }
  }

  async function completeFollowUp(item) {
    setError("");
    setSuccess("");

    try {
      // Send only the field being changed. The backend retains
      // the existing relationship and other follow-up fields.
      await api.put(`/followups/${item._id}`, {
        status: "Completed",
      });

      setSuccess("Follow-up marked completed.");
      await loadData();
    } catch (err) {
      setError(
        getErrorMessage(err, "Could not complete this follow-up.")
      );
    }
  }

  async function deleteFollowUp(id) {
    if (!window.confirm("Delete this follow-up?")) return;

    setError("");
    setSuccess("");

    try {
      await api.delete(`/followups/${id}`);

      setSuccess("Follow-up deleted successfully.");

      if (editingId === id) {
        setEditingId(null);
        setFollowUp({ ...emptyFollowUp });
      }

      await loadData();
    } catch (err) {
      setError(getErrorMessage(err, "Could not delete follow-up."));
    }
  }

  function relatedName(item) {
    if (item.customer) {
      if (typeof item.customer === "object") {
        return item.customer.customerName || "Customer";
      }

      return (
        customers.find((c) => c._id === item.customer)?.customerName ||
        "Customer"
      );
    }

    if (item.lead) {
      if (typeof item.lead === "object") {
        return item.lead.leadName || "Lead";
      }

      return (
        leads.find((l) => l._id === item.lead)?.leadName || "Lead"
      );
    }

    if (item.opportunity) {
      if (typeof item.opportunity === "object") {
        return item.opportunity.name || "Opportunity";
      }

      return (
        opportunities.find((o) => o._id === item.opportunity)?.name ||
        "Opportunity"
      );
    }

    return "General";
  }

  const now = Date.now();

  const pendingCount = followUps.filter(
    (item) => item.status === "Pending"
  ).length;

  const overdueCount = followUps.filter(
    (item) =>
      item.status === "Pending" &&
      new Date(item.dueDate).getTime() < now
  ).length;

  const completedCount = followUps.filter(
    (item) => item.status === "Completed"
  ).length;

  return (
    <section>
      <div className="mb-4">
        <h2>Follow-Up Management</h2>
        <p className="text-secondary mb-0">
          Schedule calls, meetings, emails and tasks for your sales pipeline.
        </p>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="row g-3 mb-4">
        <div className="col-md-4">
          <div className="panel h-100">
            <div className="text-secondary">Pending</div>
            <h3>{pendingCount}</h3>
          </div>
        </div>

        <div className="col-md-4">
          <div className="panel h-100">
            <div className="text-secondary">Overdue</div>
            <h3>{overdueCount}</h3>
          </div>
        </div>

        <div className="col-md-4">
          <div className="panel h-100">
            <div className="text-secondary">Completed</div>
            <h3>{completedCount}</h3>
          </div>
        </div>
      </div>

      <div className="panel mb-4">
        <h5>{editingId ? "Edit Follow-Up" : "Schedule Follow-Up"}</h5>

        <form onSubmit={saveFollowUp}>
          <div className="row g-3 mt-1">
            <div className="col-md-6">
              <label className="form-label">Subject *</label>
              <input
                className="form-control"
                name="title"
                value={followUp.title}
                onChange={updateField}
                maxLength={150}
                required
              />
            </div>

            <div className="col-md-6">
              <label className="form-label">Due date and time *</label>
              <input
                className="form-control"
                type="datetime-local"
                name="dueDate"
                value={followUp.dueDate}
                onChange={updateField}
                required
              />
            </div>

            <div className="col-md-4">
              <label className="form-label">Type</label>
              <select
                className="form-select"
                name="type"
                value={followUp.type}
                onChange={updateField}
              >
                {types.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div className="col-md-4">
              <label className="form-label">Priority</label>
              <select
                className="form-select"
                name="priority"
                value={followUp.priority}
                onChange={updateField}
              >
                {priorities.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-4">
              <label className="form-label">Status</label>
              <select
                className="form-select"
                name="status"
                value={followUp.status}
                onChange={updateField}
              >
                {statuses.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>

            <div className="col-md-4">
              <label className="form-label">Related customer</label>
              <select
                className="form-select"
                name="customer"
                value={followUp.customer}
                onChange={updateField}
              >
                <option value="">None</option>
                {customers.map((item) => (
                  <option key={item._id} value={item._id}>
                    {item.customerName}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-4">
              <label className="form-label">Related lead</label>
              <select
                className="form-select"
                name="lead"
                value={followUp.lead}
                onChange={updateField}
              >
                <option value="">None</option>
                {leads.map((item) => (
                  <option key={item._id} value={item._id}>
                    {item.leadName}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-md-4">
              <label className="form-label">Related opportunity</label>
              <select
                className="form-select"
                name="opportunity"
                value={followUp.opportunity}
                onChange={updateField}
              >
                <option value="">None</option>
                {opportunities.map((item) => (
                  <option key={item._id} value={item._id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-12">
              <label className="form-label">Notes</label>
              <textarea
                className="form-control"
                name="description"
                rows="2"
                maxLength={2000}
                value={followUp.description}
                onChange={updateField}
              />
            </div>

            <div className="col-12 d-flex gap-2">
              <button
                className="btn btn-primary"
                type="submit"
                disabled={saving}
              >
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Update Follow-Up"
                    : "+ Schedule Follow-Up"}
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
          <h5>Follow-Up List</h5>

          <div className="d-flex flex-wrap gap-2">
            <input
              className="form-control search-box"
              placeholder="Search follow-ups..."
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
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <p>Loading follow-ups...</p>
        ) : (
          <div className="table-responsive">
            <table className="table align-middle">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Related record</th>
                  <th>Type</th>
                  <th>Due</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {followUps.map((item) => {
                  const overdue =
                    item.status === "Pending" &&
                    new Date(item.dueDate).getTime() < now;

                  return (
                    <tr key={item._id}>
                      <td>
                        <div className="fw-semibold">{item.title}</div>
                        <small className="text-secondary">
                          {item.description || "No notes"}
                        </small>
                      </td>

                      <td>{relatedName(item)}</td>
                      <td>{item.type}</td>

                      <td>
                        {item.dueDate
                          ? new Date(item.dueDate).toLocaleString("en-IN")
                          : "—"}
                        {overdue && (
                          <div>
                            <span className="badge text-bg-danger">
                              Overdue
                            </span>
                          </div>
                        )}
                      </td>

                      <td>{item.priority}</td>
                      <td>
                        <span
                          className={`badge ${
                            item.status === "Completed"
                              ? "text-bg-success"
                              : item.status === "Cancelled"
                                ? "text-bg-secondary"
                                : "text-bg-info"
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>

                      <td>
                        <div className="d-flex flex-wrap gap-2">
                          {item.status === "Pending" && (
                            <button
                              className="btn btn-sm btn-outline-success"
                              type="button"
                              onClick={() => completeFollowUp(item)}
                            >
                              Complete
                            </button>
                          )}

                          <button
                            className="btn btn-sm btn-outline-primary"
                            type="button"
                            onClick={() => startEdit(item)}
                          >
                            Edit
                          </button>

                          <button
                            className="btn btn-sm btn-outline-danger"
                            type="button"
                            onClick={() => deleteFollowUp(item._id)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {followUps.length === 0 && (
                  <tr>
                    <td colSpan="7" className="text-center text-secondary">
                      No follow-ups found. Schedule your first follow-up above.
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
