import * as vscode from "vscode";
import { ChatPanel } from "./panels/ChatPanel";
import { DatabaseConnectionPanel } from "./panels/DatabaseConnectionPanel";
import { DatabaseConnection, DatabaseSchema } from "./types";

/**
 * Activates the DataLens AI extension
 */
export function activate(context: vscode.ExtensionContext) {
  console.log("DataLens AI extension is now active!");

  // Store context globally for access in panels
  (global as Record<string, unknown>).datalensContext = context;

  // Create status bar item to show current database
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100
  );
  statusBarItem.command = "datalens.showCurrentDatabase";
  context.subscriptions.push(statusBarItem);

  // Function to update status bar
  const updateStatusBar = async () => {
    const currentDatabaseId =
      context.workspaceState.get<string>("currentDatabase");

    if (!currentDatabaseId) {
      statusBarItem.text = "$(database) No DB";
      statusBarItem.tooltip = "No database selected. Click to select one.";
    } else {
      const config = vscode.workspace.getConfiguration("datalens");
      const connections = config.get<DatabaseConnection[]>("databases") || [];
      const currentConnection = connections.find(
        (conn) => conn.id === currentDatabaseId
      );

      if (currentConnection) {
        statusBarItem.text = `$(database) ${currentConnection.name}`;
        statusBarItem.tooltip = `Current database: ${currentConnection.name} (${currentConnection.type})`;
      } else {
        statusBarItem.text = "$(database) DB Error";
        statusBarItem.tooltip =
          "Current database not found. Click to select a new one.";
      }
    }

    statusBarItem.show();
  };

  // Store updateStatusBar globally for access in other functions
  (global as Record<string, unknown>).updateStatusBar = updateStatusBar;

  // Update status bar initially and when workspace state changes
  updateStatusBar();

  // Register command to open chat panel
  const openChatCommand = vscode.commands.registerCommand(
    "datalens.openChat",
    () => {
      ChatPanel.createOrShow(context.extensionUri);
    }
  );

  // Register command to connect database
  const connectDatabaseCommand = vscode.commands.registerCommand(
    "datalens.connectDatabase",
    () => {
      DatabaseConnectionPanel.createOrShow(context.extensionUri);
    }
  );

  // Register command to set API key
  const setApiKeyCommand = vscode.commands.registerCommand(
    "datalens.setApiKey",
    async () => {
      const apiKey = await vscode.window.showInputBox({
        prompt: "Enter your Gemini API Key",
        password: true,
        placeHolder: "AIza...",
        ignoreFocusOut: true,
      });

      if (apiKey) {
        await context.secrets.store("datalens.geminiApiKey", apiKey);
        vscode.window.showInformationMessage(
          "Gemini API Key saved successfully!"
        );
      }
    }
  );

  // Register command to list databases
  const listDatabasesCommand = vscode.commands.registerCommand(
    "datalens.listDatabases",
    async () => {
      const config = vscode.workspace.getConfiguration("datalens");
      const connections = config.get<DatabaseConnection[]>("databases") || [];

      if (connections.length === 0) {
        vscode.window.showInformationMessage(
          "No databases configured. Use 'Connect Database' to add one."
        );
        return;
      }

      const currentDatabase =
        context.workspaceState.get<string>("currentDatabase");

      // Create quick pick items with current database marked
      const items = connections.map((conn) => ({
        label: conn.name,
        description: `${conn.type} - ${conn.host}:${conn.port}/${conn.database}`,
        detail: conn.id === currentDatabase ? "✓ Currently selected" : "",
        id: conn.id,
      }));

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: "Database Connections",
        title: "Manage Database Connections",
      });

      if (selected) {
        const actions = await vscode.window.showQuickPick(
          [
            { label: "$(check) Select as Current Database", action: "select" },
            { label: "$(trash) Delete Database", action: "delete" },
            { label: "$(info) View Details", action: "details" },
          ],
          {
            placeHolder: `What would you like to do with "${selected.label}"?`,
          }
        );

        if (actions?.action === "select") {
          await context.workspaceState.update("currentDatabase", selected.id);
          updateStatusBar();
          vscode.window.showInformationMessage(
            `Selected "${selected.label}" as current database`
          );
        } else if (actions?.action === "delete") {
          await deleteDatabase(
            context,
            selected.id!,
            selected.label,
            updateStatusBar
          );
        } else if (actions?.action === "details") {
          const connection = connections.find((c) => c.id === selected.id);
          if (connection) {
            vscode.window.showInformationMessage(
              `Database: ${connection.name}\nType: ${connection.type}\nHost: ${connection.host}:${connection.port}\nDatabase: ${connection.database}\nUsername: ${connection.username}`
            );
          }
        }
      }
    }
  );

  // Register command to select database
  const selectDatabaseCommand = vscode.commands.registerCommand(
    "datalens.selectDatabase",
    async () => {
      const config = vscode.workspace.getConfiguration("datalens");
      const connections = config.get<DatabaseConnection[]>("databases") || [];

      if (connections.length === 0) {
        vscode.window.showInformationMessage(
          "No databases configured. Use 'Connect Database' to add one."
        );
        return;
      }

      const currentDatabase =
        context.workspaceState.get<string>("currentDatabase");

      const items = connections.map((conn) => ({
        label: conn.name,
        description: `${conn.type} - ${conn.host}:${conn.port}/${conn.database}`,
        detail: conn.id === currentDatabase ? "Currently selected" : "",
        id: conn.id,
      }));

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: "Select a database to use as current database",
      });

      if (selected) {
        await context.workspaceState.update("currentDatabase", selected.id);
        updateStatusBar();
        vscode.window.showInformationMessage(
          `Selected "${selected.label}" as current database`
        );
      }
    }
  );

  // Register command to delete database
  const deleteDatabaseCommand = vscode.commands.registerCommand(
    "datalens.deleteDatabase",
    async () => {
      const config = vscode.workspace.getConfiguration("datalens");
      const connections = config.get<DatabaseConnection[]>("databases") || [];

      if (connections.length === 0) {
        vscode.window.showInformationMessage(
          "No databases configured to delete."
        );
        return;
      }

      const items = connections.map((conn) => ({
        label: conn.name,
        description: `${conn.type} - ${conn.host}:${conn.port}/${conn.database}`,
        id: conn.id,
      }));

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: "Select a database to delete",
      });

      if (selected) {
        await deleteDatabase(
          context,
          selected.id!,
          selected.label,
          updateStatusBar
        );
      }
    }
  );

  // Register command to show current database
  const showCurrentDatabaseCommand = vscode.commands.registerCommand(
    "datalens.showCurrentDatabase",
    async () => {
      const currentDatabaseId =
        context.workspaceState.get<string>("currentDatabase");

      if (!currentDatabaseId) {
        vscode.window.showInformationMessage(
          "No database currently selected. Use 'Select Database' to choose one."
        );
        return;
      }

      const config = vscode.workspace.getConfiguration("datalens");
      const connections = config.get<DatabaseConnection[]>("databases") || [];
      const currentConnection = connections.find(
        (conn) => conn.id === currentDatabaseId
      );

      if (!currentConnection) {
        vscode.window.showWarningMessage(
          "Current database connection not found. It may have been deleted."
        );
        await context.workspaceState.update("currentDatabase", undefined);
        return;
      }

      // Get schema info
      const schemas =
        context.globalState.get<Record<string, DatabaseSchema[]>>("schemas") ||
        {};
      const currentSchema = schemas[currentDatabaseId] || [];
      const tableCount = currentSchema.length;

      vscode.window
        .showInformationMessage(
          `Current Database: ${currentConnection.name}\n` +
            `Type: ${currentConnection.type.toUpperCase()}\n` +
            `Host: ${currentConnection.host}:${currentConnection.port}\n` +
            `Database: ${currentConnection.database}\n` +
            `Tables: ${tableCount} table(s) available`,
          "Change Database",
          "View Tables"
        )
        .then((action) => {
          if (action === "Change Database") {
            vscode.commands.executeCommand("datalens.selectDatabase");
          } else if (action === "View Tables") {
            if (tableCount > 0) {
              const tableList = currentSchema
                .map(
                  (table) =>
                    `• ${table.table_schema}.${table.table_name} (${table.columns.length} columns)`
                )
                .join("\n");
              vscode.window.showInformationMessage(
                `Tables in ${currentConnection.name}:\n\n${tableList}`,
                { modal: true }
              );
            } else {
              vscode.window.showInformationMessage(
                "No tables found in the current database schema."
              );
            }
          }
        });
    }
  );

  // Register webview view provider for sidebar
  const provider = new ChatPanel(context.extensionUri);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("datalens.chatView", provider)
  );

  context.subscriptions.push(
    openChatCommand,
    connectDatabaseCommand,
    setApiKeyCommand,
    listDatabasesCommand,
    selectDatabaseCommand,
    deleteDatabaseCommand,
    showCurrentDatabaseCommand
  );
}

