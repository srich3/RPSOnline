# Tacto - Real-time Strategy Game

A real-time strategy game built with Next.js, Supabase, and TypeScript.

## Features

- Real-time multiplayer gameplay
- Matchmaking system with queue management
- Achievement system with stats tracking
- User authentication and profiles
- Responsive design

## Development

```bash
npm install
npm run dev
```

## Database Functions

The following database functions are available:
- `cancel_game(game_id, player_id)` - Cancel a waiting game
- `forfeit_game(game_id, player_id)` - Forfeit an active game
- `get_player_achievement_stats(player_id)` - Get player achievement statistics

## Recent Updates

- Fixed build errors by removing `current_player` references
- Applied database migrations for achievement system
- Updated game completion tracking