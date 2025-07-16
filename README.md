# RPSOnline - Multiplayer Rock Paper Scissors Strategy Game

A real-time multiplayer strategy game that evolves the classic Rock Paper Scissors into a tactical territory control experience.

## 🎮 Game Overview

RPSOnline transforms the simple Rock Paper Scissors game into a strategic multiplayer experience where players compete to control a 3x3 grid using Attack, Defend, and Conquer mechanics.

### Core Gameplay
- **Turn 1**: Both players simultaneously claim 2 squares on a 3x3 grid
- **Subsequent Turns**: Each player gets 3 points to allocate between:
  - **Attacking** (1 point): Remove enemy claims from squares
  - **Defending** (1 point): Shield your squares from attacks
  - **Conquering** (1 point): Claim empty squares

### Order of Operations
1. **Defend**: Apply shields to protect squares
2. **Attack**: Remove enemy claims (shields block 1 attack)
3. **Conquer**: Claim empty squares

## 🚀 Tech Stack

- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Backend**: Supabase (PostgreSQL + Auth + Realtime)
- **Deployment**: Vercel
- **Animations**: Framer Motion
- **State Management**: Zustand

## 🏗️ Project Structure

```
rpsonline/
├── src/
│   ├── components/
│   │   ├── game/
│   │   ├── ui/
│   │   ├── auth/
│   │   └── layout/
│   ├── hooks/
│   ├── store/
│   ├── types/
│   ├── utils/
│   └── lib/
├── public/
├── supabase/
│   ├── migrations/
│   └── seed.sql
└── docs/
```

## 🛠️ Setup Instructions

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account
- Vercel account (for deployment)

### 1. Clone Repository
```bash
git clone https://github.com/yourusername/rpsonline.git
cd rpsonline
npm install
```

### 2. Environment Setup
Create `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Database Setup
```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

### 4. Development
```bash
npm run dev
```

### 5. Deploy to Vercel
```bash
# Install Vercel CLI
npm install -g vercel

# Deploy
vercel --prod
```

## 📊 Database Schema

### Core Tables
- `users` - Player profiles and stats
- `games` - Game sessions and state
- `game_moves` - Individual player actions
- `game_queue` - Matchmaking queue
- `tournaments` - Tournament management
- `cosmetics` - Shop items and customization

### Key Features
- Row Level Security (RLS) for data protection
- Real-time subscriptions for live gameplay
- Automatic matchmaking system
- Tournament bracket generation

## 🎯 Features

### ✅ Core Features
- [x] User authentication and profiles
- [x] Real-time matchmaking
- [x] Turn-based gameplay with timers
- [x] Win/loss tracking
- [x] Global leaderboard

### 🚧 In Development
- [ ] Tournament system
- [ ] Cosmetic shop
- [ ] Spectator mode
- [ ] Replay system

### 📋 Planned Features
- [ ] Rating/ELO system
- [ ] Friend system
- [ ] Custom game modes
- [ ] Mobile app
- [ ] Seasonal events

## 🎨 Game Mechanics

### Victory Conditions
- Control majority of squares when timer expires
- Force opponent to forfeit
- Complete domination (control all 9 squares)

### Scoring System
- +10 points for wins
- -5 points for losses
- Bonus points for tournament performance
- Rating adjustments based on opponent strength

## 🔧 Development Scripts

```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run lint         # Run ESLint
npm run type-check   # TypeScript checking
npm run test         # Run tests
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🎮 Game Rules Reference

### Turn Structure
1. **Setup Phase**: Both players claim 2 initial squares
2. **Action Phase**: Allocate 3 points across Attack/Defend/Conquer
3. **Resolution Phase**: Actions resolve in order (Defend → Attack → Conquer)
4. **Timer**: 30 seconds per turn (configurable)

### Strategic Tips
- Use multiple attack points to break through defended squares
- Defend key strategic positions
- Balance offense and territory expansion
- Watch opponent patterns and adapt

## 🔗 Links

- [Live Demo](https://rpsonline.vercel.app)
- [API Documentation](docs/api.md)
- [Game Rules](docs/rules.md)
- [Contributing Guide](CONTRIBUTING.md)

---

Built with ❤️ by Spencer Richardson