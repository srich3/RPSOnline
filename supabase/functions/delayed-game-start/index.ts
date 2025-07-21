import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Get game ID from request body
    const { gameId } = await req.json()

    if (!gameId) {
      return new Response(
        JSON.stringify({ error: 'Game ID is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`🎮 Starting delayed game start for game: ${gameId}`)

    // Wait 5 seconds
    await new Promise(resolve => setTimeout(resolve, 5000))

    // Update game status to 'active'
    const { data: game, error: updateError } = await supabase
      .from('games')
      .update({ 
        status: 'active',
        updated_at: new Date().toISOString()
      })
      .eq('id', gameId)
      .select()
      .single()

    if (updateError) {
      console.error('❌ Error updating game status:', updateError)
      return new Response(
        JSON.stringify({ error: 'Failed to update game status' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`✅ Game ${gameId} status updated to active`)

    // Broadcast game start event
    const { error: broadcastError } = await supabase
      .channel('matchmaking')
      .send({
        type: 'broadcast',
        event: 'game_starting',
        payload: {
          record: game
        }
      })

    if (broadcastError) {
      console.error('❌ Error broadcasting game start:', broadcastError)
      return new Response(
        JSON.stringify({ error: 'Failed to broadcast game start' }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    console.log(`📡 Game start broadcast sent for game: ${gameId}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        gameId,
        message: 'Game started successfully after 5 second delay'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('❌ Unexpected error in delayed-game-start function:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
}) 