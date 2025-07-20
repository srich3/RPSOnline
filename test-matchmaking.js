// Test script to debug matchmaking
const { createClient } = require('@supabase/supabase-js');

// Replace with your actual Supabase URL and anon key
const supabaseUrl = 'https://ygmhfcozxzqezlwjutvp.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlnbWhmY296eHplemx3anV0dnAiLCJyb2xlIjoic2VydmljZV9yb2xlIiwiaWF0IjoxNzUyOTgzNjc4LCJleHAiOjIwNjg1NTk2Nzh9.YourServiceKeyHere';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testMatchmaking() {
  console.log('🧪 Testing matchmaking system...');
  
  try {
    // 1. Check current queue
    console.log('\n📋 Checking current queue...');
    const { data: queue, error: queueError } = await supabase
      .from('game_queue')
      .select('*')
      .order('created_at', { ascending: true });
    
    if (queueError) {
      console.error('❌ Error checking queue:', queueError);
      return;
    }
    
    console.log('👥 Players in queue:', queue?.length || 0);
    if (queue && queue.length > 0) {
      queue.forEach((entry, index) => {
        console.log(`  ${index + 1}. User: ${entry.user_id}, Rating: ${entry.rating}, Joined: ${entry.created_at}`);
      });
    }
    
    // 2. Check current games
    console.log('\n🎮 Checking current games...');
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('*')
      .in('status', ['waiting', 'active'])
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (gamesError) {
      console.error('❌ Error checking games:', gamesError);
      return;
    }
    
    console.log('🎯 Active games:', games?.length || 0);
    if (games && games.length > 0) {
      games.forEach((game, index) => {
        console.log(`  ${index + 1}. Game: ${game.id}, Status: ${game.status}, Players: ${game.player1_id} vs ${game.player2_id}, Created: ${game.created_at}`);
      });
    }
    
    // 3. Test manual matchmaking function
    console.log('\n🔧 Testing manual matchmaking function...');
    const { data: manualResult, error: manualError } = await supabase
      .rpc('manual_process_matchmaking');
    
    if (manualError) {
      console.error('❌ Error running manual matchmaking:', manualError);
    } else {
      console.log('✅ Manual matchmaking completed, created:', manualResult, 'matches');
    }
    
    // 4. Check queue again after manual matchmaking
    console.log('\n📋 Checking queue after manual matchmaking...');
    const { data: queueAfter, error: queueAfterError } = await supabase
      .from('game_queue')
      .select('*')
      .order('created_at', { ascending: true });
    
    if (queueAfterError) {
      console.error('❌ Error checking queue after:', queueAfterError);
      return;
    }
    
    console.log('👥 Players in queue after:', queueAfter?.length || 0);
    if (queueAfter && queueAfter.length > 0) {
      queueAfter.forEach((entry, index) => {
        console.log(`  ${index + 1}. User: ${entry.user_id}, Rating: ${entry.rating}, Joined: ${entry.created_at}`);
      });
    }
    
    // 5. Check games again after manual matchmaking
    console.log('\n🎮 Checking games after manual matchmaking...');
    const { data: gamesAfter, error: gamesAfterError } = await supabase
      .from('games')
      .select('*')
      .in('status', ['waiting', 'active'])
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (gamesAfterError) {
      console.error('❌ Error checking games after:', gamesAfterError);
      return;
    }
    
    console.log('🎯 Active games after:', gamesAfter?.length || 0);
    if (gamesAfter && gamesAfter.length > 0) {
      gamesAfter.forEach((game, index) => {
        console.log(`  ${index + 1}. Game: ${game.id}, Status: ${game.status}, Players: ${game.player1_id} vs ${game.player2_id}, Created: ${game.created_at}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testMatchmaking(); 