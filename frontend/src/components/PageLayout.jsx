import React from 'react';
import Navbar from './Navbar';

export default function PageLayout({ children, title, subtitle }) {
  return (
    <div className="min-h-screen bg-stone-50 font-body">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {(title || subtitle) && (
          <div className="mb-8">
            {title && (
              <h1 className="font-display font-bold text-3xl text-stone-900">{title}</h1>
            )}
            {subtitle && (
              <p className="text-stone-500 mt-1">{subtitle}</p>
            )}
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
