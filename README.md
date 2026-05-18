# 💬 Chaat — Full-Stack Real-Time Chat Application

**Chaat** is a production-grade, highly responsive real-time chat application featuring a sleek **Glassmorphism** aesthetic, fully persistent messaging via **MongoDB**, robust authentication, multimedia attachments, custom channels, and private direct messaging.

[![Frontend Deployment](https://img.shields.io/badge/Frontend-Vercel-black?logo=vercel&style=for-the-badge)](https://chaat-seven.vercel.app)
[![Backend Deployment](https://img.shields.io/badge/Backend-Railway-0b0d19?logo=railway&style=for-the-badge)](https://chaat-server-production.up.railway.app)

---

## 🚀 Live Demo

- **Frontend Application**: [https://chaat-seven.vercel.app](https://chaat-seven.vercel.app)
- **Backend API Server**: [https://chaat-server-production.up.railway.app](https://chaat-server-production.up.railway.app)

---

## ✨ Key Features

- **🔒 Secure Authentication**: User registration and login flows with securely hashed passwords using `bcryptjs`. Seamless session restoration via `localStorage` with auto-reconnection on page refresh.
- **📁 Multi-Room Channels**: Pre-configured defaults (`#general`, `#gaming`, `#music`, `#random`) alongside intuitive real-time **custom room creation**.
- **💬 Rich Real-Time Messaging**: Powered by **Socket.io**. Supports full **Markdown** formatting (parsed and sanitized via `marked` + `DOMPurify`), rich-text rendering, file attachments, and embedded interactive previews.
- **🖼️ Image & Avatar Uploads**: Native support for high-quality image attachments (up to 5MB) with full lightbox expansion. Configurable user profile avatars broadcast instantly to all connected clients.
- **✉️ Private Direct Messages (DMs)**: Dedicated sliding overlay interface for secure private conversations with full historical chat logs.
- **⌨️ Live Typing Indicators**: Real-time feedback displaying exactly who is currently typing within your active channel.
- **🔔 Smart Audio Notifications**: Integrated **Web Audio API** triggers discrete sound chimes for incoming messages and DMs when your window tab is out of focus.
- **🎨 Premium Visuals & Dark Mode**: Handcrafted pure CSS custom properties driving a highly polished **Glassmorphic** UI complete with smooth layout micro-animations and persistent theme toggling.
- **📱 Fluid Mobile Experience**: Auto-collapsing bottom navigation bars, full-screen DM panels, and sliding drawer menus tailored beautifully for smaller viewports.
- **🛡️ Database Resiliency**: Built-in automatic runtime failover to lightweight in-memory storage if remote MongoDB connections experience downtime.

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: React 18 powered by Vite 4
- **State & Real-Time**: Socket.io-client 4
- **Styling**: Vanilla CSS custom properties & utility modules (`globals.css` + `glass.css`)
- **Utilities**: `marked` & `DOMPurify` (Markdown rendering), `@emoji-mart/react` (Emoji selector)

### Backend
- **Runtime**: Node.js & Express 4
- **Real-Time Engine**: Socket.io 4
- **Database**: MongoDB (via Mongoose ORM)
- **Security**: `bcryptjs` for robust password verification

---

## 📂 Project Architecture

```text
chaat/
├── client/                        # React + Vite Frontend Client
│   ├── index.html
│   ├── vercel.json                # Vercel standalone directory deployment mapping
│   └── src/
│       ├── App.jsx                # Main interface container & persistent authentication state
│       ├── socket.js              # Initialized WebSocket wrapper tied to server envs
│       ├── components/
│       │   ├── AuthScreen.jsx     # Tabbed Login & Register workflows
│       │   ├── ChatRoom.jsx       # Unified viewport structure & active messages pane
│       │   ├── Topbar.jsx         # Action header (Avatar controls, theme switches, sound)
│       │   ├── RoomsSidebar.jsx   # Discoverable public/custom channel navigation
│       │   ├── DMPanel.jsx        # Drawer interface for peer-to-peer active DMs
│       │   ├── MessageBubble.jsx  # Modular chat block (Markdown embeds & lightbox view)
│       │   ├── EmojiButton.jsx    # Popover component integration for rich reactions
│       │   └── ProfileModal.jsx   # Active user avatar modification modal
│       └── styles/
│           ├── globals.css        # Core layout themes, breakpoints, and dynamic styles
│           └── glass.css          # Shared responsive frosted-glass overlay classes
└── server/                        # Node.js + Socket.io Engine
    ├── index.js                   # Entry point handling Mongoose schemas, Express routes, Socket events
    └── package.json               # Backend dependencies
```

---

## 🔌 Core Socket Lifecycle Events

| Event Name | Flow Direction | Payload / Role Description |
| :--- | :--- | :--- |
| **`register`** | Client → Server | `{ username, password }` — Instantiates a fresh user model |
| **`login`** | Client → Server | `{ username, password }` — Validates credentials & triggers auth lifecycle |
| **`auth_success`**| Server → Client | `{ username, avatarUrl }` — Acknowledges handshake authorization |
| **`auth_error`** | Server → Client | Dispatches specific error strings for failed authorization requests |
| **`join`** | Client → Server | Registers a recognized user session into the primary broadcast pool |
| **`message`** | Client → Server | Broadcasts strings or multipart bundles `{ type, data, filename }` |
| **`send_dm`** | Client → Server | Routes private bundles `{ toUsername, text, type, data, filename }` |
| **`update_avatar`**| Client → Server | Pushes new Base64 user avatar strings directly to database storage |
| **`avatar_updated`**| Server → All | Informs network subscribers to hot-reload target avatar imagery |
| **`join_room`** | Client → Server | Switches subscriber stream to a targeted channel subset |
| **`create_room`** | Client → Server | Appends custom accessible rooms to the active pool |
| **`typing`** | Client → Server | Broadcasts temporary activity boolean states per room |

---

## 💻 Local Development & Execution

### Prerequisites
- [Node.js](https://nodejs.org/) (v16+ recommended)
- Local or Cloud [MongoDB](https://www.mongodb.com/) instance

### 1. Initialize the Backend Server
```bash
cd server
npm install
# Set up environment variables if needed (e.g., MONGO_URI, PORT=3001)
npm run dev
```
*Server runs natively on `http://localhost:3001` with auto-reloading enabled.*

### 2. Launch the Frontend Client
```bash
cd client
npm install
# Creates/uses local environment pointing to your socket host
npm run dev
```
*Client serves hot-reloaded source files on `http://localhost:5173`.*

---

## 🌐 Deployment Configuration

- **Frontend**: Directly deployable on **Vercel**. Ensure the root `vercel.json` maps builds to the `client/` subdirectory correctly, and set the production environment variable:
  ```env
  VITE_SERVER_URL=https://chaat-server-production.up.railway.app
  ```
- **Backend**: Hosted on **Railway**. Consumes dynamically injected references like `${{MongoDB.MONGO_URL}}` to pair directly with integrated cloud database instances.
