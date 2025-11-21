import { ArrowLeft, Database, Edit, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SchemaService } from "../db";
import { cleanAndEnrichSchema } from "../services/aiService2";
import DatabaseApiService, {
  type DatabaseInfo,
} from "../services/databaseApiService";
import DatabaseSchemaService, {
  type DatabaseConnection,
} from "../services/databaseService";

interface DatabaseFormData {
  name: string;
  type: "postgresql" | "mysql" | "mssql";
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

const ManageDatabase = () => {
  const navigate = useNavigate();
  const [databases, setDatabases] = useState<DatabaseInfo[]>([]);

  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [formData, setFormData] = useState<DatabaseFormData>({
    name: "",
    type: "postgresql",
    host: "localhost",
    port: 5432,
    database: "",
    username: "",
    password: "",
  });

  // Load databases from API
  const loadDatabases = async () => {
    try {
      const dbList = await DatabaseApiService.getAllDatabases();
      setDatabases(dbList);
    } catch (error) {
      console.error("Failed to load databases:", error);
      setMessage({
        type: "error",
        text: "Không thể tải danh sách database",
      });
    }
  };

  useEffect(() => {
    loadDatabases();
  }, []);

  const resetForm = () => {
    setFormData({
      name: "",
      type: "postgresql",
      host: "localhost",
      port: 5432,
      database: "",
      username: "",
      password: "",
    });
    setIsEditing(false);
    setEditingId(null);
  };

  const handleEdit = (db: DatabaseInfo) => {
    setFormData({
      name: db.name,
      type: db.type || "postgresql",
      host: db.host || "localhost",
      port: db.port || 5432,
      database: db.database || "",
      username: db.username || "",
      password: db.password || "",
    });
    setEditingId(db.id.toString());
    setIsEditing(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage(null);

    try {
      // Test connection first
      const connectionTest: DatabaseConnection = {
        type: formData.type,
        host: formData.host,
        port: formData.port,
        database: formData.database,
        username: formData.username,
        password: formData.password,
      };

      const testResult = await DatabaseSchemaService.testConnection(
        connectionTest
      );

      if (!testResult.success) {
        setMessage({
          type: "error",
          text: `Không thể kết nối: ${testResult.error}`,
        });
        setIsLoading(false);
        return;
      }

      if (isEditing && editingId) {
        // Update database
        await DatabaseApiService.updateDatabase(parseInt(editingId), {
          name: formData.name,
          type: formData.type,
          host: formData.host,
          port: formData.port,
          database: formData.database,
          username: formData.username,
          password: formData.password,
        });
        setMessage({ type: "success", text: "Cập nhật database thành công!" });
      }

      resetForm();
      await loadDatabases();
    } catch (error) {
      setMessage({
        type: "error",
        text: `Lỗi: ${
          error instanceof Error ? error.message : "Không xác định"
        }`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (
      !confirm(
        `Bạn có chắc chắn muốn xóa database "${name}"?\n\nToàn bộ dữ liệu liên quan sẽ bị xóa vĩnh viễn.`
      )
    ) {
      return;
    }

    setIsLoading(true);
    setMessage(null);

    try {
      await DatabaseApiService.deleteDatabase(parseInt(id));
      setMessage({ type: "success", text: "Xóa database thành công!" });
      await loadDatabases();
    } catch (error) {
      setMessage({
        type: "error",
        text: `Lỗi khi xóa: ${
          error instanceof Error ? error.message : "Không xác định"
        }`,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefetchSchema = async (
    id: string,
    name: string,
    dbType: string
  ) => {
    if (!confirm(`Bạn có muốn tải lại schema cho database "${name}"?`)) {
      return;
    }

    setLoadingId(id);
    setMessage(null);

    try {
      // Fetch schema from API
      const result = await DatabaseSchemaService.fetchSchema(id);

      if (!result.success || !result.schema) {
        setMessage({
          type: "error",
          text: `Không thể tải schema: ${result.error || "Unknown error"}`,
        });
        return;
      }

      // Clear existing schema data
      await SchemaService.clearForDatabase(parseInt(id));

      // Group schema by table_schema to reduce AI token usage
      interface RawTableSchema {
        table_schema?: string;
        [key: string]: unknown;
      }

      const schemaGroups = new Map<string, RawTableSchema[]>();

      result.schema.forEach((table: RawTableSchema) => {
        const tableSchema = table.table_schema || "default";
        if (!schemaGroups.has(tableSchema)) {
          schemaGroups.set(tableSchema, []);
        }
        schemaGroups.get(tableSchema)!.push(table);
      });

      console.log(
        `Grouped schema into ${schemaGroups.size} schema groups:`,
        Array.from(schemaGroups.keys()).map(
          (key) => `${key} (${schemaGroups.get(key)?.length} tables)`
        )
      );

      // Clean and save each schema group separately
      interface CleanedTable {
        tableName: string;
        tableDescription: string;
        isRelevant: boolean;
        category: string;
        columns: unknown[];
        [key: string]: unknown;
      }

      const allCleanedTables: CleanedTable[] = [];
      const CHUNK_SIZE = 15; // Save 15 tables at a time

      for (const [schemaName, tables] of schemaGroups) {
        console.log(
          `Processing schema group: ${schemaName} with ${tables.length} tables`
        );

        try {
          // Clean schema for this group
          const cleanResult = await cleanAndEnrichSchema(tables, dbType);

          if (cleanResult.success && cleanResult.cleanedSchema) {
            const cleanedTables = cleanResult.cleanedSchema;
            console.log(
              `Cleaned ${cleanedTables.length} tables from schema: ${schemaName}`
            );

            // Add to total for final summary
            allCleanedTables.push(...cleanedTables);

            // Immediately save cleaned tables to database in chunks
            if (cleanedTables.length > 0) {
              const chunks: CleanedTable[][] = [];
              for (let i = 0; i < cleanedTables.length; i += CHUNK_SIZE) {
                chunks.push(cleanedTables.slice(i, i + CHUNK_SIZE));
              }

              console.log(
                `Saving ${cleanedTables.length} tables from schema ${schemaName} in ${chunks.length} chunks`
              );

              // Save each chunk sequentially
              for (let i = 0; i < chunks.length; i++) {
                console.log(
                  `Saving chunk ${i + 1}/${chunks.length} with ${
                    chunks[i].length
                  } tables from schema: ${schemaName}`
                );

                await DatabaseSchemaService.saveSchemaToDatabase(
                  parseInt(id),
                  chunks[i]
                );
              }
            }
          } else {
            console.warn(
              `Failed to clean schema group ${schemaName}:`,
              cleanResult.error
            );
          }
        } catch (error) {
          console.error(`Error cleaning schema group ${schemaName}:`, error);
          // Continue with other groups
        }
      }

      // Save the complete cleaned schema as a single JSON object for local storage
      await SchemaService.save({
        databaseId: parseInt(id),
        schema: allCleanedTables, // Store the entire cleaned schema array as JSON
      });

      if (allCleanedTables.length === 0) {
        setMessage({
          type: "error",
          text: "Schema rỗng sau khi clean, không có gì để lưu",
        });
        return;
      }

      setMessage({
        type: "success",
        text: `Tải lại schema thành công! (${allCleanedTables.length} tables từ ${schemaGroups.size} schema groups)`,
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: `Lỗi khi tải schema: ${
          error instanceof Error ? error.message : "Không xác định"
        }`,
      });
    } finally {
      setLoadingId(null);
    }
  };

  const handleTypeChange = (type: "postgresql" | "mysql" | "mssql") => {
    const defaultPorts = {
      postgresql: 5432,
      mysql: 3306,
      mssql: 1433,
    };
    setFormData({ ...formData, type, port: defaultPorts[type] });
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quay lại</span>
          </button>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Database className="w-8 h-8 text-blue-600" />
            Quản lý Database
          </h1>
          <p className="text-gray-600 mt-2">
            Quản lý các kết nối database: thêm mới, chỉnh sửa, xóa và tải lại
            schema
          </p>
        </div>

        {/* Message */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              message.type === "success"
                ? "bg-green-50 text-green-800 border border-green-200"
                : "bg-red-50 text-red-800 border border-red-200"
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Edit Form */}
        {isEditing && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-8 border border-gray-200">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <Edit className="w-5 h-5 text-blue-600" />
                Chỉnh sửa Database
              </h2>
              <button
                onClick={resetForm}
                className="text-gray-500 hover:text-gray-700 transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tên Database *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    placeholder="My Database"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Loại Database *
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) =>
                      handleTypeChange(
                        e.target.value as "postgresql" | "mysql" | "mssql"
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="postgresql">PostgreSQL</option>
                    <option value="mysql">MySQL</option>
                    <option value="mssql">SQL Server</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Host *
                  </label>
                  <input
                    type="text"
                    value={formData.host}
                    onChange={(e) =>
                      setFormData({ ...formData, host: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    placeholder="localhost"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Port *
                  </label>
                  <input
                    type="number"
                    value={formData.port}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        port: parseInt(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Database Name *
                  </label>
                  <input
                    type="text"
                    value={formData.database}
                    onChange={(e) =>
                      setFormData({ ...formData, database: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    placeholder="mydb"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Username *
                  </label>
                  <input
                    type="text"
                    value={formData.username}
                    onChange={(e) =>
                      setFormData({ ...formData, username: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    placeholder="postgres"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password *
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors font-medium"
                >
                  {isLoading ? "Đang xử lý..." : "Cập nhật"}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                >
                  Hủy
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Database List */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden border border-gray-200">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">
              Danh sách Database ({databases.length})
            </h2>
          </div>

          {databases.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <Database className="w-16 h-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg">Chưa có database nào</p>
              <p className="text-sm mt-2">
                Thêm database mới từ trang chủ để bắt đầu
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tên
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Loại
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Host
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Database
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Username
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Thao tác
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {databases.map((db: DatabaseInfo) => (
                    <tr
                      key={db.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Database className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-gray-900">
                            {db.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded">
                          {db.type?.toUpperCase() || "UNKNOWN"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {db.host}:{db.port}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                        {db.database}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {db.username}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() =>
                              handleRefetchSchema(
                                db.id.toString(),
                                db.name,
                                db.type || "postgresql"
                              )
                            }
                            disabled={loadingId === db.id.toString()}
                            className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Tải lại schema"
                          >
                            <RefreshCw
                              className={`w-4 h-4 ${
                                loadingId === db.id.toString()
                                  ? "animate-spin"
                                  : ""
                              }`}
                            />
                          </button>
                          <button
                            onClick={() => handleEdit(db)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Chỉnh sửa"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() =>
                              handleDelete(db.id.toString(), db.name)
                            }
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Xóa"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ManageDatabase;
