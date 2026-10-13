
import { useCallback, useEffect, useState } from "react";
import api from "../api/axios";

const initialForm = {
  subject: "",
  description: "",
  type: "Call",
  status: "Planned",
  priority: "Medium",
  activityDate: "",
  customer: "",
  lead: "",
  opportunity: "",
};

const types = ["Call", "Email", "Meeting", "Task", "Note", "Other"];
const statuses = ["Planned", "In Progress", "Completed", "Cancelled"];
const priorities = ["Low", "Medium", "High"];

function idOf(value) {
  return typeof value === "object" && value ? value._id : value || "";
}

function messageOf(error, fallback) {
  return error.response?.data?.message || error.message || fallback;
}

export default function ActivitiesPage() {
  const [activities, setActivities] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [leads, setLeads] = useState([]);
  const [opportunities, setOpportunities] = useState([]);
  const [form, setForm] = useState({ ...initialForm });
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      setError("");
      const [a, c, l, o] = await Promise.all([
        api.get("/activities", {
          params: { search: search.trim(), status: statusFilter },
        }),
        api.get("/customers"),
        api.get("/leads"),
        api.get("/opportunities"),
      ]);

      const unwrap = (response, key) =>
        Array.isArray(response.data)
          ? response.data
          : response.data[key] || [];

      setActivities(unwrap(a, "activities"));
      setCustomers(unwrap(c, "customers"));
      setLeads(unwrap(l, "leads"));
      setOpportunities(unwrap(o, "opportunities"));
    } catch (err) {
      setError(messageOf(err, "Could not load activities."));
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    const timer = setTimeout(loadData, 250);
    return () => clearTimeout(timer);
  }, [loadData]);

  function updateField(e) {
    const { name, value } = e.target;
    setForm((current) => {
      const next = { ...current, [name]: value };

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

  function editActivity(item) {
    let customer = idOf(item.customer);
    let lead = idOf(item.lead);
    let opportunity = idOf(item.opportunity);

    if (customer) {
      lead = "";
      opportunity = "";
    } else if (lead) {
      opportunity = "";
    }

    setEditingId(item._id);
    setForm({
      subject: item.subject || "",
      description: item.description || "",
      type: item.type || "Call",
      status: item.status || "Planned",
      priority: item.priority || "Medium",
      activityDate: item.activityDate
        ? new Date(item.activityDate).toISOString().slice(0, 16)
        : "",
      customer,
      lead,
      opportunity,
    });
    setError("");
    setSuccess("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setEditingId(null);
    setForm({ ...initialForm });
  }

  async function saveActivity(e) {
    e.preventDefault();
    if (saving) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      if (!form.subject.trim()) {
        throw new Error("Activity subject is required.");
      }
      if (!form.activityDate) {
        throw new Error("Select an activity date and time.");
      }

      const payload = {
        subject: form.subject.trim(),
        description: form.description.trim(),
        type: form.type,
        status: form.status,
        priority: form.priority,
        activityDate: new Date(form.activityDate).toISOString(),
        customer: form.customer || null,
        lead: form.lead || null,
        opportunity: form.opportunity || null,
      };

      const linked = [
        payload.customer,
        payload.lead,
        payload.opportunity,
      ].filter(Boolean);

      if (linked.length > 1) {
        throw new Error("Select only one related record.");
      }

      if (editingId) {
        await api.put(`/activities/${editingId}`, payload);
        setSuccess("Activity updated successfully.");
      } else {
        await api.post("/activities", payload);
        setSuccess("Activity created successfully.");
      }

      resetForm();
      await loadData();
    } catch (err) {
      setError(messageOf(err, "Could not save activity."));
    } finally {
      setSaving(false);
    }
  }

  async function deleteActivity(id) {
    if (!window.confirm("Delete this activity?")) return;

    setError("");
    setSuccess("");

    try {
      await api.delete(`/activities/${id}`);
      if (editingId === id) resetForm();
      setSuccess("Activity deleted successfully.");
      await loadData();
    } catch (err) {
      setError(messageOf(err, "Could not delete activity."));
    }
  }

  function relatedName(item) {
    if (item.customer) {
      return typeof item.customer === "object"
        ? item.customer.customerName || "Customer"
        : customers.find((x) => x._id === item.customer)?.customerName || "Customer";
    }
    if (item.lead) {
      return typeof item.lead === "object"
        ? item.lead.leadName || "Lead"
        : leads.find((x) => x._id === item.lead)?.leadName || "Lead";
    }
    if (item.opportunity) {
      return typeof item.opportunity === "object"
        ? item.opportunity.name || "Opportunity"
        : opportunities.find((x) => x._id === item.opportunity)?.name || "Opportunity";
    }
    return "General";
  }

  return (
    <section>
      <div className="mb-4">
        <h2>Activity Management</h2>
        <p className="text-secondary mb-0">
          Track calls, meetings, emails, tasks and sales activities.
        </p>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="panel mb-4">
        <h5>{editingId ? "Edit Activity" : "Create Activity"}</h5>

        <form onSubmit={saveActivity}>
          <div className="row g-3 mt-1">
            <div className="col-md-6">
              <label className="form-label">Subject *</label>
              <input
                className="form-control"
                name="subject"
                value={form.subject}
                onChange={updateField}
                maxLength={150}
                required
              />
            </div>

            <div className="col-md-6">
              <label className="form-label">Date and time *</label>
              <input
                className="form-control"
                type="datetime-local"
                name="activityDate"
                value={form.activityDate}
                onChange={updateField}
                required
              />
            </div>

            <div className="col-md-4">
              <label className="form-label">Type</label>
              <select className="form-select" name="type" value={form.type} onChange={updateField}>
                {types.map((x) => <option key={x}>{x}</option>)}
              </select>
            </div>

            <div className="col-md-4">
              <label className="form-label">Status</label>
              <select className="form-select" name="status" value={form.status} onChange={updateField}>
                {statuses.map((x) => <option key={x}>{x}</option>)}
              </select>
            </div>

            <div className="col-md-4">
              <label className="form-label">Priority</label>
              <select className="form-select" name="priority" value={form.priority} onChange={updateField}>
                {priorities.map((x) => <option key={x}>{x}</option>)}
              </select>
            </div>

            <div className="col-md-4">
              <label className="form-label">Customer</label>
              <select className="form-select" name="customer" value={form.customer} onChange={updateField}>
                <option value="">None</option>
                {customers.map((x) => <option key={x._id} value={x._id}>{x.customerName}</option>)}
              </select>
            </div>

            <div className="col-md-4">
              <label className="form-label">Lead</label>
              <select className="form-select" name="lead" value={form.lead} onChange={updateField}>
                <option value="">None</option>
                {leads.map((x) => <option key={x._id} value={x._id}>{x.leadName}</option>)}
              </select>
            </div>

            <div className="col-md-4">
              <label className="form-label">Opportunity</label>
              <select className="form-select" name="opportunity" value={form.opportunity} onChange={updateField}>
                <option value="">None</option>
                {opportunities.map((x) => <option key={x._id} value={x._id}>{x.name}</option>)}
              </select>
            </div>

            <div className="col-12">
              <label className="form-label">Description</label>
              <textarea
                className="form-control"
                name="description"
                rows="2"
                maxLength={2000}
                value={form.description}
                onChange={updateField}
              />
            </div>

            <div className="col-12 d-flex gap-2">
              <button className="btn btn-primary" disabled={saving}>
                {saving ? "Saving..." : editingId ? "Update Activity" : "Create Activity"}
              </button>
              {editingId && (
                <button className="btn btn-outline-secondary" type="button" onClick={resetForm}>
                  Cancel
                </button>
              )}
            </div>
          </div>
        </form>
      </div>

      <div className="panel">
        <div className="d-flex flex-wrap justify-content-between gap-2 mb-3">
          <h5>Activities</h5>
          <div className="d-flex gap-2 flex-wrap">
            <input
              className="form-control search-box"
              placeholder="Search activities..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select className="form-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="">All statuses</option>
              {statuses.map((x) => <option key={x}>{x}</option>)}
            </select>
          </div>
        </div>

        {loading ? <p>Loading activities...</p> : (
          <div className="table-responsive">
            <table className="table align-middle">
              <thead>
                <tr>
                  <th>Subject</th><th>Related record</th><th>Type</th>
                  <th>Date</th><th>Priority</th><th>Status</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {activities.map((item) => (
                  <tr key={item._id}>
                    <td>
                      <strong>{item.subject}</strong>
                      <div className="small text-secondary">{item.description || "—"}</div>
                    </td>
                    <td>{relatedName(item)}</td>
                    <td>{item.type}</td>
                    <td>{item.activityDate ? new Date(item.activityDate).toLocaleString("en-IN") : "—"}</td>
                    <td>{item.priority}</td>
                    <td>{item.status}</td>
                    <td>
                      <div className="d-flex gap-2">
                        <button className="btn btn-sm btn-outline-primary" onClick={() => editActivity(item)}>Edit</button>
                        <button className="btn btn-sm btn-outline-danger" onClick={() => deleteActivity(item._id)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {activities.length === 0 && (
                  <tr><td colSpan="7" className="text-center text-secondary">No activities found.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
