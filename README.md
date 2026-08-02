# 🚀 HunterX Backend

> **HunterX Backend** is the core API powering the **HunterX** ecosystem, providing authentication, habit management, XP progression, streak tracking, rewards, leaderboards, notifications, and admin functionality.

Built with **Node.js**, **Express**, and **Supabase**, and deployed on **Railway**.

---

## 📖 Overview

The backend serves both the **HunterX Mobile App** and the **HunterX Admin Portal**, handling all business logic, secure authentication, scheduled jobs, and real-time user progression.

It is designed with a modular architecture, making it scalable, maintainable, and easy to extend as new game mechanics and social features are introduced.

---

## ✨ Features

### Authentication

- 🔐 Email & Password Authentication
- 🌐 Google OAuth
- 🍎 Apple Sign-In
- 🎟 JWT Verification
- 🔄 Secure Token Refresh

### Habit & Mission System

- 📅 Daily mission delivery
- 🎯 Personalized missions based on onboarding
- ✅ Complete and skip missions
- 🔄 Daily mission reset
- 📊 Mission progress tracking

### Gamification

- ⚡ XP calculation engine
- 📈 Level progression
- 🔥 Daily streak tracking
- 💥 Streak break detection
- 🏆 Achievement unlocking
- 🎁 Reward generation
- 🎲 Scratch-card rewards
- 💰 Wallet and redemption support

### Leaderboards

- 🌍 Global rankings
- 👥 Friends leaderboard
- 📅 Weekly seasons
- 🏅 Rank calculation
- 🔄 Automatic season resets

### Notifications

- 📲 Firebase Cloud Messaging (FCM)
- ⏰ Daily reminder notifications
- 🎉 Achievement notifications
- 🔥 Streak reminders
- 🎁 Reward notifications
- 📢 Broadcast notifications

### Admin

- 👨‍💼 Mission CRUD
- 👤 User management
- 📊 Analytics APIs
- 🎯 Reward management
- 🔧 Configuration endpoints

### Scheduled Jobs

- 🌙 Midnight task reset
- 🔥 Streak updates
- 📲 Push notification scheduler
- 📈 Leaderboard refresh
- 🎁 Reward processing

### Phase 2

- 🔗 Webhook integrations
- 👥 Guild management
- 🤝 Resonance matching
- ❤️ Health data synchronization
- 💳 Premium subscriptions

---

## 🛠 Tech Stack

| Technology | Purpose |
|------------|---------|
| Node.js | Runtime |
| Express.js | REST API Framework |
| Supabase PostgreSQL | Database |
| Supabase Auth | Authentication |
| Firebase Cloud Messaging | Push Notifications |
| node-cron | Scheduled Jobs |
| Railway | Deployment |
| JWT | Authentication Tokens |
| TypeScript *(Planned)* | Type Safety |

---

## 📂 Project Structure

```text
hunterx-backend/
│
├── src/
│   ├── routes/          # API route definitions
│   ├── controllers/     # Request handlers
│   ├── services/        # Business logic
│   ├── middleware/      # Authentication & error handling
│   ├── db/              # Supabase client & queries
│   ├── cron/            # Scheduled jobs
│   ├── utils/           # Helper utilities
│   ├── config/          # App configuration
│   └── index.js         # Application entry point
│
├── .env.example
├── railway.json
├── package.json
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- npm
- Railway Account
- Supabase Project
- Firebase Project

### Installation

```bash
git clone https://github.com/<your-org>/hunterx-backend.git

cd hunterx-backend

npm install
```

---

## ⚙️ Environment Variables

Create a `.env` file using the following template:

```env
SUPABASE_URL=
SUPABASE_SERVICE_KEY=

JWT_SECRET=

FIREBASE_PROJECT_ID=
FIREBASE_PRIVATE_KEY=
FIREBASE_CLIENT_EMAIL=

NODE_ENV=development
PORT=3000
```

---

## ▶️ Run the Server

Development

```bash
npm run dev
```

Production

```bash
npm start
```

---

## 📡 API Modules

| Endpoint | Description |
|----------|-------------|
| `/api/auth` | Authentication, OAuth, JWT |
| `/api/users` | User profile & onboarding |
| `/api/tasks` | Daily missions & task actions |
| `/api/xp` | XP, levels & streaks |
| `/api/rewards` | Scratch cards & wallet |
| `/api/leaderboard` | Rankings & weekly seasons |
| `/api/notifications` | Push notifications |
| `/api/admin` | Admin management APIs |

---

## 🌙 Background Jobs

The backend automatically runs scheduled tasks to keep the application synchronized.

- Daily mission reset
- Streak updates
- Push notification scheduling
- Reward generation
- Leaderboard recalculation
- Weekly season reset

---

## 🔒 Security

- JWT-based authentication
- Protected API routes
- Secure Supabase service role access
- Input validation
- Centralized error handling
- Environment-based configuration

---

## 🌟 Related Repositories

| Repository | Description |
|------------|-------------|
| **hunterx-mobile** | React Native mobile application |
| **hunterx-admin** | Next.js Admin Dashboard |

---

## 👥 Team

| Name | Role |
|------|------|
| **Shakthi** | Product Owner & Backend Developer |

---

## 🎯 Vision

The HunterX Backend is built to support a scalable, gamified productivity platform where every completed habit contributes to meaningful personal growth. It serves as the foundation for future features including guilds, social challenges, AI-powered coaching, and health integrations.

> **Powering discipline, one API request at a time.**

---

## 📄 License

This project is private and proprietary. Unauthorized copying, distribution, or modification is prohibited.
