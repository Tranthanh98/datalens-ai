import * as vscode from "vscode";
import { AIService } from "../services/AIService";
import { DatabaseService } from "../services/DatabaseService";
import { ChatMessage, DatabaseConnection, DatabaseSchema } from "../types";

/**
 * Chat panel for interacting with the database using AI
 */
export class ChatPanel implements vscode.WebviewViewProvider {
  public static readonly viewType = "datalens.chatView";
  private _view?: vscode.WebviewView;
  private _messages: ChatMessage[] = [];

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.command) {
        case "sendMessage":
          await this.handleSendMessage(data.message);
          break;
        case "clearChat":
          this.handleClearChat();
          break;
      }
    });
  }

  private async handleSendMessage(message: string) {
    try {
      // Add user message
      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        role: "user",
        content: message,
        timestamp: new Date(),
      };
      this._messages.push(userMessage);
      this._view?.webview.postMessage({
        command: "addMessage",
        message: userMessage,
      });

      // Show loading
      this._view?.webview.postMessage({ command: "setLoading", loading: true });

      // Get API key from secrets
      const context = (global as Record<string, unknown>)
        .datalensContext as vscode.ExtensionContext;
      const apiKey = await context.secrets.get("datalens.geminiApiKey");

      if (!apiKey) {
        throw new Error(
          'Please set your Gemini API Key first using the "DataLens: Set Gemini API Key" command'
        );
      }

      // Get active database connection
      const config = vscode.workspace.getConfiguration("datalens");
      const connections = config.get<DatabaseConnection[]>("databases") || [];

      if (connections.length === 0) {
        throw new Error(
          'Please connect to a database first using the "DataLens: Connect Database" command'
        );
      }

      // Use the first connection (you can add logic to select a specific one)
      const activeConnection = connections[0];

      // Get schema from global state
      const schemas =
        context.globalState.get<Record<string, DatabaseSchema[]>>("schemas") ||
        {};
      const schema = schemas[activeConnection.id];

      if (!schema) {
        throw new Error("Schema not found. Please reconnect to the database.");
      }

      // Initialize AI service
      const aiService = new AIService(apiKey);

      // Create SQL executor function
      const executeSQL = async (
        sql: string
      ): Promise<Record<string, unknown>[]> => {
        const result = await DatabaseService.executeQuery(
          activeConnection,
          sql
        );
        if (!result.success) {
          throw new Error(result.error || "Failed to execute query");
        }
        return result.data || [];
      };

      // Run AI query with multi-step reasoning
      const answer = await aiService.runAIQuery(
        message,
        schema,
        activeConnection.type,
        executeSQL
      );

      // Add AI response
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: answer,
        timestamp: new Date(),
      };
      this._messages.push(aiMessage);
      this._view?.webview.postMessage({
        command: "addMessage",
        message: aiMessage,
      });
    } catch (error) {
      // Show error message
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `❌ Error: ${
          error instanceof Error ? error.message : "An unknown error occurred"
        }`,
        timestamp: new Date(),
      };
      this._messages.push(errorMessage);
      this._view?.webview.postMessage({
        command: "addMessage",
        message: errorMessage,
      });
    } finally {
      // Hide loading
      this._view?.webview.postMessage({
        command: "setLoading",
        loading: false,
      });
    }
  }

  private handleClearChat() {
    this._messages = [];
    this._view?.webview.postMessage({ command: "clearMessages" });
  }

  public static createOrShow(extensionUri: vscode.Uri) {
    // This method is kept for compatibility with extension.ts
    // The actual view is registered in extension.ts activation
    vscode.commands.executeCommand("datalens.chatView.focus");
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DataLens Chat</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background-color: var(--vscode-sideBar-background);
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    
    .header {
      padding: 16px;
      border-bottom: 1px solid var(--vscode-panel-border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .header h2 {
      font-size: 16px;
      font-weight: 600;
    }
    
    .clear-btn {
      padding: 6px 12px;
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: none;
      border-radius: 3px;
      cursor: pointer;
      font-size: 12px;
    }
    
    .clear-btn:hover {
      background-color: var(--vscode-button-secondaryHoverBackground);
    }
    
    .chat-container {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    
    .message {
      display: flex;
      gap: 10px;
      animation: fadeIn 0.3s ease-in;
    }
    
    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    .message.user {
      flex-direction: row-reverse;
    }
    
    .message-bubble {
      max-width: 80%;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 13px;
      line-height: 1.5;
      word-wrap: break-word;
    }
    
    .message.user .message-bubble {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    
    .message.assistant .message-bubble {
      background-color: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
    }
    
    .message-time {
      font-size: 11px;
      opacity: 0.6;
      margin-top: 4px;
    }
    
    .loading {
      display: none;
      padding: 10px;
      text-align: center;
    }
    
    .loading.active {
      display: block;
    }
    
    .loading-dots {
      display: inline-flex;
      gap: 4px;
    }
    
    .loading-dot {
      width: 6px;
      height: 6px;
      background-color: var(--vscode-foreground);
      border-radius: 50%;
      opacity: 0.4;
      animation: pulse 1.4s infinite ease-in-out;
    }
    
    .loading-dot:nth-child(1) {
      animation-delay: -0.32s;
    }
    
    .loading-dot:nth-child(2) {
      animation-delay: -0.16s;
    }
    
    @keyframes pulse {
      0%, 80%, 100% {
        opacity: 0.4;
        transform: scale(1);
      }
      40% {
        opacity: 1;
        transform: scale(1.2);
      }
    }
    
    .input-container {
      padding: 16px;
      border-top: 1px solid var(--vscode-panel-border);
      display: flex;
      gap: 8px;
    }
    
    #messageInput {
      flex: 1;
      padding: 10px;
      background-color: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      border-radius: 4px;
      font-size: 13px;
      resize: none;
      font-family: var(--vscode-font-family);
    }
    
    #messageInput:focus {
      outline: 1px solid var(--vscode-focusBorder);
    }
    
    #sendBtn {
      padding: 10px 16px;
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
    }
    
    #sendBtn:hover {
      background-color: var(--vscode-button-hoverBackground);
    }
    
    #sendBtn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    
    .empty-state {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      text-align: center;
      padding: 20px;
      opacity: 0.6;
    }
    
    .empty-state-icon {
      font-size: 48px;
      margin-bottom: 16px;
    }
    
    .empty-state-title {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 8px;
    }
    
    .empty-state-text {
      font-size: 13px;
      color: var(--vscode-descriptionForeground);
    }
  </style>
</head>
<body>
  <div class="header">
    <h2>💬 Database Chat</h2>
    <button class="clear-btn" id="clearBtn">Clear</button>
  </div>
  
  <div class="chat-container" id="chatContainer">
    <div class="empty-state" id="emptyState">
      <div class="empty-state-icon">🤖</div>
      <div class="empty-state-title">Ask me about your data</div>
      <div class="empty-state-text">
        I can help you query and analyze your database using natural language
      </div>
    </div>
  </div>
  
  <div class="loading" id="loading">
    <div class="loading-dots">
      <div class="loading-dot"></div>
      <div class="loading-dot"></div>
      <div class="loading-dot"></div>
    </div>
  </div>
  
  <div class="input-container">
    <textarea 
      id="messageInput" 
      placeholder="Ask about your data..." 
      rows="1"
    ></textarea>
    <button id="sendBtn">Send</button>
  </div>

  <script>
    const vscode = acquireVsCodeApi();
    const chatContainer = document.getElementById('chatContainer');
    const messageInput = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');
    const clearBtn = document.getElementById('clearBtn');
    const loading = document.getElementById('loading');
    const emptyState = document.getElementById('emptyState');
    
    // Send message
    function sendMessage() {
      const message = messageInput.value.trim();
      if (!message) return;
      
      vscode.postMessage({
        command: 'sendMessage',
        message: message
      });
      
      messageInput.value = '';
      adjustTextareaHeight();
    }
    
    sendBtn.addEventListener('click', sendMessage);
    
    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
    
    // Clear chat
    clearBtn.addEventListener('click', () => {
      if (confirm('Clear all messages?')) {
        vscode.postMessage({ command: 'clearChat' });
      }
    });
    
    // Auto-resize textarea
    messageInput.addEventListener('input', adjustTextareaHeight);
    
    function adjustTextareaHeight() {
      messageInput.style.height = 'auto';
      messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
    }
    
    // Handle messages from extension
    window.addEventListener('message', event => {
      const message = event.data;
      
      switch (message.command) {
        case 'addMessage':
          addMessage(message.message);
          break;
        case 'setLoading':
          loading.classList.toggle('active', message.loading);
          sendBtn.disabled = message.loading;
          break;
        case 'clearMessages':
          clearMessages();
          break;
      }
    });
    
    function addMessage(message) {
      // Hide empty state
      emptyState.style.display = 'none';
      
      const messageDiv = document.createElement('div');
      messageDiv.className = \`message \${message.role}\`;
      
      const bubble = document.createElement('div');
      bubble.className = 'message-bubble';
      bubble.textContent = message.content;
      
      const time = document.createElement('div');
      time.className = 'message-time';
      time.textContent = new Date(message.timestamp).toLocaleTimeString();
      
      bubble.appendChild(time);
      messageDiv.appendChild(bubble);
      chatContainer.appendChild(messageDiv);
      
      // Scroll to bottom
      chatContainer.scrollTop = chatContainer.scrollHeight;
    }
    
    function clearMessages() {
      chatContainer.innerHTML = '';
      chatContainer.appendChild(emptyState);
      emptyState.style.display = 'flex';
    }
  </script>
</body>
</html>`;
  }
}
