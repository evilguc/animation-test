# 🎠 Character Animation Service (Cloudflare Workers)

This project provides a scalable **Cloudflare Workers backend** for managing **real-time animation sessions** using **WebSockets, Durable Objects, and KV storage**.

## 🚀 Getting Started

### **1️⃣ Prerequisites**

- **Node.js**
- **npm**
- **Cloudflare Wrangler**
  ```sh
  npm install -g wrangler
  ```

---

## **🏰 Setup the Project**

### **2️⃣ Clone the Repository**

```sh
git clone <repo-url>
cd character-animation-service
```

### **3️⃣ Install Dependencies**

```sh
npm install
cd test && npm install
cd ..
```

---

## **🛠️ Running the Project Locally**

There are **two ways** to run the service:

- **🔹 Manual Mode:** Manually create users & characters, then interact with the service.
- **🔹 Data Population Script:** A simple script to populate data and send test requests.

---

## **🔹 1️⃣ Manual Mode (Step by Step)**

If you prefer **manual testing**, follow these steps:

### **1️⃣ Generate Keys**

```sh
cd test/
npm run generate-jwt
mv output/.dev.vars ../.dev.vars
cd ..
```

- This will create necessary RSA key pairs and store them in `output/`
- It will also generate a `.dev.vars` file for local Wrangler setup.

### **2️⃣ Start the Cloudflare Worker**

```sh
wrangler dev --ip 127.0.0.1
```

- The service should now be running locally.

### **3️⃣ Create Users & Characters**

```sh
cd test/
npm run generate-character
```

- This will output:
  - A **`curl` command** to create a user-character mapping
  - A **JWT token** for authenticating WebSocket connections
  - A command to generate another character for the same user

---

## **🤖 2️⃣ Data Population Script**

### **1️⃣ Setup Keys and Environment**

```sh
cd test/
npm run generate-jwt
mv output/.dev.vars ../.dev.vars
cp simulation.env.template .env
cd ..
```

### **2️⃣ Start Cloudflare Worker**

```sh
wrangler dev --ip 127.0.0.1
```

### **3️⃣ Run Simulation Script** (in another terminal)

```sh
cd test/
npm run simulation
```

---

## **🐛 API Endpoints**

[View API Docs](https://petstore.swagger.io/?url=https://raw.githubusercontent.com/evilguc/animation-test/refs/heads/main/test/openapi.yaml)

| Method | Endpoint                                                | Description                         |
| ------ | ------------------------------------------------------- | ----------------------------------- |
| `POST` | `/service-api/test/setup-character-ownership`           | Create a test user-character pair   |
| `GET`  | `/service-api/sessions/active`                          | List all active sessions            |
| `GET`  | `/service-api/sessions/history/:characterId`            | Get session history for a character |
| `GET`  | `/service-api/sessions/history/:characterId/:sessionId` | Get a specific session's history    |
| `GET`  | `/service-api/session/:characterId/active`              | Get active session details          |

---

## **📅 Notes**

- **JWT Tokens are required** for both WebSockets and Service API requests.
- **WebSockets auto-expire** after inactivity.
- **Sessions are isolated per-character** (only one active session per character).

---

## 🌍 Deploying to Cloudflare (Untested)

> **Note:** These deployment steps have not been fully tested due to **Durable Objects requiring a paid Cloudflare plan**.

To deploy this worker on Cloudflare, follow these steps:

### 1️⃣ Log in to Cloudflare

```sh
wrangler login
```

This will open a browser window for authentication.

---

### 2️⃣ Create KV Namespaces

Run the following commands **one by one** to create the necessary KV storage:

```sh
wrangler kv:namespace create "SESSION_HISTORY"
wrangler kv:namespace create "CHARACTER_OWNERSHIP"
wrangler kv:namespace create "ACTIVE_SESSIONS"
```

Each command will return an **ID**.
Copy these IDs and **update `wrangler.jsonc`** in the `"kv_namespaces"` section:

```jsonc
{
  "kv_namespaces": [
    { "binding": "SESSION_HISTORY", "id": "your-session-history-id" },
    { "binding": "CHARACTER_OWNERSHIP", "id": "your-character-ownership-id" },
    { "binding": "ACTIVE_SESSIONS", "id": "your-active-sessions-id" },
  ],
}
```

---

### 3️⃣ Generate and Configure JWT Keys

Next, generate new RSA key pairs for JWT authentication:

```sh
cd test/
npm run generate-jwt
```

The output will contain **base64-encoded public keys** for **session authentication** and **service API authentication**.

- **Option 1:** Copy them from `output/.dev.vars`
- **Option 2:** Copy them directly from the command output

Now, set them in `wrangler.jsonc`:

```jsonc
{
  "vars": {
    "SESSION_JWT_PUBLIC_KEY_BASE64": "your-base64-session-key",
    "SERVICE_API_JWT_PUBLIC_KEY_BASE64": "your-base64-service-key",
  },
}
```

---

### 4️⃣ Deploy the Worker

Run the deployment command:

```sh
wrangler deploy
```

If your **Cloudflare account has Durable Objects enabled**, the worker should now be live.

---

### ⚠️ Important Notes

- **Durable Objects require a paid Cloudflare plan**.
- If you encounter issues, check logs with:
  ```sh
  wrangler tail
  ```
- API endpoints should now be available at:
  ```
  https://your-worker-name.YOUR_ACCOUNT.workers.dev
  ```
