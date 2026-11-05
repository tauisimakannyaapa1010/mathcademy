import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Konfigurasi Supabase
const SUPABASE_URL = 'https://oguqechwjeuwxejyzane.supabase.co';

const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_KROlk3CWsBTxTu36zQs6-Q_mtZ4jx9e';

// Membuat koneksi Supabase
export const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY
);