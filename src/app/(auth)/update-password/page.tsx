"use client";

import { useState, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseClient as getSupabaseClient } from "@/lib/supabase/client";
import AuthShell from "../_AuthShell";
import { FaEye, FaEyeSlash, FaExclamationTriangle } from "react-icons/fa";

const UpdatePasswordPage = () => {
  const router = useRouter();
  const supabase = useMemo(() => getSupabaseClient(), []);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [sessionExpired, setSessionExpired] = useState(false);

  // Verificar que el usuario tenga una sesión válida de recovery
  useEffect(() => {
    const checkSession = async () => {
      console.log('========== UPDATE-PASSWORD DEBUG ==========');
      console.log('[1] Verificando sesión de recovery...');
      
      // Supabase maneja automáticamente la sesión cuando el usuario hace click en el link de recovery
      // NO necesitamos hacer exchangeCodeForSession manualmente - eso causa el error PKCE
      
      // Verificar la sesión actual
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      console.log('[2] Session error:', sessionError);
      console.log('[3] Session data:', session ? {
        user_id: session.user.id,
        email: session.user.email,
        recovery_sent_at: session.user.recovery_sent_at,
        aud: session.user.aud,
        role: session.user.role,
      } : null);
      
      if (!session) {
        console.error('[4] ❌ No hay sesión activa');
        setError("El enlace de recuperación ha expirado o es inválido.");
        setSessionExpired(true);
      } else {
        console.log('[4] ✅ Sesión válida para:', session.user.email);
        setSessionExpired(false);
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

    // REVALIDAR SESIÓN antes de intentar actualizar
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    
    if (!session || sessionError) {
      console.error('❌ Sesión expiró durante el proceso de actualización');
      setError("Tu sesión ha expirado. Por favor solicita un nuevo enlace de recuperación.");
      setSessionExpired(true);
      setLoading(false);
      return;
    }

    const { error: updateError } = await supabase.auth.updateUser({ password });

    setLoading(false);

    if (updateError) {
      // Detectar errores específicos de sesión expirada
      if (updateError.message.includes('session') || updateError.message.includes('expired') || updateError.message.includes('invalid')) {
        setError("Tu sesión ha expirado. Por favor solicita un nuevo enlace de recuperación.");
        setSessionExpired(true);
      } else {
        setError(updateError.message);
      }
      return;
    }

    setMessage("Contraseña actualizada correctamente");
    setTimeout(() => {
      router.replace("/");
    }, 1200);
  };

  const handleRequestNewLink = () => {
    router.push('/forgot');
  };

  return (
    <AuthShell description="Crea una nueva contraseña segura para tu cuenta">
      {/* Mensaje de sesión expirada */}
      {sessionExpired && (
        <div className="mb-6 p-4 bg-amber-50 border-l-4 border-amber-500 rounded-r-lg">
          <div className="flex items-start gap-3">
            <FaExclamationTriangle className="text-amber-600 text-xl mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-amber-900 mb-1">
                Enlace Expirado
              </h3>
              <p className="text-sm text-amber-800 mb-3">
                El enlace de recuperación ha expirado por seguridad. Solicita un nuevo enlace para continuar.
              </p>
              <button
                type="button"
                onClick={handleRequestNewLink}
                className="text-sm font-medium px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-md transition-colors"
              >
                Solicitar Nuevo Enlace
              </button>
            </div>
          </div>
        </div>
      )}

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="auth-field">
          <label className="auth-label" htmlFor="password">
            Nueva contraseña
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? "text" : "password"}
              className="auth-input pr-10"
              placeholder="Mínimo 8 caracteres"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              data-no-uppercase
              disabled={sessionExpired}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors duration-200"
              style={{
                color: showPassword ? '#8AAA19' : '#cbd5e1',
                opacity: showPassword ? 1 : 0.6,
              }}
              tabIndex={-1}
              disabled={sessionExpired}
            >
              {showPassword ? <FaEye size={18} /> : <FaEyeSlash size={18} />}
            </button>
          </div>
        </div>

        <div className="auth-field">
          <label className="auth-label" htmlFor="confirmPassword">
            Confirmar contraseña
          </label>
          <div className="relative">
            <input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              className="auth-input pr-10"
              placeholder="Repite tu contraseña"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              data-no-uppercase
              disabled={sessionExpired}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors duration-200"
              style={{
                color: showConfirmPassword ? '#8AAA19' : '#cbd5e1',
                opacity: showConfirmPassword ? 1 : 0.6,
              }}
              tabIndex={-1}
              disabled={sessionExpired}
            >
              {showConfirmPassword ? <FaEye size={18} /> : <FaEyeSlash size={18} />}
            </button>
          </div>
        </div>

        <button 
          type="submit" 
          className="auth-primary-button" 
          disabled={loading || sessionExpired}
        >
          {loading ? "Guardando..." : "Guardar contraseña"}
        </button>

        {message ? <div className="auth-message success">{message}</div> : null}
        {error && !sessionExpired ? <div className="auth-message error">{error}</div> : null}
      </form>
    </AuthShell>
  );
};

export default UpdatePasswordPage;
