import { AlertCircle, CheckCircle, Database, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import DatabaseSchemaService, {
  type DatabaseType,
  type DatabaseConnection as SchemaConnection,
} from "../services/databaseService";
import { useDatabaseStore } from "../store";
import { parseConnectionString } from "../utils/connectionStringParser";

interface DatabaseConnection {
  id: string;
  name: string;
  type: DatabaseType;
  connectionString?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  ssl?: boolean;
}

interface DatabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  // onAddDatabase: (database: DatabaseConnection) => Promise<number>;
}

type ConnectionMethod = "connection_string" | "standard";
type ConnectionStatus = "idle" | "success" | "error";

interface FormData {
  name: string;
  connectionString: string;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
}

/**
 * DatabaseModal component for adding new database connections
 * Supports MSSQL, PostgreSQL, and MySQL with both connection string and standard form inputs
 */
const DatabaseModal: React.FC<DatabaseModalProps> = ({ isOpen, onClose }) => {
  const [connectionMethod, setConnectionMethod] =
    useState<ConnectionMethod>("standard");
  const [databaseType, setDatabaseType] = useState<DatabaseType>("postgresql");
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus>("idle");
  const [connectionError, setConnectionError] = useState<string>("");
  const [connectionStringError, setConnectionStringError] =
    useState<string>("");
  const [isSavingDatabase, setIsSavingDatabase] = useState(false);
  const [schemaFetchStatus, setSchemaFetchStatus] = useState<
    "idle" | "fetching" | "cleaning" | "success" | "error"
  >("idle");

  const { addDatabase } = useDatabaseStore();

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    connectionString: "",
    host: "localhost",
    port: 5432,
    database: "",
    username: "",
    password: "",
    ssl: false,
  });

  // Default ports for different database types
  const defaultPorts = {
    postgresql: 5432,
    mysql: 3306,
    mssql: 1433,
  };

  /**
   * Handle ESC key to close modal
   */
  useEffect(() => {
    const handleEscKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscKey);
      // Prevent body scroll when modal is open
      document.body.style.overflow = "hidden";
    }

    return () => {
      document.removeEventListener("keydown", handleEscKey);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, onClose]);

  /**
   * Handle database type change and update default port
   */
  const handleDatabaseTypeChange = (type: DatabaseType) => {
    setDatabaseType(type);
    setFormData((prev) => ({
      ...prev,
      port: defaultPorts[type],
    }));
    setConnectionStatus("idle");
  };

  /**
   * Handle form input changes
   */
  /**
   * Validate connection string format
   */
  const validateConnectionString = (connectionString: string) => {
    if (!connectionString.trim()) {
      setConnectionStringError("Connection string is required");
      return false;
    }

    const parseResult = parseConnectionString(connectionString);
    if (!parseResult.success) {
      setConnectionStringError(
        parseResult.error || "Invalid connection string format"
      );
      return false;
    }

    setConnectionStringError("");
    return true;
  };

  /**
   * Handle input changes with validation for connection string
   */
  const handleInputChange = (
    field: keyof FormData,
    value: string | number | boolean
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    setConnectionStatus("idle");

    // Validate connection string on change
    if (field === "connectionString" && typeof value === "string") {
      validateConnectionString(value);
    }
  };

  /**
   * Test database connection using the schema service
   */
  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setConnectionStatus("idle");
    setConnectionError("");

    try {
      let connection: SchemaConnection;

      if (connectionMethod === "connection_string") {
        // Parse connection string
        const parseResult = parseConnectionString(formData.connectionString);

        if (!parseResult.success) {
          setConnectionStatus("error");
          setConnectionError(
            parseResult.error || "Invalid connection string format"
          );
          return;
        }

        connection = parseResult.data!;
      } else {
        // Build connection object from form data
        connection = {
          type: databaseType,
          host: formData.host,
          port: formData.port,
          database: formData.database,
          username: formData.username,
          password: formData.password,
          ssl: formData.ssl,
        };
      }

      // Test connection
      const result = await DatabaseSchemaService.testConnection(connection);

      if (result.success) {
        setConnectionStatus("success");
      } else {
        setConnectionStatus("error");
        setConnectionError(
          result.error || "Connection failed: Unable to connect to database."
        );
      }
    } catch {
      setConnectionStatus("error");
      setConnectionError("Connection failed: Network error occurred.");
    } finally {
      setIsTestingConnection(false);
    }
  };

  /**
   * Handle form submission - save database and fetch schema
   */
  const handleSubmit = async () => {
    if (connectionStatus !== "success") {
      alert(
        "Please test the connection successfully before adding the database."
      );
      return;
    }

    setIsSavingDatabase(true);
    setSchemaFetchStatus("idle");

    try {
      let dbPayload: {
        name: string;
        type: DatabaseType;
        connectionString?: string;
        host?: string;
        port?: number;
        database?: string;
        username?: string;
        password?: string;
        ssl?: boolean;
        isActive: boolean;
      };

      if (connectionMethod === "connection_string") {
        // Parse connection string to extract individual parameters
        const parseResult = parseConnectionString(formData.connectionString);

        if (!parseResult.success) {
          alert(
            "Invalid connection string format. Please check and try again."
          );
          setIsSavingDatabase(false);
          return;
        }

        const parsedData = parseResult.data!;

        // Prepare payload for API
        dbPayload = {
          name: formData.name,
          type: databaseType,
          connectionString: formData.connectionString,
          host: parsedData.host,
          port: parsedData.port,
          database: parsedData.database,
          username: parsedData.username,
          password: parsedData.password,
          ssl: parsedData.ssl || false,
          isActive: true,
        };
      } else {
        dbPayload = {
          name: formData.name,
          type: databaseType,
          host: formData.host,
          port: formData.port,
          database: formData.database,
          username: formData.username,
          password: formData.password,
          ssl: formData.ssl,
          isActive: true,
        };
      }

      // Save database to PostgreSQL via API
      const serverUrl =
        import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";
      const createDbResponse = await fetch(`${serverUrl}/api/databases`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(dbPayload),
      });

      if (!createDbResponse.ok) {
        throw new Error("Failed to create database connection");
      }

      const createDbResult = await createDbResponse.json();

      if (!createDbResult.success || !createDbResult.data) {
        throw new Error(createDbResult.error || "Failed to create database");
      }

      const dbId = createDbResult.data.id;
      console.log("Database created with ID:", dbId);

      addDatabase({
        id: dbId.toString(),
        ...dbPayload,
      });

      // Notify parent component (for backward compatibility with IndexedDB)

      // Fetch and save schema in background
      // setSchemaFetchStatus("fetching");

      // try {
      //   // Fetch raw schema from database
      //   const schemaResult = await DatabaseSchemaService.fetchSchema(dbId);

      //   if (schemaResult.success && schemaResult.schema) {
      //     console.log("Raw schema fetched successfully:", {
      //       tables: schemaResult.schema.length,
      //     });

      //     // Clean and enrich schema using AI
      //     setSchemaFetchStatus("cleaning");
      //     console.log("Cleaning and enriching schema with AI...");
      //     const cleanResult = await cleanAndEnrichSchema(
      //       schemaResult.schema,
      //       databaseType
      //     );

      //     if (cleanResult.success && cleanResult.cleanedSchema) {
      //       console.log("Schema cleaned successfully:", cleanResult.summary);

      //       // Save cleaned schema to PostgreSQL via API
      //       const saveSchemaResponse =
      //         await DatabaseSchemaService.saveSchemaToDatabase(
      //           dbId,
      //           cleanResult.cleanedSchema
      //         );

      //       if (saveSchemaResponse.success) {
      //         setSchemaFetchStatus("success");
      //         console.log(
      //           "Cleaned schema saved successfully for database:",
      //           formData.name,
      //           saveSchemaResponse.message
      //         );
      //       } else {
      //         throw new Error(
      //           saveSchemaResponse.error || "Failed to save schema"
      //         );
      //       }
      //     } else {
      //       // If cleaning fails, save original schema as fallback
      //       console.warn(
      //         "Schema cleaning failed, saving original schema:",
      //         cleanResult.error
      //       );

      //       const saveSchemaResponse = await fetch(
      //         `${serverUrl}/api/databases/${dbId}/schema`,
      //         {
      //           method: "POST",
      //           headers: {
      //             "Content-Type": "application/json",
      //           },
      //           body: JSON.stringify({
      //             tables: schemaResult.schema,
      //           }),
      //         }
      //       );

      //       if (saveSchemaResponse.ok) {
      //         setSchemaFetchStatus("success");
      //         console.log("Original schema saved successfully");
      //       } else {
      //         setSchemaFetchStatus("error");
      //       }
      //     }
      //   } else {
      //     setSchemaFetchStatus("error");
      //     console.warn("Failed to fetch schema:", schemaResult.error);
      //   }
      // } catch (schemaError) {
      //   setSchemaFetchStatus("error");
      //   console.error("Error fetching schema:", schemaError);
      // }

      // Close modal after a brief delay to show status
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (error) {
      console.error("Error adding database:", error);
      alert("Failed to add database. Please try again.");
      setIsSavingDatabase(false);
      setSchemaFetchStatus("idle");
    }
  };

  /**
   * Reset form and close modal
   */
  const handleClose = () => {
    setFormData({
      name: "",
      connectionString: "",
      host: "localhost",
      port:
        databaseType === "postgresql"
          ? 5432
          : databaseType === "mysql"
          ? 3306
          : 1433,
      database: "",
      username: "",
      password: "",
      ssl: false,
    });
    setConnectionMethod("standard");
    setDatabaseType("postgresql");
    setConnectionStatus("idle");
    setConnectionError("");
    setIsSavingDatabase(false);
    setSchemaFetchStatus("idle");
    onClose();
  };

  /**
   * Handle backdrop click to close modal
   */
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  const isValidForm = () => {
    if (connectionMethod === "connection_string") {
      return Boolean(formData.connectionString);
    } else {
      return (
        Boolean(formData.host) &&
        Boolean(formData.port) &&
        Boolean(formData.database) &&
        Boolean(formData.username) &&
        Boolean(formData.password)
      );
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <Database className="w-6 h-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              Add New Database
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Database Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Database Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              placeholder="Enter a name for this database connection"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
          </div>

          {/* Database Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Database Type *
            </label>
            <div className="grid grid-cols-3 gap-3">
              {[
                {
                  type: "postgresql" as const,
                  label: "PostgreSQL",
                  icon: "🐘",
                },
                { type: "mysql" as const, label: "MySQL", icon: "🐬" },
                { type: "mssql" as const, label: "SQL Server", icon: "🏢" },
              ].map(({ type, label, icon }) => (
                <button
                  key={type}
                  onClick={() => handleDatabaseTypeChange(type)}
                  className={`p-3 border rounded-lg text-center transition-colors ${
                    databaseType === type
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-300 hover:border-gray-400"
                  }`}
                >
                  <div className="text-2xl mb-1">{icon}</div>
                  <div className="text-sm font-medium">{label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Connection Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Connection Method
            </label>
            <div className="flex gap-4">
              <label className="flex items-center">
                <input
                  type="radio"
                  value="standard"
                  checked={connectionMethod === "standard"}
                  onChange={(e) =>
                    setConnectionMethod(e.target.value as ConnectionMethod)
                  }
                  className="mr-2"
                />
                Standard Connection
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  value="connection_string"
                  checked={connectionMethod === "connection_string"}
                  onChange={(e) =>
                    setConnectionMethod(e.target.value as ConnectionMethod)
                  }
                  className="mr-2"
                />
                Connection String
              </label>
            </div>
          </div>

          {/* Connection String Method */}
          {connectionMethod === "connection_string" && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Connection String *
              </label>
              <textarea
                value={formData.connectionString}
                onChange={(e) =>
                  handleInputChange("connectionString", e.target.value)
                }
                placeholder={`Example for ${databaseType}:\n${
                  databaseType === "postgresql"
                    ? "postgresql://username:password@localhost:5432/database_name"
                    : databaseType === "mysql"
                    ? "mysql://username:password@localhost:3306/database_name"
                    : "Server=localhost,1433;Database=database_name;User Id=username;Password=password;"
                }`}
                rows={3}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm ${
                  connectionStringError
                    ? "border-red-300 bg-red-50"
                    : "border-gray-300"
                }`}
                required
              />
              {connectionStringError && (
                <p className="mt-1 text-sm text-red-600 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {connectionStringError}
                </p>
              )}
            </div>
          )}

          {/* Standard Connection Method */}
          {connectionMethod === "standard" && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Host *
                </label>
                <input
                  type="text"
                  value={formData.host}
                  onChange={(e) => handleInputChange("host", e.target.value)}
                  placeholder="localhost"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Port *
                </label>
                <input
                  type="number"
                  value={formData.port}
                  onChange={(e) =>
                    handleInputChange("port", parseInt(e.target.value))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Database Name *
                </label>
                <input
                  type="text"
                  value={formData.database}
                  onChange={(e) =>
                    handleInputChange("database", e.target.value)
                  }
                  placeholder="database_name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Username *
                </label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={(e) =>
                    handleInputChange("username", e.target.value)
                  }
                  placeholder="username"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Password *
                </label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) =>
                    handleInputChange("password", e.target.value)
                  }
                  placeholder="password"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div className="col-span-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.ssl}
                    onChange={(e) => handleInputChange("ssl", e.target.checked)}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-700">
                    Use SSL Connection
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Test Connection */}
          <div>
            <button
              onClick={handleTestConnection}
              disabled={isTestingConnection || !isValidForm()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isTestingConnection ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Database className="w-4 h-4" />
              )}
              {isTestingConnection
                ? "Testing Connection..."
                : "Test Connection"}
            </button>

            {/* Connection Status */}
            {connectionStatus === "success" && (
              <div className="flex items-center gap-2 mt-2 text-green-600">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm">Connection successful!</span>
              </div>
            )}

            {connectionStatus === "error" && (
              <div className="flex items-start gap-2 mt-2 text-red-600">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span className="text-sm">{connectionError}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t bg-gray-50">
          {/* Schema Status */}
          <div className="flex items-center gap-2">
            {schemaFetchStatus === "fetching" && (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                <span className="text-sm text-gray-600">
                  Fetching schema...
                </span>
              </>
            )}
            {schemaFetchStatus === "cleaning" && (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-purple-600" />
                <span className="text-sm text-purple-600">
                  AI is cleaning and enriching schema...
                </span>
              </>
            )}
            {schemaFetchStatus === "success" && (
              <>
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm text-green-600">
                  Schema saved successfully!
                </span>
              </>
            )}
            {schemaFetchStatus === "error" && (
              <>
                <AlertCircle className="w-4 h-4 text-orange-600" />
                <span className="text-sm text-orange-600">
                  Schema fetch failed (database still added)
                </span>
              </>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleClose}
              disabled={isSavingDatabase}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={
                connectionStatus !== "success" ||
                isSavingDatabase ||
                !formData.name
              }
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              {isSavingDatabase ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Adding Database...
                </>
              ) : (
                "Add Database"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DatabaseModal;
