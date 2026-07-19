'use client';
import { useState } from 'react';
export default function NotificationsPage() {
  const [email, setEmail] = useState(true);
  const [whatsapp, setWhatsapp] = useState(true);
  const [inapp, setInapp] = useState(true);
  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-light tracking-[-0.02em] text-white">Notifications</h1>
      <div className="space-y-4">
        <label className="flex items-center gap-3 text-sm text-white"><input type="checkbox" checked={email} onChange={(e) => setEmail(e.target.checked)} /> Email Notifications</label>
        <label className="flex items-center gap-3 text-sm text-white"><input type="checkbox" checked={whatsapp} onChange={(e) => setWhatsapp(e.target.checked)} /> WhatsApp Notifications</label>
        <label className="flex items-center gap-3 text-sm text-white"><input type="checkbox" checked={inapp} onChange={(e) => setInapp(e.target.checked)} /> In-App Notifications</label>
      </div>
    </div>
  );
}
