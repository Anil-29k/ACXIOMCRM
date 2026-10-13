
import { useEffect, useState } from "react";
import api from "../api/axios";

const emptyOpportunity = {
  name: "",
  customer: "",
  stage: "Qualification",
  amount: "",
  probability: 20,
  expectedCloseDate: "",
  description: "",
};

const stages = [
  "Qualification",
  "Needs Analysis",
  "Proposal",
  "Negotiation",
  "Won",
  "Lost",
];

export default function OpportunitiesPage() {
  const [opportunities, setOpportunities] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [opportunity, setOpportunity] = useState({ ...emptyOpportunity });
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadData() {
    setLoading(true);
    try {
      setError("");
      const [opportunityResponse, customerResponse] = await Promise.all([
        api.get("/opportunities", {
          params: { search, stage: stageFilter },
        }),
        api.get("/customers"),
      ]);

      setOpportunities(
        Array.isArray(opportunityResponse.data)
          ? opportunityResponse.data
          : opportunityResponse.data.opportunities || []
      );

      setCustomers(
        Array.isArray(customerResponse.data)
          ? customerResponse.data
          : customerResponse.data.customers || []
      );
    } catch (err) {
      setError(
        err.response?.data?.message || "Could not load opportunities"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(loadData, 250);
    return () => clearTimeout(timer);
  }, [search, stageFilter]);

  function updateField(e) {
    const { name, value } = e.target;
    setOpportunity((current) => ({
      ...current,
      [name]: value,
      ...(name === "stage" && value === "Won" ? { probability: 100 } : {}),
      ...(name === "stage" && value === "Lost" ? { probability: 0 } : {}),
    }));
  }

  function startEdit(item) {
    setEditingId(item._id);
    setOpportunity({
      name: item.name || "",
      customer:
        typeof item.customer === "object"
          ? item.customer?._id || ""
          : item.customer || "",
      stage: item.stage || "Qualification",
      amount: item.amount ?? "",
      probability: item.probability ?? 20,
      expectedCloseDate: item.expectedCloseDate
        ? new Date(item.expectedCloseDate).toISOString().slice(0, 10)
        : "",
      description: item.description || "",
    });
    setError("");
    setSuccess("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setOpportunity({ ...emptyOpportunity });
    setError("");
  }

  async function saveOpportunity(e) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    try {
      const amount = Number(opportunity.amount);
      const probability = Number(opportunity.probability);

      if (!opportunity.customer) {
        throw new Error("Please select a customer.");
      }
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Amount must be greater than zero.");
      }
      if (!Number.isFinite(probability) || probability < 0 || probability > 100) {
        throw new Error("Probability must be between 0 and 100.");
      }
      if (!opportunity.expectedCloseDate) {
        throw new Error("Please select an expected close date.");
      }

      if (
        !["Won", "Lost"].includes(opportunity.stage) &&
        opportunity.expectedCloseDate < new Date().toISOString().slice(0, 10)
      ) {
        throw new Error("Expected close date cannot be in the past.");
      }

      const payload = {
        ...opportunity,
        name: opportunity.name.trim(),
        amount,
        probability,
        customer: opportunity.customer,
      };

      if (!payload.name) throw new Error("Opportunity name is required.");

      if (editingId) {
        await api.put(`/opportunities/${editingId}`, payload);
        setSuccess("Opportunity updated successfully.");
      } else {
        await api.post("/opportunities", payload);
        setSuccess("Opportunity created successfully.");
      }

      setOpportunity({ ...emptyOpportunity });
      setEditingId(null);
      await loadData();
    } catch (err) {
      setError(
        err.response?.data?.message || err.message || "Could not save opportunity"
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteOpportunity(id) {
    if (!window.confirm("Delete this opportunity?")) return;

    try {
      setError("");
      setSuccess("");
      await api.delete(`/opportunities/${id}`);
      setSuccess("Opportunity deleted successfully.");
      if (editingId === id) cancelEdit();
      await loadData();
    } catch (err) {
      setError(
        err.response?.data?.message || "Could not delete opportunity"
      );
    }
  }

  const pipelineValue = opportunities
    .filter((item) => !["Won", "Lost"].includes(item.stage))
    .reduce((total, item) => total + Number(item.amount || 0), 0);

  const weightedPipeline = opportunities
    .filter((item) => !["Won", "Lost"].includes(item.stage))
    .reduce(
      (total, item) =>
        total +
        (Number(item.amount || 0) * Number(item.probability || 0)) / 100,
      0
    );

  function customerName(item) {
    if (item.customer && typeof item.customer === "object") {
      return item.customer.customerName || item.customer.name || "Customer";
    }
    return customers.find((c) => c._id === item.customer)?.customerName || "—";
  }

  return (
    <section>
      <div className="mb-4">
        <h2>Opportunity Management</h2>
        <p className="text-secondary mb-0">
          Manage deals, sales stages and pipeline forecasts.
        </p>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="row g-3 mb-4">
        <div className="col-md-6">
          <div className="panel h-100">
            <div className="text-secondary">Open pipeline value</div>
            <h3>₹{pipelineValue.toLocaleString("en-IN")}</h3>
          </div>
        </div>
        <div className="col-md-6">
          <div className="panel h-100">
            <div className="text-secondary">Weighted pipeline value</div>
            <h3>₹{weightedPipeline.toLocaleString("en-IN", {
              maximumFractionDigits: 2,
            })}</h3>
          </div>
        </div>
      </div>

      <div className="panel mb-4">
        <h5>{editingId ? "Edit Opportunity" : "Add Opportunity"}</h5>

        <form onSubmit={saveOpportunity}>
          <div className="row g-3 mt-1">
            <div className="col-md-6">
              <label className="form-label">Opportunity name *</label>
              <input
                className="form-control"
                name="name"
                value={opportunity.name}
                onChange={updateField}
                required
                maxLength={150}
              />
            </div>

            <div className="col-md-6">
              <label className="form-label">Customer *</label>
              <select
                className="form-select"
                name="customer"
                value={opportunity.customer}
                onChange={updateField}
                required
              >
                <option value="">Select customer</option>
                {customers.map((customer) => (
                  <option key={customer._id} value={customer._id}>
                    {customer.customerName}
                    {customer.companyName ? ` — ${customer.companyName}` : ""}
                  </option>
                ))}
              </select>
              {customers.length === 0 && (
                <small className="text-secondary">
                  Add a customer before creating an opportunity.
                </small>
              )}
            </div>

            <div className="col-md-4">
              <label className="form-label">Stage *</label>
              <select
                className="form-select"
                name="stage"
                value={opportunity.stage}
                onChange={updateField}
              >
                {stages.map((stage) => (
                  <option key={stage} value={stage}>{stage}</option>
                ))}
              </select>
            </div>

            <div className="col-md-4">
              <label className="form-label">Amount (₹) *</label>
              <input
                className="form-control"
                type="number"
                name="amount"
                min="0.01"
                step="0.01"
                value={opportunity.amount}
                onChange={updateField}
                required
              />
            </div>

            <div className="col-md-4">
              <label className="form-label">Probability (%) *</label>
              <input
                className="form-control"
                type="number"
                name="probability"
                min="0"
                max="100"
                value={opportunity.probability}
                onChange={updateField}
                required
              />
            </div>

            <div className="col-md-6">
              <label className="form-label">Expected close date *</label>
              <input
                className="form-control"
                type="date"
                name="expectedCloseDate"
                value={opportunity.expectedCloseDate}
                onChange={updateField}
                required
              />
            </div>

            <div className="col-12">
              <label className="form-label">Description / notes</label>
              <textarea
                className="form-control"
                name="description"
                rows="2"
                maxLength={1000}
                value={opportunity.description}
                onChange={updateField}
              />
            </div>

            <div className="col-12 d-flex gap-2">
              <button
                className="btn btn-primary"
                type="submit"
                disabled={saving || customers.length === 0}
              >
                {saving
                  ? "Saving..."
                  : editingId
                    ? "Update Opportunity"
                    : "+ Save Opportunity"}
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
          <h5>Sales Pipeline ({opportunities.length})</h5>
          <div className="d-flex flex-wrap gap-2">
            <input
              className="form-control search-box"
              placeholder="Search opportunities..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select
              className="form-select"
              style={{ width: "auto", minWidth: "150px" }}
              value={stageFilter}
              onChange={(e) => setStageFilter(e.target.value)}
            >
              <option value="">All stages</option>
              {stages.map((stage) => (
                <option key={stage} value={stage}>{stage}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <p>Loading opportunities...</p>
        ) : (
          <div className="table-responsive">
            <table className="table align-middle">
              <thead>
                <tr>
                  <th>Opportunity</th>
                  <th>Customer</th>
                  <th>Stage</th>
                  <th>Amount</th>
                  <th>Probability</th>
                  <th>Close date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {opportunities.map((item) => (
                  <tr key={item._id}>
                    <td>
                      <div className="fw-semibold">{item.name}</div>
                      <small className="text-secondary">
                        {item.description || "No notes"}
                      </small>
                    </td>
                    <td>{customerName(item)}</td>
                    <td>
                      <span className="badge text-bg-info">{item.stage}</span>
                    </td>
                    <td>₹{Number(item.amount || 0).toLocaleString("en-IN")}</td>
                    <td>{item.probability ?? 0}%</td>
                    <td>
                      {item.expectedCloseDate
                        ? new Date(item.expectedCloseDate).toLocaleDateString("en-IN")
                        : "—"}
                    </td>
                    <td>
                      <div className="d-flex gap-2">
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
                          onClick={() => deleteOpportunity(item._id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {opportunities.length === 0 && (
                  <tr>
                    <td colSpan="7" className="text-center text-secondary">
                      No opportunities found. Create your first opportunity above.
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
