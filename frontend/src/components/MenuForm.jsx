// src/components/MenuForm.jsx
import React, { useState } from 'react';

export default function MenuForm({ onAdd, loading }) {
  const [form, setForm] = useState({
    name: '',
    quantity: '',
    quantity_unit: 'kg',
    waste_time_hours: '',
  });
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = () => {
    setError('');
    if (!form.name.trim()) return setError('Item name is required.');
    if (!form.quantity || isNaN(form.quantity) || Number(form.quantity) <= 0)
      return setError('Enter a valid quantity.');
    const hours = Number(form.waste_time_hours);
    if (!form.waste_time_hours || isNaN(hours) || hours <= 0)
      return setError('Enter a valid spoil time in hours (e.g. 15).');

    onAdd({
      name:               form.name.trim(),
      quantity:           Number(form.quantity),
      quantity_unit:      form.quantity_unit,
      waste_time_hours:   hours,
      waste_time_minutes: Math.round(hours * 60),
    });

    setForm({ name: '', quantity: '', quantity_unit: 'kg', waste_time_hours: '' });
  };

  return (
    <div className="bg-stone-50 border border-stone-200 rounded-2xl p-4 space-y-3">
      <h3 className="font-semibold text-sm">Add Menu Item</h3>

      {error && <div className="text-xs text-red-600 bg-red-50 p-2 rounded">{error}</div>}

      <input
        name="name"
        value={form.name}
        onChange={handleChange}
        placeholder="Food name"
        className="input-field"
      />

      <div className="grid grid-cols-2 gap-2">
        <input
          name="quantity"
          type="number"
          min="0.1"
          step="any"
          value={form.quantity}
          onChange={handleChange}
          placeholder="Quantity"
          className="input-field"
        />
        <select
          name="quantity_unit"
          value={form.quantity_unit}
          onChange={handleChange}
          className="input-field"
        >
          <option value="kg">kg</option>
          <option value="g">g</option>
          <option value="plates">plates</option>
          <option value="litres">litres</option>
          <option value="portions">portions</option>
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-stone-600">
          Spoils in (hours) <span className="text-stone-400 font-normal">— type exactly, e.g. 15 = 15 hours</span>
        </label>
        <input
          name="waste_time_hours"
          type="number"
          min="0.5"
          step="0.5"
          value={form.waste_time_hours}
          onChange={handleChange}
          placeholder="e.g. 15"
          className="input-field"
        />
        {Number(form.waste_time_hours) > 0 && (
          <p className="text-xs text-stone-400">
            = {Math.round(Number(form.waste_time_hours) * 60)} minutes saved to database
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        disabled={loading}
        className="btn-primary w-full"
      >
        {loading ? 'Adding...' : 'Add Item'}
      </button>
    </div>
  );
}
