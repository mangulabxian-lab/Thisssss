// src/pages/Login.jsx - VisionProctor Login Page (Tailwind + CCS Logo)
import { useState, useEffect } from "react";
import api from "../lib/api";
import { useNavigate, Link, useSearchParams } from "react-router-dom";

// Correct imports from your assets folder
import bgImage from "../assets/ccs-bg.jpg";
import logo from "../assets/logo.png";

export default function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const errorParam = searchParams.get("error");
    if (errorParam) setError(decodeURIComponent(errorParam));
  }, [searchParams]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (error) setError("");
  };

  const handleGoogleLogin = () => {
    try {
      const backendUrl = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
      window.location.href = `${backendUrl}/auth/google`;
    } catch {
      setError("Google login unavailable.");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (!form.email.endsWith("@gmail.com")) {
        setError("❌ Only Gmail accounts are allowed.");
        setLoading(false);
        return;
      }

      const res = await api.post("/auth/login", form);
      const { token, user } = res.data;

      localStorage.setItem("token", token);
      localStorage.setItem("userName", user.name);
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center bg-cover bg-center bg-no-repeat relative p-4"
      style={{ backgroundImage: `url(${bgImage})` }}
    >
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm"></div>

      {/* Main Card */}
      <div className="relative z-10 bg-white w-full max-w-md rounded-2xl shadow-2xl p-8">

        {/* CCS Logo */}
        <img
          src={logo}
          alt="CCS Logo"
          className="w-20 h-20 mx-auto mb-3"
        />

        {/* VisionProctor Title */}
        <h2 className="text-2xl font-bold text-center text-gray-800 mb-4">
          VisionProctor
        </h2>

        {/* Page Title */}
        <h1 className="text-3xl font-semibold text-center text-gray-800 mb-6">
          Sign In
        </h1>

        {/* Google Login Button */}
        <button
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 bg-red-500 text-white py-3 rounded-lg hover:bg-red-600 transition font-semibold"
        >
          <span className="font-bold text-lg">G+</span> Continue with Google
        </button>

        <div className="flex items-center my-6">
          <div className="flex-grow h-px bg-gray-300" />
          <span className="px-3 text-gray-600 text-sm">or use email</span>
          <div className="flex-grow h-px bg-gray-300" />
        </div>

        {/* Email Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">

          <input
            type="email"
            name="email"
            placeholder="Email"
            value={form.email}
            onChange={handleChange}
            className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none"
            required
          />

          <input
            type="password"
            name="password"
            placeholder="Password"
            value={form.password}
            onChange={handleChange}
            className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none"
            required
          />

          {error && (
            <p className="bg-red-100 text-red-600 text-center py-2 rounded-lg border border-red-300">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition uppercase font-semibold"
          >
            {loading ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="text-center text-sm mt-5 text-gray-600">
          Don’t have an account?
          <button
            onClick={() => navigate("/register")}
            className="text-indigo-600 font-semibold hover:underline ml-1"
          >
            Sign Up
          </button>
        </p>
      </div>
    </div>
  );
}