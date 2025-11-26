// src/pages/Register.jsx - VisionProctor Register Page (Tailwind + CCS Logo)
import { useState, useRef, useEffect } from "react";
import api from "../lib/api";
import { useNavigate } from "react-router-dom";

// Correct imports
import bgImage from "../assets/ccs-bg.jpg";
import logo from "../assets/logo.png";

export default function Register() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    username: "",
    password: "",
    course: "",
    section: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showOTP, setShowOTP] = useState(false);
  const [otp, setOtp] = useState("");
  const [tempUser, setTempUser] = useState(null);

  const recaptchaRef = useRef(null);
  const [recaptchaLoaded, setRecaptchaLoaded] = useState(false);

  const navigate = useNavigate();

  // Load reCAPTCHA
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://www.google.com/recaptcha/api.js";
    script.async = true;
    script.defer = true;
    script.onload = () => setRecaptchaLoaded(true);
    document.body.appendChild(script);
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    if (error) setError("");
  };

  const validatePassword = (password) =>
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password) &&
    /[!@#$%^&*]/.test(password);

  const handleGoogleLogin = () => {
    const backendUrl = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
    window.location.href = `${backendUrl}/auth/google`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!form.email.endsWith("@gmail.com"))
      return setError("❌ Only Gmail accounts allowed.");

    if (!validatePassword(form.password))
      return setError("❌ Password does not meet security requirements.");

    if (!form.course || !form.section)
      return setError("❌ Please provide your Course and Section.");

    setLoading(true);

    try {
      const recaptchaToken = window.grecaptcha.getResponse();

      const res = await api.post("/auth/register", {
        ...form,
        username: form.username || form.name.toLowerCase().replace(/\s+/g, ""),
        recaptchaToken,
      });

      if (res.data.success) {
        setTempUser({ email: form.email });
        setShowOTP(true);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleOTPVerify = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await api.post("/auth/verify-email", {
        email: tempUser.email,
        otp,
      });

      if (res.data.success) navigate("/login");
    } catch {
      setError("Invalid OTP");
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

      {/* Register Card */}
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
          Create Account
        </h1>

        {/* Google Button */}
        <button
          onClick={handleGoogleLogin}
          className="w-full flex items-center justify-center gap-3 bg-red-500 text-white py-3 rounded-lg hover:bg-red-600 transition mb-4 font-semibold"
        >
          <span className="font-bold text-lg">G+</span> Continue with Google
        </button>

        <div className="flex items-center my-6">
          <div className="flex-grow h-px bg-gray-300" />
          <span className="px-3 text-gray-600 text-sm">or register with email</span>
          <div className="flex-grow h-px bg-gray-300" />
        </div>

        {!showOTP ? (
          <form onSubmit={handleSubmit} className="space-y-4">

            <input
              type="text"
              name="name"
              placeholder="Full Name *"
              value={form.name}
              onChange={handleChange}
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none"
              required
            />

            <input
              type="email"
              name="email"
              placeholder="Email *"
              value={form.email}
              onChange={handleChange}
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none"
              required
            />

            <input
              type="password"
              name="password"
              placeholder="Password *"
              value={form.password}
              onChange={handleChange}
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none"
              required
            />

            <input
              type="text"
              name="course"
              placeholder="Course (ex: BSIT) *"
              value={form.course}
              onChange={handleChange}
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none"
              required
            />

            <input
              type="text"
              name="section"
              placeholder="Section (ex: 3A) *"
              value={form.section}
              onChange={handleChange}
              className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-indigo-600 outline-none"
              required
            />

            {/* reCAPTCHA */}
            <div className="flex justify-center">
              <div
                ref={recaptchaRef}
                className="g-recaptcha"
                data-sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY}
              />
            </div>

            {error && (
              <p className="bg-red-100 text-red-600 text-center py-2 rounded-lg border border-red-300">
                {error}
              </p>
            )}

            <button
              disabled={loading}
              className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition uppercase font-semibold"
            >
              {loading ? "Creating..." : "Sign Up"}
            </button>

          </form>
        ) : (
          /* OTP Section */
          <form onSubmit={handleOTPVerify} className="space-y-4">

            <p className="text-center text-gray-700 text-lg">
              Verification sent to:
              <br />
              <span className="font-bold">{tempUser.email}</span>
            </p>

            <input
              type="text"
              placeholder="Enter OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="w-full px-4 py-3 border rounded-lg"
              required
            />

            {error && (
              <p className="bg-red-100 text-red-600 text-center py-2 rounded-lg border border-red-300">
                {error}
              </p>
            )}

            <button className="w-full bg-indigo-600 text-white py-3 rounded-lg hover:bg-indigo-700 transition uppercase font-semibold">
              {loading ? "Verifying..." : "Verify OTP"}
            </button>

          </form>
        )}

        <p className="text-center text-sm mt-5 text-gray-600">
          Already have an account?
          <button
            onClick={() => navigate("/login")}
            className="text-indigo-600 font-semibold hover:underline ml-1"
          >
            Sign In
          </button>
        </p>

      </div>
    </div>
  );
}