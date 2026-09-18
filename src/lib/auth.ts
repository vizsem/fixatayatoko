import { supabase } from './supabase';

export const loginWithGoogle = async () => {
  await supabase.auth.signInWithOAuth({ provider: 'google' });
};

export const authOptions: any = {
  providers: [],
};
