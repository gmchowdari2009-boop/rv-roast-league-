# RV Roast League

Branch-vs-branch roast competition platform for RVCE.

## Stack
Node.js, Express, PostgreSQL, JWT authentication, and a vanilla HTML/JS frontend.

## Features
- Branch leaderboard and shared roast feed
- Registration/login with bcrypt + JWT
- Roasts, votes, comments and scoring milestones
- Reports and admin moderation
- Auditable point transactions
- Rate limiting and basic moderation

## Run
```bash
npm install
cp .env.example .env
npm run migrate
npm run seed
npm start
```

Configure DATABASE_URL and JWT_SECRET before running.
