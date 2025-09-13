import React, { useEffect, useState } from 'react';

type Item = {
  id: string;
  broker_id: string;
  concept: string;
  amount: number;
  saldo: number;
  totalDiscount: number;
  created_at: string;
};

export default function MasterAdvances() {
  const [items, setItems] = useState<Item[]>([]);
  const [form, setForm] = useState<{ broker_id: string; concept: string; amount: string }>({
    broker_id: '', concept: '', amount: ''
  });
  const email = typeof window !== 'undefined' ? localStorage.getItem('portal_email') || '' : '';

  async function load() {
    const res = await fetch('/api/advances', { headers: { 'x-email': email } });
    const j = await res.json();
    if (j.ok) setItems(j.items);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await fetch('/api/advances', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-email': email },
      body: JSON.stringify({ ...form, amount: Number(form.amount) || 0 })
    });
    setForm({ broker_id: '', concept: '', amount: '' });
    load();
  }

  async function remove(id: string) {
    await fetch(`/api/advances?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { 'x-email': email }
    });
    load();
  }

  useEffect(() => { load(); }, []);

  return (
    <div style={{ padding: 16 }}>
      <h1>Adelantos (Master)</h1>

      <form onSubmit={submit} style={{ display: 'grid', gap: 8, maxWidth: 520, marginBottom: 16 }}>
        <input placeholder="broker_id" value={form.broker_id}
               onChange={e => setForm({ ...form, broker_id: e.target.value })}/>
        <input placeholder="concepto" value={form.concept}
               onChange={e => setForm({ ...form, concept: e.target.value })}/>
        <input placeholder="monto" type="number" value={form.amount}
               onChange={e => setForm({ ...form, amount: e.target.value })}/>
        <button>Crear adelanto</button>
      </form>

      <table width="100%" cellPadding={8}>
        <thead>
          <tr>
            <th>Broker</th><th>Concepto</th><th>Monto</th><th>Descontado</th><th>Saldo</th><th>Creado</th><th></th>
          </tr>
        </thead>
        <tbody>
          {items.map(it => (
            <tr key={it.id}>
              <td>{it.broker_id}</td>
              <td>{it.concept}</td>
              <td>{it.amount.toFixed(2)}</td>
              <td>{it.totalDiscount.toFixed(2)}</td>
              <td><b>{it.saldo.toFixed(2)}</b></td>
              <td>{new Date(it.created_at).toLocaleDateString()}</td>
              <td><button onClick={() => remove(it.id)}>Eliminar</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