/**
 * Helper function to delete a database connection
 */
async function deleteDatabase(
  context: vscode.ExtensionContext,
  databaseId: string,
  databaseName: string,
  updateStatusBar?: () => void
) {
  const confirm = await vscode.window.showWarningMessage(
    `Are you sure you want to delete the database connection "${databaseName}"?`,
    "Yes, Delete",
    "Cancel"
  );

  if (confirm === "Yes, Delete") {
    try {
      // Remove from configuration
      const config = vscode.workspace.getConfiguration("datalens");
      const connections = config.get<DatabaseConnection[]>("databases") || [];
      const updatedConnections = connections.filter(
        (conn) => conn.id !== databaseId
      );

      await config.update(
        "databases",
        updatedConnections,
        vscode.ConfigurationTarget.Global
      );

      // Remove schema from global state
      const schemas =
        context.globalState.get<Record<string, DatabaseSchema[]>>("schemas") ||
        {};
      delete schemas[databaseId];
      await context.globalState.update("schemas", schemas);

      // Clear current database if it was the deleted one
      const currentDatabase =
        context.workspaceState.get<string>("currentDatabase");
      if (currentDatabase === databaseId) {
        await context.workspaceState.update("currentDatabase", undefined);
      }

      // Update status bar after deletion
      if (updateStatusBar) {
        updateStatusBar();
      }

      vscode.window.showInformationMessage(
        `Database "${databaseName}" deleted successfully`
      );
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to delete database: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }
}

/**
 * Deactivates the extension
 */
export function deactivate() {
  console.log("DataLens AI extension is now deactivated!");
}
