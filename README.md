# Token Launchpad Backend — Solana Bonding Curve API

A production-ready **token launchpad backend** for Solana: REST API, real-time events, and on-chain program listeners for bonding-curve token launches, swaps, and migrations. Built with Node.js, Express, TypeScript, MongoDB, and Socket.IO. Ideal for **token launchpad** platforms, fair-launch backends, and meme-coin / community-token infrastructure.

---

## Table of Contents

- [Overview](#overview)
- [Project Architecture](#project-architecture)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [How to Run This Project](#how-to-run-this-project)
- [Environment Variables](#environment-variables)
- [API Overview](#api-overview)
- [Real-Time Events (Socket.IO)](#real-time-events-socketio)
- [Running Tests](#running-tests)
- [Project Structure](#project-structure)
- [License](#license)

---

## Overview

This repository provides the **backend** for a **token launchpad** where users connect wallets, launch SPL tokens on Solana via a bonding-curve program, and trade until the curve completes and liquidity migrates (e.g. to Raydium). The server:

- Exposes REST endpoints for **users**, **coins**, **trades**, **charts**, and **curve config**.
- Listens to Solana program events (**launch**, **swap**, **complete**, **migrate**, **withdraw**) and keeps MongoDB in sync.
- Broadcasts **real-time** token creation, swaps, completion, and leaderboard updates over Socket.IO.

Use this as a reference **token launchpad backend** for Solana-based fair launches and community tokens.

---

## Project Architecture

High-level flow:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS (Web / Mobile)                           │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                    HTTP/REST          WebSocket (Socket.IO)
                                    │
┌───────────────────────────────────▼─────────────────────────────────────────┐
│                         EXPRESS APPLICATION (Node.js)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Routes    │  │ Middleware  │  │ Controllers │  │  Socket.IO Server    │  │
│  │ /user       │  │ (auth, etc) │  │ (e.g. king) │  │  (broadcast events)  │  │
│  │ /coin       │  │             │  │             │  │                     │  │
│  │ /cointrade  │  │             │  │             │  │  TokenCreated, Swap, │  │
│  │ /chart      │  │             │  │             │  │  Complete, KingOfHill│  │
│  │ /curveConfig│  │             │  │             │  │                     │  │
│  │ /feedback   │  │             │  │             │  │                     │  │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                │                     │            │
│         └────────────────┼────────────────┘                     │            │
│                          │                                        │            │
│  ┌───────────────────────▼───────────────────────────────────────▼────────┐  │
│  │                    DATA & CHAIN LAYER                                    │  │
│  │  ┌─────────────────┐   ┌─────────────────────────────────────────────┐  │  │
│  │  │ MongoDB         │   │ Solana Program Listener (Anchor)             │  │  │
│  │  │ (Mongoose)      │   │ • launchEvent → create Coin + CoinStatus     │  │  │
│  │  │ • User          │   │ • swapEvent   → update reserves, push trade  │  │  │
│  │  │ • Coin          │   │ • completeEvent, migrateEvent, withdrawEvent │  │  │
│  │  │ • CoinStatus    │   │ • ConfigEvent → CurveConfig                  │  │  │
│  │  │ • CurveConfig   │   │ • Metaplex (metadata), Raydium (charts)      │  │  │
│  │  │ • Feedback      │   │ • RPC: PUBLIC_SOLANA_RPC                     │  │  │
│  │  └────────┬────────┘   └──────────────────────┬──────────────────────┘  │  │
│  │           │                                    │                         │  │
│  └───────────┼────────────────────────────────────┼─────────────────────────┘  │
└──────────────┼────────────────────────────────────┼────────────────────────────┘
               │                                    │
               ▼                                    ▼
     ┌─────────────────┐                 ┌─────────────────────┐
     │    MongoDB      │                 │  Solana RPC/Chain   │
     │  (persistence)  │                 │  (bonding program)  │
     └─────────────────┘                 └─────────────────────┘
```

### Component roles

| Layer | Responsibility |
|-------|----------------|
| **Routes** | REST API: user registration/login, coin CRUD, trade history, chart data, curve config, feedback. |
| **Middleware** | Auth (JWT / wallet-based where used). |
| **Controllers** | Business logic (e.g. leaderboard “king of the hill”). |
| **Socket.IO** | Broadcasts: `TokenCreated`, `Swap`, `Complete`, `Migrate`, `KingOfHill`, `connectionUpdated`. |
| **Program listener** | Anchor `program.addEventListener` for on-chain events; updates MongoDB and triggers socket emits. |
| **MongoDB** | Source of truth for users, coins, trade records, curve config, feedback. |
| **Solana** | Bonding curve program (IDL in `src/program`); RPC used for reads and event subscription. |

---

## Tech Stack

- **Runtime / language:** Node.js, TypeScript  
- **API:** Express, body-parser, CORS  
- **Database:** MongoDB (Mongoose)  
- **Real-time:** Socket.IO  
- **Chain:** Solana (`@solana/web3.js`), Anchor (`@coral-xyz/anchor`), Metaplex, Raydium SDK  
- **Auth:** JWT, wallet signature verification (tweetnacl, bs58)  
- **Validation:** Joi  
- **Caching:** node-cache (e.g. chart path)  
- **Testing:** Vitest, Supertest  

---

## Prerequisites

- **Node.js** (v18+ recommended) and **yarn**
- **MongoDB** (local instance or hosted; connection URI required)
- **Solana** RPC endpoint (e.g. Helius, QuickNode, or public devnet/mainnet)
- **Solana program** deployed and matching the IDL in `src/program` (for event listening and full functionality)

---

## How to Run This Project

### 1. Clone and install dependencies

```bash
git clone <repository-url>
cd Pumpfun-Backend
yarn install
```

### 2. Configure environment

Copy the example env file and set your own values (do not commit real secrets):

```bash
cp .env.example .env
```

Edit `.env` with your MongoDB URI, Solana RPC/WS URLs, program ID, and (if needed) Pinata and admin keypair. See [Environment Variables](#environment-variables) below.

### 3. MongoDB

**Option A — Local MongoDB**

- Install and start MongoDB, or run it via Docker (e.g. create `mongo-docker/db_root_username.txt` and `mongo-docker/db_root_password.txt` if you use a compose setup that expects them).
- Set `MONGODB_URI` in `.env`, e.g.:

  `MONGODB_URI=mongodb://<user>:<password>@localhost:27017/`

**Option B — Hosted MongoDB**

- Use Atlas or any hosted MongoDB and set `MONGODB_URI` in `.env`.

### 4. Solana

- **RPC / WS:** Set `PUBLIC_SOLANA_RPC` and optionally `PUBLIC_SOLANA_WS` (e.g. devnet or mainnet).
- **Program:** Ensure the bonding-curve program is deployed and its ID matches `PROGRAM_ID` in `.env`. The IDL in `src/program` must match the deployed program so event parsing works.

### 5. Build (optional)

```bash
yarn build
```

This compiles TypeScript to `dist/`. You can run from source with the dev script instead.

### 6. Start the server

**Development (watch mode, from source):**

```bash
yarn start
```

Runs with `tsx --watch src/index.ts`. Default port is `5000` (overridable via `PORT`).

**Production-style (from compiled JS):**

```bash
yarn build
node --watch dist/index.js
# or: node dist/index.js
```

The server will:

- Connect to MongoDB.
- Start the Express app and mount routes.
- Attach Socket.IO to the HTTP server.
- Start the Solana program event listener (`listenerForEvents()`).

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB connection string (required for DB). |
| `PORT` | HTTP server port (default: `5000`). |
| `SIGN_IN_MSG` | Message prefix used for wallet sign-in verification. |
| `PUBLIC_SOLANA_RPC` | Solana RPC URL (e.g. devnet/mainnet). |
| `PUBLIC_SOLANA_WS` | Optional WebSocket RPC URL. |
| `PRIVATE_KEY` | Base58-encoded keypair for program interaction (e.g. admin). |
| `PROGRAM_ID` | Solana bonding-curve program ID (must match IDL). |
| `PINATA_API_KEY` / `PINATA_SECRET_API_KEY` / `PINATA_GATEWAY_URL` | Optional; for IPFS/pinned assets. |
| `DEFAULT_IMG_HASH` | Optional; default avatar or image hash. |

Use `.env.example` as a template and replace all secrets with your own values.

---

## API Overview

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Health check. |
| GET/POST | `/user/` | List users; register (wallet). |
| POST | `/user/login` | Login (returns JWT). |
| POST | `/user/confirm` | Confirm registration (signature + nonce). |
| GET | `/user/:id`, `/user/wallet/:wallet` | User by ID or wallet. |
| PUT | `/user/update/:id` | Update user. |
| GET | `/coin/` | List coins (with creator). |
| GET | `/coin/king` | Leaderboard “king of the hill”. |
| GET | `/coin/:id`, `/coin/user/:userID`, `/coin/token/:token` | Coin by ID, creator, or mint. |
| POST | `/coin/:coinId` | Update coin. |
| GET | `/cointrade/:mintAddress` | Trade history for a token. |
| GET | `/chart/:pairIndex/:start/:end/:range/:token/:countBack` | Price chart data. |
| GET | `/curveConfig/` | Bonding curve config (e.g. curve limit). |
| GET/POST | `/feedback/coin/:coinId`, `/feedback/user/:userId` | Messages by coin or user; submit feedback. |

---

## Real-Time Events (Socket.IO)

Clients can subscribe to:

- `TokenCreated` — New token launched (name, mint).
- `Swap` — Swap on bonding curve (mint, trade payload).
- `Complete` — Bonding curve completed (mint, bonding curve info).
- `Migrate` — Liquidity migrated (token, token_in, sol_in).
- `KingOfHill` — Top coin by progress market cap.
- `connectionUpdated` — Connected client count.

---

## Running Tests

1. **MongoDB:** Start a local MongoDB (e.g. Docker or system install). If using the repo’s Docker Compose pattern, create `mongo-docker/db_root_username.txt` and `mongo-docker/db_root_password.txt`, then:

   ```bash
   docker-compose -f mongo-docker/docker-compose.yml up -d
   ```

2. **Solana:** Use your own Solana test validator and deployed program for integration tests if required.

3. **Run tests:**

   ```bash
   yarn test
   ```

   Single test:

   ```bash
   yarn test -t "test-create-a-new-coin"
   ```

---

## Project Structure

```
Pumpfun-Backend/
├── src/
│   ├── index.ts              # App entry: Express, routes, DB init, Socket.IO, event listener
│   ├── db/
│   │   └── dbConncetion.ts   # MongoDB connection (Mongoose)
│   ├── routes/               # REST routes
│   │   ├── user.ts           # User registration, login, confirm, update
│   │   ├── coin.ts           # Coin list, by id/user/token, king
│   │   ├── coinTradeRoutes.ts# Trade history by mint
│   │   ├── chart.ts          # Price chart data
│   │   ├── curveRoutes.ts    # Curve config
│   │   └── feedback.ts       # Messages per coin/user
│   ├── controller/
│   │   └── coinController.ts # e.g. king-of-hill logic
│   ├── middleware/
│   │   └── authorization.ts  # Auth middleware
│   ├── models/               # Mongoose schemas
│   │   ├── User.ts
│   │   ├── PendingUser.ts
│   │   ├── Coin.ts
│   │   ├── CoinsStatus.ts
│   │   ├── CurveConfig.ts
│   │   └── Feedback.ts
│   ├── program/              # Solana integration
│   │   ├── web3.ts           # Connection, Anchor program, event handlers
│   │   ├── usafun.ts         # IDL types
│   │   ├── usafun.json       # Anchor IDL
│   │   └── programId.ts      # Program ID
│   ├── sockets/
│   │   ├── index.ts          # Socket.IO server setup
│   │   └── logger.ts
│   ├── logListeners/         # Optional chain listeners
│   │   └── AgentsLandListener.ts
│   └── utils/
│       ├── constants.ts
│       ├── chart.ts          # Chart data fetching
│       ├── calculateTokenPrice.ts
│       └── type.ts
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

---

## License

ISC.
