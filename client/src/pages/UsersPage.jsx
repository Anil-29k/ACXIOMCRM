import { useEffect, useState } from "react";
import api from "../api/axios";

const emptyForm = { name: "", email: "", password: "", role: "SalesExecutive" };

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  async function loadUsers() {
    try { setUsers((await api.get("/users")).data); }
    catch (err) { setError(err.response?.data?.message || "Could not load users"); }
  }
  useEffect(() => { loadUsers(); }, []);
  async function createUser(event) {
    event.preventDefault(); setError(""); setSuccess("");
    try { await api.post("/users", form); setForm(emptyForm); setSuccess("User created successfully."); await loadUsers(); }
    catch (err) { setError(err.response?.data?.message || "Could not create user"); }
  }
  async function toggleUser(user) {
    try { await api.patch(`/users/${user._id}`, { isActive: !user.isActive }); await loadUsers(); }
    catch (err) { setError(err.response?.data?.message || "Could not update user"); }
  }
  return <section>
    <div className="mb-4"><h2>User &amp; Role Management</h2><p className="text-secondary mb-0">Create accounts and control access without exposing password hashes.</p></div>
    {error && <div className="alert alert-danger">{error}</div>}{success && <div className="alert alert-success">{success}</div>}
    <div className="panel mb-4"><h5>Create User</h5><form onSubmit={createUser}><div className="row g-3 mt-1">
      <div className="col-md-3"><input className="form-control" placeholder="Full name" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
      <div className="col-md-3"><input className="form-control" type="email" placeholder="Email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
      <div className="col-md-3"><input className="form-control" type="password" minLength={8} placeholder="Temporary password" required value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} /></div>
      <div className="col-md-2"><select className="form-select" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}><option value="Admin">Admin</option><option value="Manager">Manager</option><option value="SalesExecutive">Sales Executive</option></select></div>
      <div className="col-md-1"><button className="btn btn-primary w-100" type="submit">Add</button></div>
    </div></form></div>
    <div className="panel"><h5>Accounts</h5><div className="table-responsive"><table className="table align-middle"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Action</th></tr></thead><tbody>
      {users.map(user => <tr key={user._id}><td>{user.name}</td><td>{user.email}</td><td>{user.role === "SalesExecutive" ? "Sales Executive" : user.role}</td><td><span className={`badge ${user.isActive ? "text-bg-success" : "text-bg-secondary"}`}>{user.isActive ? "Active" : "Inactive"}</span></td><td><button className="btn btn-sm btn-outline-secondary" onClick={() => toggleUser(user)}>{user.isActive ? "Deactivate" : "Activate"}</button></td></tr>)}
      {!users.length && <tr><td colSpan="5" className="text-center text-secondary">No users found.</td></tr>}
    </tbody></table></div></div>
  </section>;
}
