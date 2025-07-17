# RPSOnline - Cursor Development Prompts

## Phase 1: Project Setup & Foundation

### Prompt 1.1: Initialize Next.js Project
```
Create a new Next.js 14 project with TypeScript for a multiplayer Rock Paper Scissors game called "RPSOnline". 

Setup requirements:
- Use App Router (not Pages Router)
- Include Tailwind CSS
- Add ESLint and Prettier configuration
- Create folder structure: src/components, src/hooks, src/store, src/types, src/utils, src/lib
- Install and configure these dependencies: @supabase/supabase-js, framer-motion, zustand, lucide-react
- Create .env.local template with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY
- Add basic package.json scripts for dev, build, lint, and type-check
```

### Prompt 1.2: Supabase Configuration
```
Set up Supabase integration for RPSOnline:

1. Create src/lib/supabase.ts with:
   - Supabase client initialization
   - TypeScript types for Database schema
   - Helper functions for auth and real-time subscriptions

2. Create src/types/database.ts with TypeScript interfaces for:
   - User profile
   - Game state
   - Game moves
   - Tournament data
   - Cosmetics

3. Add authentication wrapper component in src/components/auth/AuthProvider.tsx that:
   - Handles user session state
   - Provides auth context to the app
   - Manages login/logout functionality
```

### Prompt 1.3: Database Schema & Migrations
```
Create Supabase database schema for RPSOnline game:

Create migration files in supabase/migrations/ for these tables:

1. users table (extends auth.users):
   - id (uuid, primary key)
   - username (text, unique)
   - wins (integer, default 0)
   - losses (integer, default 0)
   - rating (integer, default 1000)
   - created_at (timestamp)

2. games table:
   - id (uuid, primary key)
   - player1_id (uuid, foreign key)
   - player2_id (uuid, foreign key)
   - status (enum: 'waiting', 'active', 'finished')
   - winner_id (uuid, nullable)
   - game_state (jsonb)
   - turn_number (integer, default 1)
   - current_player (uuid)
   - created_at (timestamp)

3. game_moves table:
   - id (uuid, primary key)
   - game_id (uuid, foreign key)
   - player_id (uuid, foreign key)
   - turn_number (integer)
   - action_type (enum: 'claim', 'attack', 'defend', 'conquer')
   - target_square (integer)
   - points_spent (integer)
   - created_at (timestamp)

4. game_queue table:
   - id (uuid, primary key)
   - user_id (uuid, foreign key)
   - created_at (timestamp)

Include Row Level Security (RLS) policies for each table.
```

## Phase 2: Authentication & User Management

### Prompt 2.1: Authentication Components
```
Create authentication system for RPSOnline:

1. src/components/auth/LoginForm.tsx:
   - Email/password login form
   - Social login options (Google, GitHub)
   - Form validation with proper error handling
   - Loading states and success feedback

2. src/components/auth/SignUpForm.tsx:
   - User registration form with username, email, password
   - Username availability checking
   - Password strength validation
   - Terms of service acceptance

3. src/components/auth/AuthModal.tsx:
   - Modal that switches between login/signup
   - Smooth transitions between forms
   - Close functionality

4. src/hooks/useAuth.ts:
   - Custom hook for authentication state
   - Login, logout, signup functions
   - User profile management
   - Session persistence

Use Tailwind CSS for styling with a modern, game-themed design.
```

### Prompt 2.2: User Profile & Dashboard
```
Create user profile and dashboard components:

1. src/components/user/ProfileCard.tsx:
   - Display username, wins, losses, rating
   - Win/loss ratio calculation
   - Rating badge/tier display
   - Edit profile functionality

2. src/components/user/StatsOverview.tsx:
   - Game statistics charts (wins over time)
   - Recent game history
   - Achievement/milestone tracking
   - Performance metrics

3. src/components/user/Dashboard.tsx:
   - Main dashboard layout
   - Quick play button
   - Tournament listings
   - Friend/social features placeholder

4. src/store/userStore.ts (Zustand):
   - User profile state management
   - Stats updates
   - Profile editing actions

Style with Tailwind CSS using cards, gradients, and modern UI patterns.
```

