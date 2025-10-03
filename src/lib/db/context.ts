import { getSupabaseServer, type Enums, type Tables } from "@/lib/supabase/server";

export type AuthContext = {
  userId: string;
  role: Enums<"role_enum">;
  brokerId: string | null;
};

const normalizeRole = (
  role: Enums<"role_enum"> | null,
): Enums<"role_enum"> => {
  if (role === "master" || role === "broker") {
    return role;
  }
  throw new Error("Perfil de usuario sin rol asignado");
};

export const getAuthContext = async (): Promise<AuthContext> => {
  const supabase = await getSupabaseServer();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw new Error(`Error obteniendo sesión: ${userError.message}`);
  }
  if (!user) {
    throw new Error("Sesión no encontrada");
  }

  const {
    data: profile,
    error: profileError,
  } = await supabase
    .from("profiles")
    .select("id, role, broker_id")
    .eq("id", user.id)
    .single<Pick<Tables<"profiles">, "id" | "role" | "broker_id">>();

  if (profileError) {
    throw new Error(`Error obteniendo perfil: ${profileError.message}`);
  }
  if (!profile) {
    throw new Error("Perfil de usuario no encontrado");
  }

  const role = normalizeRole(profile.role);

  return {
    userId: user.id,
    role,
    brokerId: profile.broker_id ?? null,
  };
};
