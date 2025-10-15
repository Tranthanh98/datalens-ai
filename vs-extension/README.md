# DataLens AI - VS Code Extension

> Chat with your database using AI - supports PostgreSQL and MSSQL

## 🚀 Features

- 🔌 **Easy Database Connection**: Connect to PostgreSQL and SQL Server databases with a simple form
- 🧠 **AI-Powered Queries**: Ask questions in natural language and get SQL queries generated automatically
- 💬 **Interactive Chat**: Chat with your database through an intuitive sidebar interface
- 🔐 **Secure**: API keys and passwords stored securely using VS Code's secret storage
- 📊 **Schema Introspection**: Automatically fetches and analyzes your database schema

## 📦 Installation

1. Install the extension from VS Code Marketplace
2. Open the extension by clicking on the DataLens icon in the Activity Bar

## 🎯 Getting Started

### Step 1: Set your Gemini API Key

1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
2. Type "DataLens: Set Gemini API Key"
3. Enter your Gemini API key

### Step 2: Connect to a Database

1. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
2. Type "DataLens: Connect Database"
3. Fill in your database connection details:
   - Database Name (friendly name)
   - Database Type (PostgreSQL or SQL Server)
   - Host
   - Port
   - Database Name
   - Username
   - Password
   - SSL (optional)
4. Click "Test Connection" to verify
5. Click "Save & Connect" to save the connection and fetch the schema

### Step 3: Start Chatting

1. Open the DataLens sidebar by clicking the icon in the Activity Bar
2. Type your question in natural language, for example:
   - "How many users do we have?"
   - "Show me the top 10 customers by revenue"
   - "What are the most popular products this month?"
3. The AI will generate a SQL query, execute it, and provide you with an answer

## 🛠️ Commands

- `DataLens: Open Chat` - Open the chat panel
- `DataLens: Connect Database` - Open the database connection form
- `DataLens: Set Gemini API Key` - Set or update your Gemini API key

## 🔒 Security

- Database passwords are stored in VS Code's secure storage
- Gemini API keys are stored using VS Code's secret storage API
- Only SELECT queries are allowed - no data modification operations

## 📋 Requirements

- VS Code 1.85.0 or higher
- Gemini API Key (get one from [Google AI Studio](https://makersuite.google.com/app/apikey))
- Access to a PostgreSQL or SQL Server database

## 🐛 Known Issues

- Large schemas may take longer to load
- Complex queries might require refinement

## 📝 Release Notes

### 0.0.1

- Initial release
- Support for PostgreSQL and SQL Server
- AI-powered natural language to SQL conversion
- Secure credential storage
- Interactive chat interface

## 🤝 Contributing

Found a bug or have a feature request? Please open an issue on GitHub.

## 📄 License

MIT

## 👨‍💻 Author

Created for AI Got Talent 2025

---

**Enjoy chatting with your database! 🚀**
