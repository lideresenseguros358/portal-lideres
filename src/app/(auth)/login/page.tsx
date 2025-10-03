"use client";

import { useState } from "react";
import Link from "next/link";
import AuthShell from "../_AuthShell";
import { supabaseClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = supabaseClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      // Force a full page reload to update cookies
      window.location.href = "/dashboard";
    }
  };

  return (
    <AuthShell description="Ingresa tus credenciales para acceder a tu cuenta.">
      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="auth-field">
          <label className="auth-label" htmlFor="email">
            Correo electrónico
          </label>
          <input
            id="email"
            name="email"
            type="email"
            className="auth-input"
            placeholder="Correo electrónico"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
        </div>
        
        <div className="auth-field">
          <label className="auth-label" htmlFor="password">
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            className="auth-input"
            placeholder="Ingresa tu contraseña"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />
        </div>

        {error && (
          <div className="auth-message error">{error}</div>
        )}

        <button type="submit" className="auth-primary-button" disabled={loading}>
          {loading ? "Ingresando..." : "Ingresar"}
        </button>

        <div className="auth-inline-links">
          <Link href="/forgot">Olvidé contraseña</Link>
          <span>|</span>
          <Link href="/new-user">¿Nuevo Usuario?</Link>
        </div>
      </form>
    </AuthShell>
  );
};
