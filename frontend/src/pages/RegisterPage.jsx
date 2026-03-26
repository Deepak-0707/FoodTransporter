import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function RegisterPage() {
  const { login } = useAuth();
  const navigate  = useNavigate();

  const [form, setForm]     = useState({ name: '', email: '', password: '', role: 'NGO' });
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.name || !form.email || !form.password) return setError('All fields are required');
    if (form.password.length < 6) return setError('Password must be at least 6 characters');

    setLoading(true);
    try {
      const res = await authAPI.register(form);
      login(res.data.user, res.data.token);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 via-stone-50 to-forest-50 flex items-center justify-center px-4">
      <div className="w-full max-w-md animate-fade-up">

        {/* Logo */}
        <div className="text-center mb-8">
          <span className="text-5xl">🍱</span>
          <h1 className="font-display font-bold text-3xl text-stone-900 mt-3">FoodBridge</h1>
          <p className="text-stone-500 mt-1 text-sm">Join the mission to reduce food waste</p>
        </div>

        {/* Card */}
        <div className="card p-8">
          <h2 className="font-display font-semibold text-xl text-stone-800 mb-6">Create account</h2>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3 mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-stone-700">Full Name</label>
              <input
                name="name"
                type="text"
                value={form.name}
                onChange={handleChange}
                placeholder="Your name or organisation"
                className="input-field"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-stone-700">Email</label>
              <input
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com"
                className="input-field"
                autoComplete="email"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-stone-700">Password</label>
              <input
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                placeholder="Min. 6 characters"
                className="input-field"
                autoComplete="new-password"
                required
              />
            </div>

            {/* Role selector */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-semibold text-stone-700">I am a…</label>
              <div className="grid grid-cols-2 gap-3">
                {['NGO', 'ORGANIZER'].map((r) => (
                  <label
                    key={r}
                    className={`cursor-pointer flex flex-col items-center gap-1.5 p-4 rounded-xl border-2 transition-all duration-150 ${
                      form.role === r
                        ? 'border-brand-400 bg-brand-50'
                        : 'border-stone-200 hover:border-stone-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={r}
                      checked={form.role === r}
                      onChange={handleChange}
                      className="sr-only"
                    />
                    <span className="text-2xl">{r === 'NGO' ? '🤝' : '🎪'}</span>
                    <span className="text-sm font-semibold text-stone-700">{r}</span>
                    <span className="text-xs text-stone-400 text-center leading-tight">
                      {r === 'NGO' ? 'Collect food for communities' : 'Share surplus food from events'}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <button type="submit" className="btn-primary mt-2 w-full" disabled={loading}>
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-stone-500 mt-5">
          Already have an account?{' '}
          <Link to="/login" className="text-brand-600 font-semibold hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
