# Change Log

All notable changes to the "DataLens AI" extension will be documented in this file.

## [0.0.1] - 2025-01-XX

### Added

- Initial release
- Database connection support for PostgreSQL and SQL Server
- Interactive chat interface with AI-powered query generation
- Secure storage for API keys and database credentials
- Automatic schema introspection and caching
- Natural language to SQL conversion using Gemini AI
- Real-time query execution and result formatting
- Connection testing before saving
- Read-only query enforcement for security

### Features

- **Database Management**

  - Connect to PostgreSQL and SQL Server databases
  - Test connections before saving
  - Secure credential storage
  - Automatic schema fetching

- **AI Chat Interface**

  - Natural language query interface
  - Context-aware SQL generation
  - Formatted result presentation
  - Chat history management
  - Loading indicators

- **Security**
  - API keys stored in VS Code secret storage
  - Database passwords encrypted
  - Only SELECT queries allowed
  - Input validation and sanitization

### Known Limitations

- Single database connection at a time
- No MySQL support yet (planned for future release)
- Basic result formatting (no charts/visualizations)
- In-memory chat history only

### Future Improvements

- [ ] MySQL database support
- [ ] Multiple simultaneous database connections
- [ ] Persistent chat history
- [ ] Query result export (CSV, JSON)
- [ ] SQL syntax highlighting in responses
- [ ] Database schema explorer panel
- [ ] Query performance metrics
- [ ] Query history panel with re-run capability
- [ ] Custom AI model configuration
- [ ] Result visualization (charts, graphs)
