<div align="center">

# 🚀 Real-Time Crypto Stream

### AI-Powered Cryptocurrency Analysis & Real-Time Price Streaming Platform

[![TypeScript](https://img.shields.io/badge/TypeScript-5.5-blue?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?style=for-the-badge&logo=next.js&logoColor=white)](https://nextjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![NVIDIA AI](https://img.shields.io/badge/NVIDIA-Nemotron-76B900?style=for-the-badge&logo=nvidia&logoColor=white)](https://build.nvidia.com/)
[![Playwright](https://img.shields.io/badge/Playwright-1.40-2EAD33?style=for-the-badge&logo=playwright&logoColor=white)](https://playwright.dev/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)

A full-stack platform that combines **real-time cryptocurrency price streaming** via TradingView scraping with a **multi-agent AI analysis system** powered by NVIDIA Nemotron. Get live prices, market analysis, sentiment reports, on-chain intelligence, and AI-generated trading strategies — all in one place.

</div>

---

## 📐 System Architecture

### High-Level Overview

```mermaid
graph TB
    subgraph Client["🖥️ Frontend — Next.js 14"]
        UI["React UI<br/>Framer Motion + Lucide"]
        Hook["useTickerStream Hook"]
        API["API Service Layer"]
        AgentUI["Agent Card + Strategy Display"]
    end

    subgraph Server["⚙️ Backend — Node.js + Express"]
        Router["Express Router"]
        CRPC["ConnectRPC Service"]
        AgentRouter["Agent Routes<br/>/api/agent/*"]
        
        subgraph Scraping["🔍 Price Scraping Engine"]
            BM["Browser Manager<br/>LRU Context Pool"]
            SC["Ticker Scraper<br/>CSS Selector + DOM Fallback"]
        end

        subgraph Agents["🤖 Multi-Agent AI System"]
            Coord["Coordinator Agent<br/>Orchestrator"]
            MM["Market Monitor Agent"]
            NS["News Sentiment Agent"]
            OC["On-Chain Analysis Agent"]
            SG["Strategy Generator Agent"]
        end
        
        RL["AI Rate Limiter<br/>Queue + Backoff"]
    end

    subgraph External["🌐 External Services"]
        TV["TradingView<br/>Price Data"]
        NVIDIA["NVIDIA Nemotron API<br/>AI Analysis"]
        CG["CoinGecko API<br/>Market Data"]
        News["CryptoPanic API<br/>News Feed"]
        Reddit["Reddit API<br/>Sentiment Data"]
    end

    UI -->|"ConnectRPC<br/>Server Streaming"| CRPC
    Hook --> UI
    API -->|"REST"| AgentRouter
    AgentUI --> API

    CRPC --> BM
    BM --> SC
    SC -->|"Playwright"| TV

    AgentRouter --> Coord
    Coord --> MM
    Coord --> NS
    Coord --> OC
    Coord --> SG

    MM -->|"Scraper"| SC
    MM -->|"Rate Limited"| RL
    NS -->|"Rate Limited"| RL
    OC -->|"Rate Limited"| RL
    SG -->|"Rate Limited"| RL

    RL --> NVIDIA
    NS --> News
    NS --> Reddit
    OC --> CG

    style Client fill:#1a1a2e,color:#fff,stroke:#6366f1
    style Server fill:#0f0f23,color:#fff,stroke:#22c55e
    style External fill:#1e1e3f,color:#fff,stroke:#f59e0b
    style Agents fill:#1a1a3e,color:#fff,stroke:#8b5cf6
    style Scraping fill:#1a2a1a,color:#fff,stroke:#22c55e
```

### Multi-Agent AI Pipeline

```mermaid
sequenceDiagram
    participant U as 👤 User
    participant FE as 🖥️ Frontend
    participant API as 🔌 API Routes
    participant CO as 🧠 Coordinator
    participant MM as 📈 Market Monitor
    participant NS as 📰 News Sentiment
    participant OC as ⛓️ On-Chain Analysis
    participant SG as 💡 Strategy Generator
    participant AI as 🤖 NVIDIA Nemotron

    U->>FE: Submit analysis goal
    FE->>API: POST /api/agent/analyze
    API->>CO: executeMarathonTask(goal)
    
    Note over CO: Phase 1: Planning
    CO->>AI: Break goal into subtasks
    AI-->>CO: Subtask plan

    Note over CO: Phase 2: Execution
    par Parallel Agent Dispatch
        CO->>MM: Market analysis
        MM->>AI: Analyze price + indicators
        AI-->>MM: Market insights
        MM-->>CO: MarketAnalysis result
    and
        CO->>NS: Sentiment analysis
        NS->>AI: Analyze news + Reddit
        AI-->>NS: Sentiment report
        NS-->>CO: SentimentReport result
    and
        CO->>OC: On-chain analysis
        OC->>AI: Analyze flows + whales
        AI-->>OC: On-chain insights
        OC-->>CO: OnChainReport result
    end

    CO->>SG: Generate strategy (all data)
    SG->>AI: Synthesize trading strategy
    AI-->>SG: Strategy recommendation
    SG-->>CO: TradingStrategy result

    Note over CO: Phase 3: Synthesis
    CO->>AI: Synthesize all findings
    AI-->>CO: Final insights

    Note over CO: Phase 4: Verification
    CO->>AI: Verify consistency
    AI-->>CO: Verification result

    CO-->>API: Complete TaskState
    
    loop Polling
        FE->>API: GET /api/agent/status/:taskId
        API-->>FE: Progress + results
    end
    
    FE-->>U: Display strategy + insights
```

### Real-Time Price Streaming Flow

```mermaid
sequenceDiagram
    participant FE as 🖥️ Frontend
    participant RPC as 📡 ConnectRPC
    participant BM as 🏗️ Browser Manager
    participant SC as 🔍 Scraper
    participant TV as 📊 TradingView

    FE->>RPC: SubscribeTicker("BTCUSD")
    RPC->>RPC: Check cache
    
    alt Cache Hit
        RPC-->>FE: Immediate cached price
    end

    RPC->>BM: getContextForSymbol("BTCUSD")
    
    alt Context exists
        BM-->>RPC: Reuse existing context
    else New context needed
        BM->>BM: LRU eviction (if > 16 contexts)
        BM-->>RPC: New browser context
    end

    RPC->>SC: createTickerScraper("BTCUSD")
    SC->>TV: Navigate to TradingView page
    TV-->>SC: Page loaded

    loop Every 1s (POLL_INTERVAL)
        SC->>TV: Read price (CSS selectors)
        
        alt Selector found
            TV-->>SC: Price value
        else Fallback
            SC->>TV: DOM tree walk (regex)
            TV-->>SC: Price value
        end

        alt Price changed
            SC-->>RPC: priceCallback(price, timestamp)
            RPC-->>FE: PriceUpdate (stream)
        end
    end

    FE->>RPC: UnsubscribeTicker("BTCUSD")
    RPC->>SC: stop()
    SC->>BM: closeContextForSymbol()
```

---

## 🚀 Key Features

| Feature | Description |
|---------|-------------|
| **⚡ Real-Time Streaming** | Live crypto prices via ConnectRPC server streaming from TradingView |
| **🤖 Multi-Agent AI** | 5 specialized AI agents orchestrated by a Coordinator for deep analysis |
| **📈 Market Monitoring** | Real-time price tracking with technical indicators (RSI, MACD, MAs) |
| **📰 Sentiment Analysis** | News + Reddit sentiment aggregation with AI-powered interpretation |
| **⛓️ On-Chain Intelligence** | Exchange flow tracking, whale movement detection, network metrics |
| **💡 Strategy Generation** | AI-synthesized trading strategies with entry/exit points and risk levels |
| **🎨 Modern UI** | Glass-morphism design, Framer Motion animations, dark/light mode |
| **🔄 Self-Correction** | Coordinator agent evaluates and adjusts plans mid-execution |
| **📊 Task Checkpointing** | Long-running analysis tasks with progress tracking and resumability |
| **🛡️ Rate Limiting** | Smart API queue with exponential backoff to prevent quota errors |

---

## 🛠️ Tech Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| **Next.js 14** | React framework with SSR/SSG |
| **React 18** | Component UI with hooks |
| **ConnectRPC (Web)** | Type-safe server streaming |
| **Framer Motion** | Animations & transitions |
| **Recharts** | Data visualization charts |
| **Lucide React** | Icon library |

### Backend
| Technology | Purpose |
|------------|---------|
| **Node.js + Express** | HTTP server & routing |
| **ConnectRPC** | gRPC-like RPC framework |
| **Playwright** | Headless browser automation |
| **OpenAI SDK** | NVIDIA Nemotron integration |
| **Axios** | HTTP client for external APIs |
| **Cheerio** | HTML parsing for news scraping |

### Infrastructure
| Technology | Purpose |
|------------|---------|
| **Protocol Buffers** | Service/message definitions |
| **pnpm Workspaces** | Monorepo package management |
| **PostgreSQL** | Persistent data storage |
| **Redis** | Caching layer |
| **TypeScript** | End-to-end type safety |

---

## 📁 Project Structure

```
Real-Time-Crypto-Stream/
├── frontend/                          # Next.js 14 frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── AddTickerForm.tsx       # Ticker subscription form
│   │   │   ├── AgentCard.tsx           # AI agent task visualization
│   │   │   ├── StrategyDisplay.tsx     # Trading strategy results UI
│   │   │   ├── ThemeToggle.tsx         # Dark/light mode toggle
│   │   │   └── TickerList.tsx          # Live price ticker cards
│   │   ├── contexts/
│   │   │   └── ThemeContext.tsx         # Theme provider
│   │   ├── hooks/
│   │   │   └── useTickerStream.ts      # ConnectRPC streaming hook
│   │   ├── lib/
│   │   │   └── api.ts                  # REST API client
│   │   ├── pages/
│   │   │   ├── index.tsx               # Home — analysis launcher
│   │   │   └── analysis/
│   │   │       └── [taskId].tsx        # Live analysis dashboard
│   │   ├── styles/                     # Global CSS
│   │   └── types/
│   │       └── agent.types.ts          # Shared agent types
│   └── gen/proto/                      # Generated ConnectRPC stubs
│
├── backend/                            # Node.js backend server
│   ├── src/
│   │   ├── agents/
│   │   │   ├── CoordinatorAgent.ts     # 🧠 Orchestrator (planning, dispatch, synthesis, verification)
│   │   │   ├── MarketMonitorAgent.ts   # 📈 Price + technical analysis
│   │   │   ├── NewsSentimentAgent.ts   # 📰 News + Reddit sentiment
│   │   │   ├── OnChainAnalysisAgent.ts # ⛓️ Exchange flows + whale tracking
│   │   │   └── StrategyGeneratorAgent.ts # 💡 Trading strategy synthesis
│   │   ├── playwright/
│   │   │   ├── browserManager.ts       # Shared browser + LRU context pool
│   │   │   └── scraper.ts             # TradingView price scraper
│   │   ├── services/
│   │   │   └── connectRpcService.ts    # ConnectRPC streaming service
│   │   ├── routes/
│   │   │   └── agent.routes.ts         # REST API for agent system
│   │   ├── config/
│   │   │   └── constants.ts            # All configuration constants
│   │   ├── types/
│   │   │   └── agent.types.ts          # Agent type definitions
│   │   ├── utils/
│   │   │   └── rateLimiter.ts          # AI API rate limiter
│   │   ├── server.ts                   # Express + middleware setup
│   │   └── index.ts                    # Entry point + logging
│   └── gen/proto/                      # Generated ConnectRPC stubs
│
├── proto/
│   └── ticker.proto                    # Service & message definitions
├── shared/
│   └── types.ts                        # Shared TypeScript types
├── buf.gen.yaml                        # Protobuf code generation config
├── pnpm-workspace.yaml                 # Monorepo workspace config
└── package.json                        # Root workspace scripts
```

---

## 🤖 Agent System Deep Dive

### Agent Architecture

```mermaid
graph LR
    subgraph Coordinator["🧠 Coordinator Agent"]
        P["Phase 1: Plan<br/>AI task decomposition"]
        E["Phase 2: Execute<br/>Dispatch to agents"]
        S["Phase 3: Synthesize<br/>AI insight fusion"]
        V["Phase 4: Verify<br/>Quality check + self-correction"]
        P --> E --> S --> V
    end

    subgraph Specialists["Specialist Agents"]
        MM["📈 Market Monitor<br/>• TradingView scraping<br/>• RSI, MACD, MAs<br/>• AI price analysis"]
        NS["📰 News Sentiment<br/>• CryptoPanic API<br/>• Reddit monitoring<br/>• AI sentiment scoring"]
        OC["⛓️ On-Chain Analysis<br/>• CoinGecko data<br/>• Whale tracking<br/>• Exchange flows"]
        SG["💡 Strategy Generator<br/>• Cross-data synthesis<br/>• Entry/exit points<br/>• Risk assessment"]
    end

    E --> MM
    E --> NS
    E --> OC
    MM --> SG
    NS --> SG
    OC --> SG
    SG --> S

    style Coordinator fill:#1a1a2e,color:#fff,stroke:#6366f1
    style Specialists fill:#0f0f23,color:#fff,stroke:#22c55e
```

### Agent Capabilities

| Agent | Data Sources | AI Analysis | Output |
|-------|-------------|-------------|--------|
| **Coordinator** | All agent results | Task planning, synthesis, verification | `TaskState` with full results |
| **Market Monitor** | TradingView (Playwright) | Price trend + technical signals | `MarketAnalysis` |
| **News Sentiment** | CryptoPanic, Reddit | Bullish/bearish scoring + key events | `SentimentReport` |
| **On-Chain Analysis** | CoinGecko, simulated whale data | Exchange flow + whale pattern analysis | `OnChainReport` |
| **Strategy Generator** | All above agents' outputs | Entry/exit, stop-loss, risk level | `TradingStrategy` |

### Self-Correction Loop

The Coordinator implements a self-correction mechanism:
1. After subtask execution, it **evaluates progress** using AI
2. If the AI detects issues (data gaps, inconsistencies), it **adjusts the plan**
3. Failed subtasks are retried up to `MAX_SELF_CORRECTION_ATTEMPTS` (default: 3)
4. **Checkpoints** are saved at regular intervals for long-running tasks

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18+
- **pnpm** package manager
- **NVIDIA API Key** — Get one at [build.nvidia.com](https://build.nvidia.com/)
- **Playwright browsers** installed

### Installation

```bash
# 1. Clone the repository
git clone <repository-url>
cd Real-Time-Crypto-Stream

# 2. Install dependencies
pnpm install --recursive

# 3. Install Playwright browsers
pnpm exec playwright install chromium

# 4. Generate protocol buffer code
buf generate

# 5. Configure environment variables
cp backend/.env.example backend/.env
# Edit backend/.env and add your NVIDIA_API_KEY
```

### Environment Variables

Create a `backend/.env` file:

```env
# Server
PORT=4000
HOST=localhost

# TradingView Scraping
POLL_INTERVAL=1000
PAGE_LOAD_TIMEOUT=30000
DEFAULT_EXCHANGE=BINANCE

# NVIDIA AI (Required for agent system)
NVIDIA_API_KEY=your_nvidia_api_key_here

# PostgreSQL (Optional)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=crypto_agent

# Redis (Optional)
REDIS_HOST=localhost
REDIS_PORT=6379

# Agent Configuration
MARATHON_TASK_MAX_DURATION_HOURS=24
MAX_SELF_CORRECTION_ATTEMPTS=3
```

### Running the Application

```bash
# Start both frontend and backend
pnpm start

# Or start individually:
pnpm --filter backend dev     # Backend on http://localhost:4000
pnpm --filter frontend dev    # Frontend on http://localhost:3000
```

### Verify Setup

| Endpoint | Purpose |
|----------|---------|
| `http://localhost:3000` | Frontend UI |
| `http://localhost:4000/health` | Backend health check |
| `http://localhost:4000/api/stats` | ConnectRPC stats |
| `http://localhost:4000/api/agent/test` | Agent system status |

---

## 🔌 API Reference

### Real-Time Streaming (ConnectRPC / Protobuf)

```protobuf
service TickerService {
  rpc SubscribeTicker (TickerRequest) returns (stream PriceUpdate);
  rpc UnsubscribeTicker (TickerRequest) returns (PriceUpdate);
}
```

### Agent REST API

| Method | Endpoint | Description | Body |
|--------|----------|-------------|------|
| `POST` | `/api/agent/analyze` | Start analysis task | `{ "goal": "Analyze Bitcoin..." }` |
| `GET` | `/api/agent/status/:taskId` | Get task progress | — |
| `GET` | `/api/agent/test` | Test NVIDIA connection | — |

<details>
<summary>Example: Start Analysis</summary>

```bash
curl -X POST http://localhost:4000/api/agent/analyze \
  -H "Content-Type: application/json" \
  -d '{"goal": "Analyze Bitcoin for trading opportunities with focus on current market trends"}'
```

**Response:**
```json
{
  "success": true,
  "taskId": "task-abc123",
  "status": "planning",
  "message": "Analysis task started",
  "subtasksPlanned": 4,
  "checkpoints": 0
}
```
</details>

<details>
<summary>Example: Check Status</summary>

```bash
curl http://localhost:4000/api/agent/status/task-abc123
```

**Response:**
```json
{
  "taskId": "task-abc123",
  "goal": "Analyze Bitcoin...",
  "status": "completed",
  "progress": { "completed": 4, "total": 4, "percentage": 100 },
  "currentAgent": "strategy_generator",
  "subtasks": [
    { "name": "Market Analysis", "status": "completed", "agentType": "market_monitor" },
    { "name": "Sentiment Check", "status": "completed", "agentType": "news_sentiment" },
    { "name": "On-Chain Review", "status": "completed", "agentType": "onchain_analysis" },
    { "name": "Strategy Gen", "status": "completed", "agentType": "strategy_generator" }
  ],
  "result": { "recommendation": "BUY", "confidence": 72, "..." : "..." }
}
```
</details>

---

## 🎯 Key Technical Decisions

### Why ConnectRPC over WebSockets?
- **Type-safe streaming** via Protocol Buffers — no manual serialization
- **HTTP/2 compatible** — works with standard infrastructure
- **Auto-generated client code** — frontend and backend always in sync

### Why Playwright over REST APIs?
- **No API key required** for TradingView price data
- **Full browser context** — handles JavaScript-rendered content
- **LRU browser context pool** — efficient resource sharing across symbols
- **Fallback DOM walking** — robust against CSS selector changes

### Why NVIDIA Nemotron?
- **High-quality reasoning** for financial analysis
- **OpenAI SDK compatible** — easy integration via `openai` npm package
- **Cost-effective** for high-frequency analysis tasks

### Why Multi-Agent Architecture?
- **Separation of concerns** — each agent is a domain expert
- **Parallel execution** — market, sentiment, and on-chain analysis run concurrently
- **Self-correction** — Coordinator can re-plan and retry on failures
- **Extensible** — add new agents without modifying existing ones

---

## 📊 Monitoring & Observability

- **Health Check**: `GET /health` — basic service status
- **Stats**: `GET /api/stats` — active connections, scrapers, client count
- **Structured Logging**: Run-specific log directories under `backend/logs/`
- **Agent Status**: Real-time task progress via polling API

---

## 🐳 Docker Deployment

```dockerfile
FROM node:18-alpine AS base
WORKDIR /app
RUN npm install -g pnpm
COPY package*.json pnpm-*.yaml ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN pnpm install --recursive

FROM base AS build
COPY . .
RUN pnpm --filter frontend build
RUN pnpm --filter backend build

FROM node:18-alpine AS production
WORKDIR /app
COPY --from=build /app .
RUN npx playwright install-deps chromium
RUN npx playwright install chromium
EXPOSE 3000 4000
CMD ["pnpm", "start"]
```

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit changes: `git commit -am 'Add your feature'`
4. Push to branch: `git push origin feature/your-feature`
5. Submit a pull request

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

## 🙏 Acknowledgments

- **[TradingView](https://www.tradingview.com/)** — Real-time cryptocurrency price data
- **[NVIDIA NIM](https://build.nvidia.com/)** — Nemotron AI model for analysis
- **[Playwright](https://playwright.dev/)** — Reliable browser automation
- **[ConnectRPC](https://connectrpc.com/)** — Efficient real-time communication
- **[Next.js](https://nextjs.org/)** — Modern React framework