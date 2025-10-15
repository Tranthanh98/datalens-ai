# DataLens AI Extension - Development Guide

## 📦 Setup

### 1. Install Dependencies

```bash
cd vs-extension
npm install
```

### 2. Compile TypeScript

```bash
npm run compile
```

Or watch for changes:

```bash
npm run watch
```

## 🚀 Running the Extension

### Method 1: Debug in VS Code

1. Open the `vs-extension` folder in VS Code
2. Press `F5` or go to Run > Start Debugging
3. A new VS Code window will open with the extension loaded
4. Test the extension in the new window

### Method 2: Package and Install

```bash
# Package the extension
npm run package

# This will create a .vsix file
# Install it using:
code --install-extension datalens-ai-extension-0.0.1.vsix
```

## 🔧 Configuration

### Setting up Gemini API Key

1. In VS Code, press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac)
2. Type "DataLens: Set Gemini API Key"
3. Enter your API key from [Google AI Studio](https://makersuite.google.com/app/apikey)

### Connecting to a Database

1. Press `Ctrl+Shift+P` / `Cmd+Shift+P`
2. Type "DataLens: Connect Database"
3. Fill in the connection details:

   - **PostgreSQL Example:**

     - Type: PostgreSQL
     - Host: localhost
     - Port: 5432
     - Database: your_database
     - Username: postgres
     - Password: your_password
     - SSL: (check if needed)

   - **SQL Server Example:**
     - Type: SQL Server
     - Host: localhost
     - Port: 1433
     - Database: your_database
     - Username: sa
     - Password: your_password
     - SSL: (usually unchecked for local dev)

4. Click "Test Connection" to verify
5. Click "Save & Connect" to save

## 📝 Usage

### Opening the Chat

1. Click the DataLens icon in the Activity Bar (left sidebar)
2. Or use Command Palette: "DataLens: Open Chat"

### Asking Questions

Type natural language questions like:

- "How many records are in the users table?"
- "Show me the top 5 products by sales"
- "What is the average order value this month?"

The AI will:

1. Understand your question
2. Generate a SQL query based on your database schema
3. Execute the query
4. Provide a natural language answer with the results

## 🏗️ Project Structure

```
vs-extension/
├── src/
│   ├── extension.ts          # Main extension entry point
│   ├── types.ts               # TypeScript type definitions
│   ├── services/
│   │   ├── DatabaseService.ts # Database connection & query execution
│   │   └── AIService.ts       # Gemini AI integration
│   └── panels/
│       ├── DatabaseConnectionPanel.ts  # Connection form UI
│       └── ChatPanel.ts       # Chat interface UI
├── resources/
│   └── icon.svg              # Extension icon
├── package.json              # Extension manifest
├── tsconfig.json             # TypeScript configuration
└── README.md                 # User documentation
```

## 🐛 Troubleshooting

### Extension not showing up

- Make sure you compiled the TypeScript code: `npm run compile`
- Check the Output panel for errors (View > Output > Extension Host)

### Database connection fails

- Verify your database is running
- Check connection details (host, port, username, password)
- For PostgreSQL, ensure `pg_hba.conf` allows your connection
- For SQL Server, ensure TCP/IP is enabled in SQL Server Configuration Manager

### AI not responding

- Verify your Gemini API key is set correctly
- Check your internet connection
- Look at the Output panel for error messages

### Schema not loading

- Ensure your database user has permission to read schema information
- Check that the database has tables (not empty)

## 🔒 Security Notes

- API keys are stored in VS Code's secure storage (not in plain text)
- Database passwords are stored in VS Code settings (encrypted)
- Only SELECT queries are allowed - no data modification
- All queries are validated before execution

## 📚 Dependencies

- `@google/genai` - Gemini AI SDK
- `pg` - PostgreSQL client
- `mssql` - SQL Server client
- `@types/vscode` - VS Code API types

## 🧪 Testing

To test the extension:

1. Set up a test database with sample data
2. Connect to it using the extension
3. Try various questions to test AI query generation
4. Verify the results are accurate

## 📦 Publishing (Optional)

To publish to VS Code Marketplace:

1. Create a [publisher account](https://marketplace.visualstudio.com/manage)
2. Get a Personal Access Token
3. Package and publish:

```bash
npm install -g @vscode/vsce
vsce login <publisher-name>
vsce publish
```

## 🤝 Contributing

Feel free to:

- Report bugs
- Suggest features
- Submit pull requests

## 📄 License

MIT
