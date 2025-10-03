'use client';

import React, { useState } from 'react';

const splitEmails = (input: string) =>
  input
    .split(/[\s,;]+/)
    .map((value) => value.trim())
    .filter(Boolean);

export default function InviteUsersPanel() {
  const [value, setValue] = useState('');
  const [pending, setPending] = useState(false);
  const [out, setOut] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);

  const send = async () => {
    setErr(null);
    setOut(null);
    setPending(true);
    try {
      const emails = splitEmails(value);
      const res = await fetch('/api/auth/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-master-token': process.env.NEXT_PUBLIC_SITE_URL ? '' : '',
        },
        body: JSON.stringify({ emails }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || 'Error');
      }
      setOut(json);
    } catch (error: any) {
      setErr(error?.message ?? 'Error');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-lg font-semibold">Invitar usuarios</h3>
      <p className="text-sm text-gray-600">
        Ingresa correos separados por coma, punto y coma o espacios.
      </p>
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="border rounded p-2 min-h-[120px]"
        placeholder="correo1@dominio.com, correo2@dominio.com ..."
      />
      <button
        disabled={pending}
        onClick={send}
        className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {pending ? 'Enviando...' : 'Enviar invitaciones'}
      </button>
      {err ? <pre className="text-red-600 whitespace-pre-wrap">{err}</pre> : null}
      {out ? (
        <pre className="bg-gray-50 p-2 border rounded overflow-auto">
          {JSON.stringify(out, null, 2)}
        </pre>
      ) : null}
    </div>
  );
}
