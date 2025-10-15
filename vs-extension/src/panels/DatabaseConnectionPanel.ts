import * as vscode from "vscode";
import { DatabaseService } from "../services/DatabaseService";
import { DatabaseConnection, DatabaseSchema } from "../types";

/**
 * Panel for managing database connections
 */
export class DatabaseConnectionPanel {
  public static currentPanel: DatabaseConnectionPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private _disposables: vscode.Disposable[] = [];

  public static createOrShow(extensionUri: vscode.Uri) {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    // If we already have a panel, show it
    if (DatabaseConnectionPanel.currentPanel) {
      DatabaseConnectionPanel.currentPanel._panel.reveal(column);
      return;
    }

    // Otherwise, create a new panel
    const panel = vscode.window.createWebviewPanel(
      "datalensConnection",
      "Connect to Database",
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [extensionUri],
      }
    );

    DatabaseConnectionPanel.currentPanel = new DatabaseConnectionPanel(
      panel,
      extensionUri
    );
  }

  private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
    this._panel = panel;
    this._extensionUri = extensionUri;

    // Set the webview's initial html content
    this._update();

    // Listen for when the panel is disposed
    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    // Handle messages from the webview
    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.command) {
          case "testConnection":
            await this.handleTestConnection(message.connection);
            return;
          case "saveConnection":
            await this.handleSaveConnection(message.connection);
            return;
        }
      },
      null,
      this._disposables
    );
  }

  private async handleTestConnection(connection: DatabaseConnection) {
    try {
      const result = await DatabaseService.testConnection(connection);
      this._panel.webview.postMessage({
        command: "testConnectionResult",
        result,
      });
    } catch (error) {
      this._panel.webview.postMessage({
        command: "testConnectionResult",
        result: {
          success: false,
          error:
            error instanceof Error ? error.message : "Connection test failed",
        },
      });
    }
  }

  private async handleSaveConnection(connection: DatabaseConnection) {
    try {
      // Fetch schema
      const schemaResult = await DatabaseService.fetchSchema(connection);

      if (!schemaResult.success) {
        vscode.window.showErrorMessage(
          `Failed to fetch schema: ${schemaResult.error}`
        );
        return;
      }

      // Generate a new unique ID for this connection
      const newConnectionId = Date.now().toString();

      // Save connection and schema to workspace state
      const config = vscode.workspace.getConfiguration("datalens");
      const connections = config.get<DatabaseConnection[]>("databases") || [];

      // Add new connection with the new ID
      const newConnection = {
        ...connection,
        id: newConnectionId,
      };

      connections.push(newConnection);

      await config.update(
        "databases",
        connections,
        vscode.ConfigurationTarget.Global
      );

      // Store schema separately (in global state) using the SAME ID
      const context = (global as Record<string, unknown>)
        .datalensContext as vscode.ExtensionContext;
      if (context) {
        const schemas =
          context.globalState.get<Record<string, DatabaseSchema[]>>(
            "schemas"
          ) || {};
        schemas[newConnectionId] = schemaResult.schema || []; // Use the same new ID!
        await context.globalState.update("schemas", schemas);
      }

      vscode.window.showInformationMessage(
        `Database "${connection.name}" connected successfully!`
      );

      this._panel.dispose();
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to save connection: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  public dispose() {
    DatabaseConnectionPanel.currentPanel = undefined;

    // Clean up our resources
    this._panel.dispose();

    while (this._disposables.length) {
      const disposable = this._disposables.pop();
      if (disposable) {
        disposable.dispose();
      }
    }
  }

  private _update() {
    const webview = this._panel.webview;
    this._panel.webview.html = this._getHtmlForWebview(webview);
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Connect to Database</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background-color: var(--vscode-editor-background);
      padding: 20px;
    }
    
    .container {
      max-width: 600px;
      margin: 0 auto;
    }
    
    h1 {
      font-size: 24px;
      margin-bottom: 20px;
      color: var(--vscode-foreground);
    }
    
    .form-group {
      margin-bottom: 16px;
    }
    
    label {
      display: block;
      margin-bottom: 6px;
      font-size: 13px;
      font-weight: 500;
    }
    
    input, select {
      width: 100%;
      padding: 8px;
      background-color: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 2px;
      font-size: 13px;
    }
    
    input:focus, select:focus {
      outline: 1px solid var(--vscode-focusBorder);
    }
    
    .db-type-selector {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 20px;
    }
    
    .db-type-btn {
      padding: 12px;
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: 2px solid transparent;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 500;
      transition: all 0.2s;
    }
    
    .db-type-btn:hover {
      background-color: var(--vscode-button-secondaryHoverBackground);
    }
    
    .db-type-btn.active {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border-color: var(--vscode-focusBorder);
    }
    
    .button-group {
      display: flex;
      gap: 10px;
      margin-top: 24px;
    }
    
    button {
      padding: 10px 20px;
      border: none;
      border-radius: 2px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
      transition: background-color 0.2s;
    }
    
    .btn-primary {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    
    .btn-primary:hover {
      background-color: var(--vscode-button-hoverBackground);
    }
    
    .btn-secondary {
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }
    
    .btn-secondary:hover {
      background-color: var(--vscode-button-secondaryHoverBackground);
    }
    
    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .status-message {
      padding: 10px;
      border-radius: 4px;
      margin-top: 16px;
      font-size: 13px;
    }
    
    .status-success {
      background-color: var(--vscode-testing-iconPassed);
      color: var(--vscode-editor-background);
    }
    
    .status-error {
      background-color: var(--vscode-errorForeground);
      color: var(--vscode-editor-background);
    }
    
    .checkbox-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    input[type="checkbox"] {
      width: auto;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔌 Connect to Database</h1>
    
    <div class="form-group">
      <label>Database Name *</label>
      <input type="text" id="name" placeholder="My Database" required>
    </div>
    
    <div class="form-group">
      <label>Database Type *</label>
      <div class="db-type-selector">
        <button type="button" class="db-type-btn active" data-type="postgresql">
          🐘 PostgreSQL
        </button>
        <button type="button" class="db-type-btn" data-type="mssql">
          🏢 SQL Server
        </button>
      </div>
    </div>
    
    <div class="form-group">
      <label>Host *</label>
      <input type="text" id="host" placeholder="localhost" value="localhost" required>
    </div>
    
    <div class="form-group">
      <label>Port *</label>
      <input type="number" id="port" placeholder="5432" value="5432" required>
    </div>
    
    <div class="form-group">
      <label>Database *</label>
      <input type="text" id="database" placeholder="database_name" required>
    </div>
    
    <div class="form-group">
      <label>Username *</label>
      <input type="text" id="username" placeholder="username" required>
    </div>
    
    <div class="form-group">
      <label>Password *</label>
      <input type="password" id="password" placeholder="password" required>
    </div>
    
    <div class="form-group">
      <div class="checkbox-group">
        <input type="checkbox" id="ssl">
        <label for="ssl" style="margin-bottom: 0;">Use SSL Connection</label>
      </div>
    </div>
    
    <div class="button-group">
      <button type="button" class="btn-secondary" id="testBtn">Test Connection</button>
      <button type="button" class="btn-primary" id="saveBtn" disabled>Save & Connect</button>
    </div>
    
    <div id="statusMessage"></div>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    let currentType = 'postgresql';
    let connectionTested = false;
    
    // Database type selector
    document.querySelectorAll('.db-type-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.db-type-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentType = btn.dataset.type;
        
        // Update default port
        const portInput = document.getElementById('port');
        portInput.value = currentType === 'postgresql' ? '5432' : '1433';
        
        // Reset connection test status
        connectionTested = false;
        document.getElementById('saveBtn').disabled = true;
        document.getElementById('statusMessage').innerHTML = '';
      });
    });
    
    // Test connection
    document.getElementById('testBtn').addEventListener('click', () => {
      const connection = getConnectionData();
      
      if (!validateForm()) {
        showStatus('Please fill in all required fields', 'error');
        return;
      }
      
      document.getElementById('testBtn').disabled = true;
      document.getElementById('testBtn').textContent = 'Testing...';
      showStatus('Testing connection...', 'info');
      
      vscode.postMessage({
        command: 'testConnection',
        connection
      });
    });
    
    // Save connection
    document.getElementById('saveBtn').addEventListener('click', () => {
      const connection = getConnectionData();
      
      if (!validateForm()) {
        showStatus('Please fill in all required fields', 'error');
        return;
      }
      
      document.getElementById('saveBtn').disabled = true;
      document.getElementById('saveBtn').textContent = 'Saving...';
      showStatus('Fetching schema and saving connection...', 'info');
      
      vscode.postMessage({
        command: 'saveConnection',
        connection
      });
    });
    
    // Handle messages from extension
    window.addEventListener('message', event => {
      const message = event.data;
      
      switch (message.command) {
        case 'testConnectionResult':
          document.getElementById('testBtn').disabled = false;
          document.getElementById('testBtn').textContent = 'Test Connection';
          
          if (message.result.success) {
            connectionTested = true;
            document.getElementById('saveBtn').disabled = false;
            showStatus('✓ Connection successful!', 'success');
          } else {
            connectionTested = false;
            showStatus('✗ Connection failed: ' + (message.result.error || 'Unknown error'), 'error');
          }
          break;
      }
    });
    
    function getConnectionData() {
      return {
        id: Date.now().toString(),
        name: document.getElementById('name').value,
        type: currentType,
        host: document.getElementById('host').value,
        port: parseInt(document.getElementById('port').value),
        database: document.getElementById('database').value,
        username: document.getElementById('username').value,
        password: document.getElementById('password').value,
        ssl: document.getElementById('ssl').checked
      };
    }
    
    function validateForm() {
      const fields = ['name', 'host', 'port', 'database', 'username', 'password'];
      return fields.every(field => {
        const value = document.getElementById(field).value;
        return value && value.trim() !== '';
      });
    }
    
    function showStatus(message, type) {
      const statusDiv = document.getElementById('statusMessage');
      statusDiv.textContent = message;
      statusDiv.className = 'status-message';
      
      if (type === 'success') {
        statusDiv.classList.add('status-success');
      } else if (type === 'error') {
        statusDiv.classList.add('status-error');
      }
    }
  </script>
</body>
</html>`;
  }
}
