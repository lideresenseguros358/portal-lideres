import { getSetting } from "../server/settings";

export interface Brand {
  colors: {
    blue: string;
    olive: string;
    grey: string;
  };
  texts: {
    footer_main: string;
    footer_sub: string;
    site_title_prefix: string;
  };
}

type PartialBrand = Partial<{
  colors: Partial<Brand["colors"]>;
  texts: Partial<Brand["texts"]>;
}>;

const envFallback = (): Brand => ({
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
    site_title_prefix:
      process.env.NEXT_PUBLIC_BRAND_SITE_TITLE_PREFIX ?? "LISSA | ",
  },
});

const mergeBrand = (base: Brand, incoming?: PartialBrand | null): Brand => {
  if (!incoming || typeof incoming !== "object") return base;

  return {
    colors: {
      blue: incoming.colors?.blue ?? base.colors.blue,
      olive: incoming.colors?.olive ?? base.colors.olive,
      grey: incoming.colors?.grey ?? base.colors.grey,
    },
    texts: {
      footer_main: incoming.texts?.footer_main ?? base.texts.footer_main,
      footer_sub: incoming.texts?.footer_sub ?? base.texts.footer_sub,
      site_title_prefix:
        incoming.texts?.site_title_prefix ?? base.texts.site_title_prefix,
    },
  };
};

/**
 * Obtiene la configuración de marca desde Supabase (`app_settings`),
 * con fallback a variables de entorno locales.
 */
export const getBrand = async (): Promise<Brand> => {
  const fallback = envFallback();
  try {
    const remote = await getSetting<PartialBrand>("brand");
    return mergeBrand(fallback, remote);
  } catch (error) {
    console.error("getBrand fallback", error);
    return fallback;
  }
};
