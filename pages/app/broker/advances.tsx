import React, { useEffect, useState } from 'react';

type Item = { id: string; concept: string; amount: number; totalDiscount: number; saldo: number; created_at: string };

export default function BrokerAdvances() {
  const [items, setItems] = useState<Item[]>([]);
  const email = typeof window !== 'undefined' ? localStorage.getItem('portal_email') || '' : '';

  async function load() {
    const res = await fetch('/api/advances', { headers: { 'x-email': email } });
    const j = await res.json();
    if (j.ok) setItems(j.items);
  }
  useEffect(() => { load(); }, []);

  const totalSaldo = items.reduce((s, x) => s + (x.saldo || 0), 0);

  return (
    <div style={{ padding: 16 }}>
      <h1>Mis Adelantos</h1>
      <p>Saldo pendiente: <b>{totalSaldo.toFixed(2)}</b></p>
      <table width="100%" cellPadding={8}>
        <thead>
          <tr><th>Concepto</th><th>Monto</th><th>Descontado</th><th>Saldo</th><th>Creado</th></tr>
        </thead>
        <tbody>
          {items.map(it => (
            <tr key={it.id}>
              <td>{it.concept}</td>
              <td>{it.amount.toFixed(2)}</td>
              <td>{it.totalDiscount.toFixed(2)}</td>
              <td><b>{it.saldo.toFixed(2)}</b></td>
              <td>{new Date(it.created_at).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