## Phase 3: Game Core & Mechanics

### Prompt 3.1: Game Board Component
```
Create the core game board for RPSOnline:

1. src/components/game/GameBoard.tsx:
   - 3x3 grid of interactive squares
   - Visual representation of player claims (different colors/icons)
   - Square states: empty, player1, player2, defended
   - Click handlers for player actions
   - Responsive design that works on mobile

2. src/components/game/GameSquare.tsx:
   - Individual square component
   - Smooth animations for state changes
   - Hover effects and click feedback
   - Defense shield indicator
   - Attack animations

3. src/types/game.ts:
   - Game state interfaces
   - Move types and validation
   - Player action types
   - Game status enums

4. src/utils/gameLogic.ts:
   - Game state validation
   - Move processing logic
   - Win condition checking
   - Turn resolution order (Defend → Attack → Conquer)

Use Framer Motion for animations and Tailwind for styling.
```

### Prompt 3.2: Game Actions & Controls
```
Create game action system:

1. src/components/game/ActionPanel.tsx:
   - Point allocation interface (Attack/Defend/Conquer)
   - Remaining points display
   - Action buttons with point costs
   - Submit move button
   - Turn timer display

2. src/components/game/ActionSelector.tsx:
   - Draggable point allocation
   - Visual feedback for selected actions
   - Validation for valid moves
   - Preview of actions before submission

3. src/components/game/TurnTimer.tsx:
   - Countdown timer component
   - Visual progress indicator
   - Auto-submit when timer expires
   - Different states (waiting, active, expired)

4. src/hooks/useGameActions.ts:
   - Custom hook for managing player actions
   - Action validation
   - Move submission to Supabase
   - Real-time action updates

Implement smooth animations and responsive design.
```

### Prompt 3.3: Game State Management
```
Create comprehensive game state management:

1. src/store/gameStore.ts (Zustand):
   - Current game state
   - Player actions and moves
   - Turn management
   - Real-time updates integration
   - Game history tracking

2. src/hooks/useGameState.ts:
   - Game state subscription via Supabase Realtime
   - State synchronization between players
   - Connection handling and reconnection
   - Game event processing

3. src/utils/gameValidation.ts:
   - Move validation functions
   - Game rule enforcement
   - Anti-cheat measures
   - State consistency checks

4. src/components/game/GameStatus.tsx:
   - Current game phase indicator
   - Player turn indicator
   - Game outcome display
   - Connection status

Focus on real-time synchronization and robust error handling.
```

## Phase 4: Matchmaking & Real-time Features

### Prompt 4.1: Matchmaking System
```
Create matchmaking system:

1. src/components/matchmaking/QueueManager.tsx:
   - Join queue button
   - Queue status display
   - Estimated wait time
   - Cancel queue functionality

2. src/components/matchmaking/MatchFound.tsx:
   - Match found notification
   - Opponent preview
   - Accept/decline match
   - Loading into game

3. src/hooks/useMatchmaking.ts:
   - Queue management functions
   - Real-time queue updates
   - Match creation and joining
   - Player matching logic

4. src/utils/matchmaking.ts:
   - Queue processing logic
   - Player pairing algorithm
   - Rating-based matching (basic)
   - Queue cleanup and management

Use Supabase Realtime for queue updates and match notifications.
```

### Prompt 4.2: Real-time Game Experience
```
Implement real-time game features:

1. src/hooks/useRealTimeGame.ts:
   - Real-time game state subscription
   - Move synchronization between players
   - Disconnection handling
   - Reconnection logic

2. src/components/game/GameRoom.tsx:
   - Complete game interface
   - Player information display
   - Chat system (optional)
   - Leave game functionality

3. src/components/game/OpponentActions.tsx:
   - Display opponent's actions
   - Action animations
   - Turn waiting indicators
   - Opponent status

4. src/utils/realTimeHelpers.ts:
   - Supabase channel management
   - Message handling
   - Connection state management
   - Error recovery

Focus on smooth real-time experience and handling edge cases.
```

## Phase 5: UI/UX & Polish

