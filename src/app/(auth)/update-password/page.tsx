"use client";

import { useState, useMemo, useEffect } from "react";
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
  const [sessionChecked, setSessionChecked] = useState(false);

  // Verificar que el usuario tenga una sesión válida de recovery
  useEffect(() => {
    const checkSession = async () => {
      console.log('========== UPDATE-PASSWORD DEBUG ==========');
      console.log('[1] Verificando sesión de recovery...');
      
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      console.log('[2] Session error:', sessionError);
      console.log('[3] Session data:', session ? {
        user_id: session.user.id,
        email: session.user.email,
        recovery_sent_at: session.user.recovery_sent_at,
        aud: session.user.aud,
        role: session.user.role,
        created_at: session.user.created_at
      } : null);
      
      if (!session) {
        console.error('[4] ❌ No hay sesión activa - usuario debe solicitar nuevo link');
        setError("Sesión inválida o expirada. Por favor solicita un nuevo enlace de recuperación.");
      } else {
        console.log('[4] ✅ Sesión de recovery válida para:', session.user.email);
        console.log('[5] Recovery sent at:', session.user.recovery_sent_at);
      }
      
      console.log('==========================================');
      setSessionChecked(true);
    };

    checkSession();
  }, [supabase]);

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
