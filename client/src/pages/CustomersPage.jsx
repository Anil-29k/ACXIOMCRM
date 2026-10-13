
import { useEffect, useState } from "react";
import api from "../api/axios";

export default function CustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState({
    customerName: "",
    email: "",
    phone: "",
    companyName: "",
  });

  async function loadCustomers() {
    try {
      setError("");
      const { data } = await api.get("/customers", {
        params: { search },
      });
      setCustomers(data);
    } catch (err) {
      setError(err.response?.data?.message || "Could not load customers");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(loadCustomers, 250);
    return () => clearTimeout(timer);
  }, [search]);

  async function addCustomer(e) {
    e.preventDefault();
    try {
      setError("");
      await api.post("/customers", customer);
      setCustomer({
        customerName: "",
        email: "",
        phone: "",
        companyName: "",
      });
      await loadCustomers();
    } catch (err) {
      setError(err.response?.data?.message || "Could not save customer");
    }
  }

  async function deleteCustomer(id) {
    if (!window.confirm("Delete this customer?")) return;

    try {
      setError("");
      await api.delete(`/customers/${id}`);
      await loadCustomers();
    } catch (err) {
      setError(err.response?.data?.message || "Delete failed");
    }
  }

  return (
    <section>
      <div className="mb-4">
        <h2>Customers</h2>
        <p className="text-secondary mb-0">
          Manage your customer relationships.
        </p>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="panel mb-4">
        <h5>Add Customer</h5>

        <form onSubmit={addCustomer}>
          <div className="row g-3 mt-1">
            <div className="col-md-6">
              <input
                className="form-control"
                placeholder="Customer name"
                required
                maxLength={100}
                value={customer.customerName}
                onChange={(e) =>
                  setCustomer({ ...customer, customerName: e.target.value })
                }
              />
            </div>

            <div className="col-md-6">
              <input
                className="form-control"
                type="email"
                placeholder="Email"
                required
                value={customer.email}
                onChange={(e) =>
                  setCustomer({ ...customer, email: e.target.value })
                }
              />
            </div>

            <div className="col-md-6">
              <input
                className="form-control"
                placeholder="10-digit mobile"
                required
                pattern="[6-9][0-9]{9}"
                value={customer.phone}
                onChange={(e) =>
                  setCustomer({ ...customer, phone: e.target.value })
                }
              />
            </div>

            <div className="col-md-6">
              <input
                className="form-control"
                placeholder="Company name"
                value={customer.companyName}
                onChange={(e) =>
                  setCustomer({ ...customer, companyName: e.target.value })
                }
              />
            </div>

            <div className="col-12">
              <button className="btn btn-primary" type="submit">
                + Save Customer
              </button>
            </div>
          </div>
        </form>
      </div>

      <div className="panel">
        <div className="d-flex flex-wrap gap-2 justify-content-between mb-3">
          <h5>Customer List</h5>
          <input
            className="form-control search-box"
            placeholder="Search customers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {loading ? (
          <p>Loading customers...</p>
        ) : (
          <div className="table-responsive">
            <table className="table align-middle">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Company</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c._id}>
                    <td>{c.customerName}</td>
                    <td>{c.email}</td>
                    <td>{c.phone}</td>
                    <td>{c.companyName || "—"}</td>
                    <td>
                      <span className="badge text-bg-success">
                        {c.status}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-sm btn-outline-danger"
                        onClick={() => deleteCustomer(c._id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {customers.length === 0 && (
                  <tr>
                    <td colSpan="6" className="text-center text-secondary">
                      No customers found.
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
