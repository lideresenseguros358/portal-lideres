"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient as getSupabaseClient } from "@/lib/supabase/client";
import AuthShell from "../_AuthShell";

const UpdatePasswordPage = () => {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseClient(), []);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!password || password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres");
      return;
    }

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    const { error: updateError } = await supabase.auth.updateUser({ password });

    setLoading(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setMessage("Contraseña actualizada correctamente");
    setTimeout(() => {
      router.replace("/");
    }, 1200);
  };

  return (
    <AuthShell description="Crea una nueva contraseña segura para tu cuenta">
      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="auth-field">
          <label className="auth-label" htmlFor="password">
            Nueva contraseña
          </label>
          <input
            id="password"
            type="password"
            className="auth-input"
            placeholder="Mínimo 8 caracteres"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
          />
        </div>

        <div className="auth-field">
          <label className="auth-label" htmlFor="confirmPassword">
            Confirmar contraseña
          </label>
          <input
            id="confirmPassword"
            type="password"
            className="auth-input"
            placeholder="Repite tu contraseña"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
          />
        </div>

        <button type="submit" className="auth-primary-button" disabled={loading}>
          {loading ? "Guardando..." : "Guardar contraseña"}
        </button>

        {message ? <div className="auth-message success">{message}</div> : null}
        {error ? <div className="auth-message error">{error}</div> : null}
      </form>
    </AuthShell>
  );
};

export default UpdatePasswordPage;
