# Messenger Demo

A secure real-time messaging application with End-to-End Encryption (E2EE), built with .net 9 (SignalR) and Vue 3.

## Architecture Overview

The application follows a client-server architecture where the server acts as a blind relay and orchestrator, while all cryptographic operations are performed on the client side.

### Backend (.net 9)
- **SignalR Hub**: Manages real-time connections, room participation, and message broadcasting.
- **Core Layer**: Defines domain models (`ChatRoom`, `ChatMessage`) and interfaces for services and repositories.
- **Infrastructure Layer**: Implements data persistence (currently using an in-memory repository).
- **Security**: The backend never sees plaintext message content. It stores encrypted room keys and facilitates public key exchange.

### Frontend (Vue 3 + Vite)
- **State Management**: Pinia stores handle chat history, keys, and user sessions.
- **SignalR Service**: Manages the persistent WebSocket connection to the backend.
- **E2EE Service**: Utilizes the **Web Crypto API** for all cryptographic operations (AES-GCM, ECDH).
- **Components**: Modular Vue components for the chat interface and dashboard.

---

## End-to-End Encryption (E2EE)

The application implements a robust E2EE flow to ensure that only authorized participants can read messages.

### 1. Identity & Public Keys
- Each user generates an **ECDH (P-256)** key pair upon login/session start.
- Public keys are registered on the server via `RegisterPublicKey`.

### 2. Room Key Generation & Distribution
- When a room is created or a user joins, a symmetric **AES-GCM 256-bit** "Room Key" is used for the room's messages.
- If a user needs the room key (e.g., after joining), the creator or an existing member encrypts the Room Key using the new member's public key (via ECDH shared secret derivation).
- These encrypted room keys are stored on the server via `StoreRoomKey` and retrieved by members via `GetRoomKey`.

### 3. Message Encryption
- **Encryption**: Messages are encrypted locally using **AES-GCM**.
- **Payload**: The `ProtocolMessage` contains the encrypted payload as a raw string/JSON.
- **Persistence**: Encrypted messages are stored on the server, allowing for history retrieval while maintaining privacy.

---

## Communication Protocol

Communication occurs over SignalR using a standardized `ProtocolMessage` format.

```csharp
public record ProtocolMessage(
    string Type,                // "chat" | "presence" | "handshake" | etc.
    string SenderId,
    string RoomId,
    JsonElement Payload,        // Encrypted data or control information
    string? SenderDisplayName
);
```

### Key Message Types
- `chat`: Contains the AES-GCM encrypted message content.
- `presence`: Updates user status (online/offline).
- `RoomKey`: Distribution of encrypted room keys.
- `MemberPublicKeys`: Retrieval of public keys for E2EE handshakes.

---

## Project Structure

```text
.
├── README.md
├── backend/
│   └── ChatApp.Api/            # .net 9 Web API
│       ├── Core/               # Domain Models & Interfaces
│       ├── Infrastructure/     # Data Access (InMemory)
│       ├── Hubs/               # SignalR Hubs
│       └── Program.cs          # Dependency Injection & Middleware
└── frontend/
    └── src/                    # Vue 3 Frontend
        ├── services/           # SignalR & Crypto logic
        ├── stores/             # Pinia state (Chat, Keys)
        ├── components/         # UI Components
        └── views/              # Page Views
```

---

## Getting Started

### Prerequisites
- [.net 9 SDK](https://dotnet.microsoft.com/download/dotnet/9.0)
- [Node.js](https://nodejs.org/) (v18+)
- npm

### Installation & Run

1. **Backend**
   ```bash
   cd backend/ChatApp.Api
   dotnet run
   ```
   Server runs at `http://localhost:5133`.

2. **Frontend**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   Client runs at `http://localhost:5173`.

---

## Future Roadmap
- **Persistent Database**: Replace `InMemoryChatRepository` with PostgreSQL/SQL Server.
- **Identity Verification**: Implement Safety Numbers (fingerprints) for MitM protection.
- **File Encryption**: Support for E2EE file transfers.
- **Authentication**: Integrate JWT/OIDC for secure user identities.