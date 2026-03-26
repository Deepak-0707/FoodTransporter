// src/pages/CreateEventPage.jsx
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { eventsAPI } from '../services/api';
import PageLayout from '../components/PageLayout';
import EventForm from '../components/EventForm';

export default function CreateEventPage() {
  const navigate    = useNavigate();
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (formData) => {
    setLoading(true);
    try {
      await eventsAPI.create(formData);
      setSuccess(true);
      setTimeout(() => navigate('/events'), 1500);
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageLayout
      title="Post a New Event"
      subtitle="Share surplus food so NGOs can collect it before it goes to waste."
    >
      <div className="max-w-xl mx-auto">
        <Link to="/events" className="text-sm text-stone-500 hover:text-stone-700 flex items-center gap-1 mb-6">
          ← Back to Events
        </Link>

        {success && (
          <div className="bg-forest-50 border border-forest-200 text-forest-700 text-sm rounded-xl px-4 py-3 mb-6 font-medium">
            ✅ Event created successfully! Redirecting…
          </div>
        )}

        <div className="card p-8">
          <EventForm
            onSubmit={handleSubmit}
            loading={loading}
            submitLabel="Post Event"
          />
        </div>
      </div>
    </PageLayout>
  );
}
