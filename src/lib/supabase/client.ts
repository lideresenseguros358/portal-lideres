'use client';

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "../database.types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Simple client with session persistence
export const supabaseClient = () =>
  createBrowserClient<Database>(url, key);

// Type exports for use across the app
export type DB = Database['public'];
export type Tables<T extends keyof DB['Tables']> = DB['Tables'][T]['Row'];
export type TablesInsert<T extends keyof DB['Tables']> = DB['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof DB['Tables']> = DB['Tables'][T]['Update'];
export type Enums<T extends keyof DB['Enums']> = DB['Enums'][T];
