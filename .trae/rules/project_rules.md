# DataLens AI - Project Rules

## 🎯 Project Overview
DataLens AI là một web app demo cho phép người dùng trò chuyện với cơ sở dữ liệu bằng ngôn ngữ tự nhiên. Dự án tập trung vào việc kết hợp AI, Database và Data Visualization trong một frontend-only stack.

## 🛠️ Tech Stack & Dependencies

### Core Framework
- **Frontend**: Vite + React 19 + TypeScript
- **Package Manager**: pnpm (REQUIRED - không sử dụng npm hoặc yarn)
- **Build Tool**: Vite với TypeScript compilation

### UI & Styling
- **CSS Framework**: TailwindCSS v4+ với @tailwindcss/vite plugin
- **Component Library**: shadcn/ui
- **Icons**: lucide-react
- **Code Highlighting**: prism-react-renderer

### Data & State Management
- **Local Storage**: IndexedDB via Dexie.js
- **State Management**: TanStack Query
- **Charts**: Recharts

### AI & Backend
- **AI Provider**: OpenAI API (GPT)
- **Query Execution**: ExpressJS (local proxy)

## 📁 Folder Structure Rules

```
/src
├── components/     # Chat UI, Schema Explorer, Chart Viewer
├── db/            # IndexedDB setup (Dexie)
├── hooks/         # useChat, useSchema, useQueryExecution
├── pages/         # Main app pages
├── utils/         # Helper for AI prompt, SQL parsing
├── App.tsx
├── main.tsx
└── types.ts       # Shared interfaces
```

### Naming Conventions
- **Components**: PascalCase (e.g., `ChatInterface.tsx`, `SchemaExplorer.tsx`)
- **Hooks**: camelCase với prefix "use" (e.g., `useChat.ts`, `useSchema.ts`)
- **Utils**: camelCase (e.g., `sqlParser.ts`, `aiPromptHelper.ts`)
- **Types**: PascalCase interfaces trong `types.ts`

## 💻 Coding Standards

### TypeScript Rules
- **ALWAYS** sử dụng TypeScript, không JavaScript
- **ALWAYS** định nghĩa interfaces cho props và data structures
- **PREFER** functional components over class components
- **PREFER** arrow functions cho component definitions
- **ALWAYS** export default cho main components

### React Best Practices
- **ALWAYS** sử dụng React hooks (useState, useEffect, custom hooks)
- **PREFER** custom hooks cho logic tái sử dụng
- **ALWAYS** thêm function-level comments cho components phức tạp
- **ALWAYS** handle loading và error states

### Code Quality
- **FOLLOW** ESLint configuration đã có
- **KEEP** code simple, modular và dễ maintain
- **INCLUDE** brief explanations cho changes
- **NEVER** commit code có lỗi ESLint

## 🗄️ Database & Storage Rules

### IndexedDB Structure
```
- sessions: Lưu session AI chat
- messages: Các tin nhắn người dùng & AI
- schemas: Schema JSON sau introspection
- queries: Lịch sử query & kết quả
```

### Data Management
- **ALWAYS** sử dụng Dexie.js cho IndexedDB operations
- **ALWAYS** handle offline scenarios
- **IMPLEMENT** proper error handling cho database operations
- **CACHE** schema và query results locally

## 🤖 AI Integration Rules

### OpenAI API
- **ALWAYS** sử dụng environment variables cho API keys
- **IMPLEMENT** proper error handling cho API calls
- **OPTIMIZE** prompts cho SQL generation
- **HANDLE** rate limiting và API errors gracefully

### Prompt Engineering
- **INCLUDE** database schema trong AI prompts
- **PROVIDE** clear context cho SQL generation
- **VALIDATE** generated SQL trước khi execution

## 🎨 UI/UX Guidelines

### TailwindCSS
- **USE** TailwindCSS v4+ syntax
- **PREFER** utility classes over custom CSS
- **MAINTAIN** consistent spacing và color scheme
- **IMPLEMENT** responsive design

### shadcn/ui Components
- **USE** shadcn/ui components khi có sẵn
- **CUSTOMIZE** components theo design requirements
- **MAINTAIN** consistent component patterns

### Charts & Visualization
- **USE** Recharts cho data visualization
- **IMPLEMENT** responsive charts
- **PROVIDE** meaningful chart titles và labels
- **HANDLE** empty data states

## 🔧 Development Workflow

### Environment Setup
```bash
# Required environment variables
VITE_OPENAI_API_KEY=sk-xxxx
VITE_BACKEND_URL=http://localhost:3001  # optional
```

### Commands
```bash
pnpm install    # Install dependencies
pnpm dev       # Start development server
pnpm build     # Build for production
pnpm lint      # Run ESLint
pnpm preview   # Preview production build
```

### Git Workflow
- **NEVER** commit `.env` files
- **ALWAYS** test trước khi commit
- **WRITE** meaningful commit messages
- **FOLLOW** conventional commits format

## 🚫 Restrictions

### What NOT to do
- **NEVER** sử dụng npm hoặc yarn (chỉ pnpm)
- **NEVER** reinitialize hoặc reinstall project
- **NEVER** thay đổi core folder structure
- **NEVER** commit sensitive data (API keys, credentials)
- **NEVER** auto run remove hoặc kill commands without confirmation

### Security
- **ALWAYS** validate user inputs
- **NEVER** expose API keys trong client code
- **IMPLEMENT** proper error boundaries
- **SANITIZE** SQL inputs để tránh injection

## 📝 Documentation Rules

### Code Comments
- **ADD** function-level comments cho complex logic
- **EXPLAIN** business logic và AI integration points
- **DOCUMENT** custom hooks và utilities
- **INCLUDE** JSDoc comments cho public APIs

### README Updates
- **KEEP** README.md updated với new features
- **DOCUMENT** environment variables requirements
- **MAINTAIN** installation instructions accuracy

## 🎯 Performance Guidelines

### Optimization
- **IMPLEMENT** proper loading states
- **USE** React.memo cho expensive components
- **OPTIMIZE** bundle size với code splitting
- **CACHE** API responses appropriately

### IndexedDB Performance
- **INDEX** frequently queried fields
- **BATCH** database operations khi có thể
- **CLEANUP** old data periodically
- **MONITOR** storage usage

## 🧪 Testing (Future)

### Testing Strategy
- **PLAN** for unit tests với Jest/Vitest
- **TEST** custom hooks thoroughly
- **MOCK** external APIs trong tests
- **COVER** critical user flows

---

*Các quy tắc này được thiết kế để đảm bảo code quality, maintainability và consistency trong dự án DataLens AI.*