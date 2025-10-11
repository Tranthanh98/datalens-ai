/**
 * Connection String Parser Utility
 * Parses database connection strings for PostgreSQL, MySQL, and SQL Server
 */

export interface ParsedConnectionString {
  type: "postgresql" | "mysql" | "mssql";
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  options?: Record<string, string>;
}

export interface ConnectionStringParseResult {
  success: boolean;
  data?: ParsedConnectionString;
  error?: string;
}

/**
 * Parse PostgreSQL connection string
 * Format: postgresql://[username]:[password]@[host]:[port]/[database]?[options]
 * Alternative: postgres://[username]:[password]@[host]:[port]/[database]?[options]
 */
function parsePostgreSQLConnectionString(
  connectionString: string
): ConnectionStringParseResult {
  try {
    // Remove protocol prefix
    const cleanString = connectionString.replace(
      /^(postgresql|postgres):\/\//,
      ""
    );

    // Split by @ to separate credentials from host/database
    const atIndex = cleanString.lastIndexOf("@");
    if (atIndex === -1) {
      return {
        success: false,
        error:
          "Invalid PostgreSQL connection string format: missing @ separator",
      };
    }

    const credentials = cleanString.substring(0, atIndex);
    const hostAndDatabase = cleanString.substring(atIndex + 1);

    // Parse credentials
    const colonIndex = credentials.indexOf(":");
    if (colonIndex === -1) {
      return {
        success: false,
        error: "Invalid PostgreSQL connection string format: missing password",
      };
    }

    const username = decodeURIComponent(credentials.substring(0, colonIndex));
    const password = decodeURIComponent(credentials.substring(colonIndex + 1));

    // Parse host, port, database, and options
    const questionIndex = hostAndDatabase.indexOf("?");
    const hostPortDatabase =
      questionIndex !== -1
        ? hostAndDatabase.substring(0, questionIndex)
        : hostAndDatabase;
    const optionsString =
      questionIndex !== -1 ? hostAndDatabase.substring(questionIndex + 1) : "";

    const slashIndex = hostPortDatabase.indexOf("/");
    if (slashIndex === -1) {
      return {
        success: false,
        error:
          "Invalid PostgreSQL connection string format: missing database name",
      };
    }

    const hostPort = hostPortDatabase.substring(0, slashIndex);
    const database = decodeURIComponent(
      hostPortDatabase.substring(slashIndex + 1)
    );

    // Parse host and port
    const portIndex = hostPort.lastIndexOf(":");
    let host: string;
    let port: number;

    if (portIndex !== -1 && !hostPort.startsWith("[")) {
      // IPv4 or hostname with port
      host = hostPort.substring(0, portIndex);
      port = parseInt(hostPort.substring(portIndex + 1), 10);
    } else if (hostPort.startsWith("[") && hostPort.includes("]:")) {
      // IPv6 with port
      const ipv6End = hostPort.indexOf("]:");
      host = hostPort.substring(1, ipv6End);
      port = parseInt(hostPort.substring(ipv6End + 2), 10);
    } else {
      // No port specified, use default
      host = hostPort.replace(/^\[|\]$/g, ""); // Remove brackets for IPv6
      port = 5432;
    }

    if (isNaN(port)) {
      return {
        success: false,
        error:
          "Invalid PostgreSQL connection string format: invalid port number",
      };
    }

    // Parse options
    const options: Record<string, string> = {};
    let ssl = false;

    if (optionsString) {
      const params = new URLSearchParams(optionsString);
      for (const [key, value] of params.entries()) {
        options[key] = value;
        if (key === "sslmode" && value !== "disable") {
          ssl = true;
        }
      }
    }

    return {
      success: true,
      data: {
        type: "postgresql",
        host,
        port,
        database,
        username,
        password,
        ssl,
        options,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to parse PostgreSQL connection string: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
}

/**
 * Parse MySQL connection string
 * Format: mysql://[username]:[password]@[host]:[port]/[database]?[options]
 */
function parseMySQLConnectionString(
  connectionString: string
): ConnectionStringParseResult {
  try {
    // Remove protocol prefix
    const cleanString = connectionString.replace(/^mysql:\/\//, "");

    // Split by @ to separate credentials from host/database
    const atIndex = cleanString.lastIndexOf("@");
    if (atIndex === -1) {
      return {
        success: false,
        error: "Invalid MySQL connection string format: missing @ separator",
      };
    }

    const credentials = cleanString.substring(0, atIndex);
    const hostAndDatabase = cleanString.substring(atIndex + 1);

    // Parse credentials
    const colonIndex = credentials.indexOf(":");
    if (colonIndex === -1) {
      return {
        success: false,
        error: "Invalid MySQL connection string format: missing password",
      };
    }

    const username = decodeURIComponent(credentials.substring(0, colonIndex));
    const password = decodeURIComponent(credentials.substring(colonIndex + 1));

    // Parse host, port, database, and options
    const questionIndex = hostAndDatabase.indexOf("?");
    const hostPortDatabase =
      questionIndex !== -1
        ? hostAndDatabase.substring(0, questionIndex)
        : hostAndDatabase;
    const optionsString =
      questionIndex !== -1 ? hostAndDatabase.substring(questionIndex + 1) : "";

    const slashIndex = hostPortDatabase.indexOf("/");
    if (slashIndex === -1) {
      return {
        success: false,
        error: "Invalid MySQL connection string format: missing database name",
      };
    }

    const hostPort = hostPortDatabase.substring(0, slashIndex);
    const database = decodeURIComponent(
      hostPortDatabase.substring(slashIndex + 1)
    );

    // Parse host and port
    const portIndex = hostPort.lastIndexOf(":");
    let host: string;
    let port: number;

    if (portIndex !== -1) {
      host = hostPort.substring(0, portIndex);
      port = parseInt(hostPort.substring(portIndex + 1), 10);
    } else {
      host = hostPort;
      port = 3306; // Default MySQL port
    }

    if (isNaN(port)) {
      return {
        success: false,
        error: "Invalid MySQL connection string format: invalid port number",
      };
    }

    // Parse options
    const options: Record<string, string> = {};
    let ssl = false;

    if (optionsString) {
      const params = new URLSearchParams(optionsString);
      for (const [key, value] of params.entries()) {
        options[key] = value;
        if (key === "ssl" && value === "true") {
          ssl = true;
        }
      }
    }

    return {
      success: true,
      data: {
        type: "mysql",
        host,
        port,
        database,
        username,
        password,
        ssl,
        options,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to parse MySQL connection string: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
}

/**
 * Parse SQL Server connection string
 * Format: sqlserver://[username]:[password]@[host]:[port]/[database]?[options]
 * Alternative: mssql://[username]:[password]@[host]:[port]/[database]?[options]
 */
function parseSQLServerConnectionString(
  connectionString: string
): ConnectionStringParseResult {
  try {
    // Remove protocol prefix
    const cleanString = connectionString.replace(/^(sqlserver|mssql):\/\//, "");

    // Split by @ to separate credentials from host/database
    const atIndex = cleanString.lastIndexOf("@");
    if (atIndex === -1) {
      return {
        success: false,
        error:
          "Invalid SQL Server connection string format: missing @ separator",
      };
    }

    const credentials = cleanString.substring(0, atIndex);
    const hostAndDatabase = cleanString.substring(atIndex + 1);

    // Parse credentials
    const colonIndex = credentials.indexOf(":");
    if (colonIndex === -1) {
      return {
        success: false,
        error: "Invalid SQL Server connection string format: missing password",
      };
    }

    const username = decodeURIComponent(credentials.substring(0, colonIndex));
    const password = decodeURIComponent(credentials.substring(colonIndex + 1));

    // Parse host, port, database, and options
    const questionIndex = hostAndDatabase.indexOf("?");
    const hostPortDatabase =
      questionIndex !== -1
        ? hostAndDatabase.substring(0, questionIndex)
        : hostAndDatabase;
    const optionsString =
      questionIndex !== -1 ? hostAndDatabase.substring(questionIndex + 1) : "";

    const slashIndex = hostPortDatabase.indexOf("/");
    if (slashIndex === -1) {
      return {
        success: false,
        error:
          "Invalid SQL Server connection string format: missing database name",
      };
    }

    const hostPort = hostPortDatabase.substring(0, slashIndex);
    const database = decodeURIComponent(
      hostPortDatabase.substring(slashIndex + 1)
    );

    // Parse host and port
    const portIndex = hostPort.lastIndexOf(":");
    let host: string;
    let port: number;

    if (portIndex !== -1) {
      host = hostPort.substring(0, portIndex);
      port = parseInt(hostPort.substring(portIndex + 1), 10);
    } else {
      host = hostPort;
      port = 1433; // Default SQL Server port
    }

    if (isNaN(port)) {
      return {
        success: false,
        error:
          "Invalid SQL Server connection string format: invalid port number",
      };
    }

    // Parse options
    const options: Record<string, string> = {};
    let ssl = false;

    if (optionsString) {
      const params = new URLSearchParams(optionsString);
      for (const [key, value] of params.entries()) {
        options[key] = value;
        if (key === "encrypt" && value === "true") {
          ssl = true;
        }
      }
    }

    return {
      success: true,
      data: {
        type: "mssql",
        host,
        port,
        database,
        username,
        password,
        ssl,
        options,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to parse SQL Server connection string: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
  }
}

/**
 * Detect database type from connection string
 */
function detectDatabaseType(
  connectionString: string
): "postgresql" | "mysql" | "mssql" | null {
  const lowerString = connectionString.toLowerCase();

  if (
    lowerString.startsWith("postgresql://") ||
    lowerString.startsWith("postgres://")
  ) {
    return "postgresql";
  }

  if (lowerString.startsWith("mysql://")) {
    return "mysql";
  }

  if (
    lowerString.startsWith("sqlserver://") ||
    lowerString.startsWith("mssql://")
  ) {
    return "mssql";
  }

  return null;
}

/**
 * Main function to parse connection string
 * Automatically detects database type and uses appropriate parser
 */
export function parseConnectionString(
  connectionString: string
): ConnectionStringParseResult {
  if (!connectionString || typeof connectionString !== "string") {
    return {
      success: false,
      error: "Connection string is required and must be a string",
    };
  }

  const trimmedString = connectionString.trim();
  if (!trimmedString) {
    return { success: false, error: "Connection string cannot be empty" };
  }

  const dbType = detectDatabaseType(trimmedString);
  if (!dbType) {
    return {
      success: false,
      error:
        "Unsupported connection string format. Supported formats: postgresql://, mysql://, sqlserver://, mssql://",
    };
  }

  switch (dbType) {
    case "postgresql":
      return parsePostgreSQLConnectionString(trimmedString);
    case "mysql":
      return parseMySQLConnectionString(trimmedString);
    case "mssql":
      return parseSQLServerConnectionString(trimmedString);
    default:
      return { success: false, error: "Unknown database type" };
  }
}

/**
 * Validate parsed connection data
 */
export function validateParsedConnection(data: ParsedConnectionString): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!data.host || data.host.trim() === "") {
    errors.push("Host is required");
  }

  if (!data.database || data.database.trim() === "") {
    errors.push("Database name is required");
  }

  if (!data.username || data.username.trim() === "") {
    errors.push("Username is required");
  }

  if (!data.password || data.password.trim() === "") {
    errors.push("Password is required");
  }

  if (data.port <= 0 || data.port > 65535) {
    errors.push("Port must be between 1 and 65535");
  }

  if (!["postgresql", "mysql", "mssql"].includes(data.type)) {
    errors.push("Invalid database type");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