### Prompt 5.1: Main Navigation & Layout
```
Create main app navigation and layout:

1. src/components/layout/Navigation.tsx:
   - Top navigation bar
   - User profile dropdown
   - Game status indicator
   - Mobile responsive hamburger menu

2. src/components/layout/Sidebar.tsx:
   - Game navigation links
   - Statistics overview
   - Quick actions
   - Collapsible design

3. src/components/layout/MainLayout.tsx:
   - App shell with navigation
   - Content area management
   - Footer with links
   - Responsive grid system

4. src/components/ui/LoadingSpinner.tsx:
   - Reusable loading component
   - Different sizes and variants
   - Smooth animations

Style with modern UI principles and ensure mobile responsiveness.
```

### Prompt 5.2: Game Animations & Visual Effects
```
Add polished animations and visual effects:

1. src/components/game/AnimatedSquare.tsx:
   - Enhanced square with multiple animation states
   - Claim animations
   - Attack/defend effect animations
   - Victory/defeat animations

2. src/components/game/GameEffects.tsx:
   - Particle effects for actions
   - Screen shake for impacts
   - Victory celebration animations
   - Defeat transition effects

3. src/components/game/ActionFeedback.tsx:
   - Visual feedback for player actions
   - Floating damage numbers
   - Action confirmation animations
   - Sound effect placeholders

4. src/styles/animations.css:
   - Custom CSS animations
   - Keyframe definitions
   - Transition utilities
   - Performance optimizations

Use Framer Motion for complex animations and CSS for simple transitions.
```

## Phase 6: Advanced Features

### Prompt 6.1: Leaderboard & Statistics
```
Create leaderboard and statistics system:

1. src/components/leaderboard/LeaderboardTable.tsx:
   - Sortable leaderboard display
   - Player ranking system
   - Pagination for large datasets
   - Search and filter functionality

2. src/components/stats/PlayerStats.tsx:
   - Detailed player statistics
   - Win/loss charts
   - Performance over time
   - Comparison with other players

3. src/hooks/useLeaderboard.ts:
   - Leaderboard data fetching
   - Real-time rank updates
   - Statistics calculations
   - Caching for performance

4. src/utils/statsCalculations.ts:
   - Rating calculations
   - Win rate calculations
   - Performance metrics
   - Trend analysis

Implement efficient data fetching and caching strategies.
```

### Prompt 6.2: Tournament System (Basic)
```
Create basic tournament functionality:

1. src/components/tournament/TournamentList.tsx:
   - Available tournaments display
   - Tournament information cards
   - Join tournament functionality
   - Tournament status indicators

2. src/components/tournament/TournamentBracket.tsx:
   - Tournament bracket visualization
   - Match progression display
   - Player advancement tracking
   - Results display

3. src/hooks/useTournaments.ts:
   - Tournament data management
   - Registration handling
   - Match scheduling
   - Results processing

4. src/utils/tournamentLogic.ts:
   - Bracket generation
   - Match scheduling algorithms
   - Elimination logic
   - Winner determination

Focus on single-elimination tournaments initially.
```

## Phase 7: Testing & Deployment

### Prompt 7.1: Testing Setup
```
Set up comprehensive testing:

1. Configure Jest and React Testing Library
2. Create test utilities for Supabase mocking
3. Write unit tests for game logic functions
4. Create integration tests for authentication
5. Add component tests for key UI elements
6. Set up test database and migrations
7. Add GitHub Actions for CI/CD

Focus on critical game logic and user flows.
```

### Prompt 7.2: Production Deployment
```
Prepare for production deployment:

1. Configure Vercel deployment settings
2. Set up environment variables for production
3. Optimize build performance
4. Add error tracking (Sentry integration)
5. Set up monitoring and analytics
6. Create deployment scripts
7. Add health check endpoints

Ensure proper security configurations and performance optimizations.
```

## Usage Notes

- Execute each prompt in order for logical development flow
- Test thoroughly after each phase before moving to the next
- Adjust prompts based on specific requirements or issues encountered
- Use TypeScript strictly for better development experience
- Focus on real-time performance and user experience
- Implement proper error handling and loading states throughout