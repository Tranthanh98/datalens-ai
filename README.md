# 🧠 DataLens AI

> Your local AI assistant for querying and visualizing your database — just ask in plain language!

---

## 🚀 Overview

**DataLens AI** là một web app demo giúp bạn **trò chuyện với cơ sở dữ liệu**:

- Kết nối hoặc tải file schema `.sql`
- AI tự **hiểu cấu trúc database**, **tạo SQL query**, **chạy query**, và **trực quan hóa dữ liệu**
- Lưu lại lịch sử chat, schema, kết quả truy vấn ngay trong **IndexedDB** (offline)

Mục tiêu của dự án là trình diễn sức mạnh của **AI + Database + Visualization**, được xây dựng nhanh gọn bằng **frontend-only stack**.

---

## 🧩 Tech Stack

| Layer                 | Tech                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Frontend Framework    | [Vite](https://vitejs.dev/) + [React](https://react.dev/) + TypeScript                                              |
| UI / Styling          | [TailwindCSS](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) + [lucide-react](https://lucide.dev/) |
| AI                    | GEMINI AI API                                                                                                       |
| Local Storage         | IndexedDB (via [Dexie.js](https://dexie.org/))                                                                      |
| Chart / Visualization | [Recharts](https://recharts.org/en-US/)                                                                             |
| Query Execution       | ExpressJS (local proxy)                                                                                             |
| Code Highlight        | prism-react-renderer                                                                                                |
| State / Query         | TanStack Query                                                                                                      |

---

## 🧱 Folder Structure

/src
├── components/ # Chat UI, Schema Explorer, Chart Viewer
├── db/ # IndexedDB setup (Dexie)
├── hooks/ # useChat, useSchema, useQueryExecution
├── pages/ # Main app pages
├── utils/ # Helper for AI prompt, SQL parsing
├── App.tsx
├── main.tsx
└── types.ts # Shared interfaces

---

## ⚙️ Installation

### 1️⃣ Clone repo

```bash
git clone https://github.com/<yourname>/datalens-ai.git
cd datalens-ai
```

### 2️⃣ Install dependencies

```bash
pnpm install
```

### 3️⃣ Set up environment variables

Create a `.env` file in the root directory with the following content:

```bash
VITE_GEMINI_API_KEY=sk-xxxx
VITE_BACKEND_URL=http://localhost:3001   # optional nếu có backend
```

## 🧠 How It Works

🔹 Step 1 — Load schema

- \*\* Upload file .sql (hoặc connect DB bằng connection string)

- \*\* App tự phân tích schema → lưu IndexedDB → render cây bảng & quan hệ

🔹 Step 2 — Ask AI

- “Hôm nay có bao nhiêu đơn hàng?”

- AI đọc schema + câu hỏi

- \*\* App sinh ra câu SQL tương ứng

- Gửi xuống backend (hoặc SQLite WASM)

🔹 Step 3 — Execute & Visualize

- Backend chạy SQL → trả kết quả JSON

- App render bảng kết quả, biểu đồ thống kê, và phân tích nhanh

## 🧠 IndexedDB Structure

| Store      | Key | Purpose                       |
| ---------- | --- | ----------------------------- |
| `sessions` | id  | Lưu session AI chat           |
| `messages` | id  | Các tin nhắn người dùng & AI  |
| `schemas`  | id  | Schema JSON sau introspection |
| `queries`  | id  | Lịch sử query & kết quả       |

## 💡 Future Ideas

- **Tự động gợi ý biểu đồ phù hợp (bar, pie, line)**

- **Cho phép export kết quả ra .csv hoặc .png**

- **Giao diện drag & drop để tạo query không cần code**

- **Hỗ trợ nhiều DB engine (Postgres, MSSQL, MySQL)**

## 👨‍💻 Author

Thành Trần
💼 IT Engineer | AI Enthusiast
📍 Ho Chi Minh City, Vietnam
🧡 Project for AI Got Talent 2025
