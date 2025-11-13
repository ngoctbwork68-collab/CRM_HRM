// File: lib/supabase/server.ts (Fixed async cookies handling)

import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Creates a Supabase Client for Server Components and Route Handlers.
 * Must be called from an async function to properly handle cookies.
 * Cookies are passed as a function to be evaluated at request time.
 */
export const createSupabaseServerClient = () => {
  // Return a client with cookies as a getter function
  // The Auth Helpers will call this function when needed
  return createServerComponentClient({
    cookies: () => cookies(),
  });
};
