
import { useState } from "react";
import api from "../api/axios";

export default function LoginPage({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setMessage("");
    setLoading(true);

    try {
      if (mode === "register") {
        await api.post("/auth/register", form);
        setMode("login");
        setForm({ name: "", email: form.email, password: "" });
        setMessage("Registration successful. Please log in.");
      } else {
        const { data } = await api.post("/auth/login", {
          email: form.email,
          password: form.password,
        });

        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        onLogin(data);
      }
    } catch (error) {
      setMessage(
        error.response?.data?.message || "Request failed. Check the server."
      );
    } finally {
      setLoading(false);
    }
  }

  function toggleMode() {
    setMode(mode === "login" ? "register" : "login");
    setMessage("");
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="brand-mark">A</div>

        <h2>AcxiomCRM</h2>
        <p className="text-secondary">
          Customer relationship management
        </p>

        {message && (
          <div className="alert alert-info">{message}</div>
        )}

        {mode === "register" && (
          <input
            className="form-control mb-3"
            name="name"
            placeholder="Full name"
            value={form.name}
            onChange={handleChange}
            required
          />
        )}

        <input
          className="form-control mb-3"
          type="email"
          name="email"
          placeholder="Email address"
          value={form.email}
          onChange={handleChange}
          required
        />

        <input
          className="form-control mb-3"
          type="password"
          name="password"
          placeholder="Password (8+ characters)"
          minLength={8}
          value={form.password}
          onChange={handleChange}
          required
        />

        <button
          className="btn btn-primary w-100"
          type="submit"
          disabled={loading}
        >
          {loading
            ? "Please wait..."
            : mode === "login"
              ? "Sign in"
              : "Create account"}
        </button>

        <button
          type="button"
          className="btn btn-link w-100 mt-2"
          onClick={toggleMode}
        >
          {mode === "login"
            ? "Create an account"
            : "Back to login"}
        </button>
      </form>
    </div>
  );
}
