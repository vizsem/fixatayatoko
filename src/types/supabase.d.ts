import '@supabase/supabase-js';

declare module '@supabase/supabase-js' {
  interface User {
    uid?: string;
    displayName?: string;
    photoURL?: string;
    role?: string;
    isAnonymous?: boolean;
  }
}
