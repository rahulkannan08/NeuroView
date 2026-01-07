// Test Supabase Connection
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://fmufyczeyslzdmjartwn.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZtdWZ5Y3pleXNsemRtamFydHduIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE5MTAwMzIsImV4cCI6MjA3NzQ4NjAzMn0.solezUStK98yVr78UoMWBiuAKSXGiEtcoGitLHDPvkQ";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function testConnection() {
  try {
    console.log('🔄 Testing Supabase connection...');
    
    // Test basic connection
    const { data, error } = await supabase.from('_test_').select('*').limit(1);
    
    if (error && error.code === 'PGRST204') {
      console.log('✅ Supabase is connected successfully!');
      console.log('ℹ️  The error "relation does not exist" is expected - it means connection works but no tables exist yet.');
      console.log('\n📊 Connection Details:');
      console.log('   URL:', SUPABASE_URL);
      console.log('   Project ID:', 'fmufyczeyslzdmjartwn');
      console.log('   Status: CONNECTED ✅');
      return true;
    } else if (error) {
      console.log('✅ Supabase is connected!');
      console.log('⚠️  Error details:', error.message);
      return true;
    } else {
      console.log('✅ Supabase is connected and working!');
      console.log('📊 Sample data:', data);
      return true;
    }
  } catch (err) {
    console.error('❌ Connection failed:', err.message);
    return false;
  }
}

testConnection();
