import { Check, ChevronDown, Database, Settings } from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";
import { useChatStore, useDatabaseStore } from "../../store";

/**
 * DatabaseSelector - Dropdown component to switch between databases
 * Shows in the header, allows users to quickly change selected database
 */
const DatabaseSelector: React.FC = memo(() => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { databases, selectedDatabase, selectDatabase } = useDatabaseStore();
  const { setSelectedConversationId } = useChatStore();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /**
   * Handle database selection
   */
  const handleSelectDatabase = async (db: typeof selectedDatabase) => {
    if (!db || db.id === selectedDatabase?.id) {
      setIsOpen(false);
      return;
    }

    try {
      const result = await selectDatabase(db);
      // Set the active conversation for the new database
      if (result.activeConversationId) {
        setSelectedConversationId(result.activeConversationId);
      } else {
        setSelectedConversationId(null);
      }
      setIsOpen(false);
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (error) {
      console.error("Failed to switch database:", error);
    }
  };

  /**
   * Get database type icon color
   */
  const getDbTypeColor = (type?: string) => {
    switch (type) {
      case "postgresql":
        return "text-blue-500";
      case "mysql":
        return "text-orange-500";
      case "mssql":
        return "text-red-500";
      case "sqlite":
        return "text-green-500";
      default:
        return "text-gray-500";
    }
  };

  /**
   * Get database type short label
   */
  const getDbTypeLabel = (type?: string) => {
    switch (type) {
      case "postgresql":
        return "PG";
      case "mysql":
        return "MySQL";
      case "mssql":
        return "MSSQL";
      case "sqlite":
        return "SQLite";
      default:
        return "DB";
    }
  };

  if (databases.length === 0) {
    return (
      <a
        href="/manage-database"
        className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <Database className="w-4 h-4" />
        <span>Add Database</span>
      </a>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors min-w-[180px]"
      >
        <Database
          className={`w-4 h-4 ${getDbTypeColor(selectedDatabase?.type)}`}
        />
        <span className="flex-1 text-left truncate text-gray-700">
          {selectedDatabase?.name || "Select Database"}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-gray-500 transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 bg-white border border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
          {/* Header */}
          <div className="px-3 py-2 border-b border-gray-100 bg-gray-50">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
              Select Database
            </p>
          </div>

          {/* Database List */}
          <div className="max-h-64 overflow-y-auto py-1">
            {databases.map((db) => (
              <button
                key={db.id}
                onClick={() => handleSelectDatabase(db)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 transition-colors ${
                  selectedDatabase?.id === db.id ? "bg-blue-50" : ""
                }`}
              >
                {/* Database Icon */}
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-medium ${
                    selectedDatabase?.id === db.id
                      ? "bg-blue-100 text-blue-600"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {getDbTypeLabel(db.type)}
                </div>

                {/* Database Info */}
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium truncate ${
                      selectedDatabase?.id === db.id
                        ? "text-blue-700"
                        : "text-gray-700"
                    }`}
                  >
                    {db.name}
                  </p>
                  <p className="text-xs text-gray-400 truncate">
                    {db.host}:{db.port}/{db.database}
                  </p>
                </div>

                {/* Selected Check */}
                {selectedDatabase?.id === db.id && (
                  <Check className="w-4 h-4 text-blue-600 flex-shrink-0" />
                )}
              </button>
            ))}
          </div>

          {/* Footer - Manage Link */}
          <div className="border-t border-gray-100">
            <a
              href="/manage-database"
              className="flex items-center gap-2 px-3 py-2.5 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Settings className="w-4 h-4" />
              <span>Manage Databases</span>
            </a>
          </div>
        </div>
      )}
    </div>
  );
});

DatabaseSelector.displayName = "DatabaseSelector";

export default DatabaseSelector;
