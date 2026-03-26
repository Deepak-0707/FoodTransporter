// src/pages/EditEventPage.jsx
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { eventsAPI } from '../services/api';
import PageLayout from '../components/PageLayout';
import EventForm from '../components/EventForm';

export default function EditEventPage() {
  const { id }    = useParams();
  const navigate  = useNavigate();

  const [event, setEvent]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError]     = useState('');

  useEffect(() => {
    eventsAPI.getById(id)
      .then((res) => setEvent(res.data.event))
      .catch(() => setError('Event not found or you do not have permission to edit it.'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async (formData) => {
    setSaving(true);
    try {
      await eventsAPI.update(id, formData);
      setSuccess(true);
      setTimeout(() => navigate(`/events/${id}`), 1500);
    } finally {
      setSaving(false);
    }
  };

  // Pre-format expiry_time for datetime-local input (ISO string without seconds)
  const initialValues = event
    ? {
        ...event,
        expiry_time: new Date(event.expiry_time).toISOString().slice(0, 16),
      }
    : {};

  return (
    <PageLayout title="Edit Event" subtitle="Update the details of your food surplus event.">
      <div className="max-w-xl mx-auto">
        <Link to={`/events/${id}`} className="text-sm text-stone-500 hover:text-stone-700 flex items-center gap-1 mb-6">
          ← Back to Event
        </Link>

        {loading && <div className="text-stone-400 animate-pulse-soft py-12 text-center">Loading…</div>}
        {error   && <div className="bg-red-50 border border-red-200 text-red-600 rounded-xl px-4 py-3">{error}</div>}

        {success && (
          <div className="bg-forest-50 border border-forest-200 text-forest-700 text-sm rounded-xl px-4 py-3 mb-6 font-medium">
            ✅ Event updated! Redirecting…
          </div>
        )}

        {!loading && !error && (
          <div className="card p-8">
            <EventForm
              initialValues={initialValues}
              onSubmit={handleSubmit}
              loading={saving}
              submitLabel="Save Changes"
            />
          </div>
        )}
      </div>
    </PageLayout>
  );
}
