import { config } from "dotenv";

config({ path: ".env.local" });

import { getSupabaseServer } from "../../src/lib/supabase/server";
import type { TablesInsert } from "../../src/lib/database.types";

type AppSettingInsert = TablesInsert<"app_settings">;
type Json = AppSettingInsert["value"];

const fallbackBrand = () => ({
  colors: {
    blue: process.env.NEXT_PUBLIC_BRAND_BLUE ?? "#010139",
    olive: process.env.NEXT_PUBLIC_BRAND_OLIVE ?? "#8aaa19",
    grey: process.env.NEXT_PUBLIC_BRAND_GREY ?? "#e6e6e6",
  },
  texts: {
    footer_main:
      process.env.NEXT_PUBLIC_BRAND_FOOTER_MAIN ??
      "Regulado y Supervisado por la Superintendencia de Seguros y Reaseguros de Panamá - Licencia PJ750",
    footer_sub:
      process.env.NEXT_PUBLIC_BRAND_FOOTER_SUB ??
      "Desarrollado por Líderes en Seguros | Todos los derechos reservados",
    site_title_prefix: process.env.NEXT_PUBLIC_BRAND_SITE_TITLE_PREFIX ?? "LISSA | ",
  },
});

async function main() {
  const db = getSupabaseServer();
  const brand = fallbackBrand();

  const payload: AppSettingInsert[] = [
    {
      key: "brand",
      value: brand as Json,
    },
    {
      key: "brand.colors",
      value: brand.colors as Json,
    },
  ];
 // @ts-ignore - Known issue with Supabase generated types
  const { error } = await db
    .from("app_settings")
    .upsert(payload, { onConflict: "key" });
  if (error) {
    throw new Error(`Failed to upsert brand settings: ${error.message}`);
  }

  console.log("Brand settings seeded/updated");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
