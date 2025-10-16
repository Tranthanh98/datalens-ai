import { ChevronDown, Database, Plus, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { LegacyDatabase } from "../db/adapters";
import { useDatabaseStore } from "../store";
import DatabaseModal from "./DatabaseModal";

/**
 * Header component containing the DataLens AI logo, database dropdown, and add database button
 * Now uses Zustand store for internal state management instead of props
 */
const Header: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  // Zustand store hooks
  const { databases, selectedDatabase, initializeDatabases, selectDatabase } =
    useDatabaseStore();

  /**
   * Initialize databases on component mount
   */
  useEffect(() => {
    initializeDatabases();
  }, [initializeDatabases]);

  /**
   * Handle opening the database modal
   */
  const handleOpenModal = () => {
    setIsModalOpen(true);
  };

  /**
   * Handle closing the database modal
   */
  const handleCloseModal = () => {
    setIsModalOpen(false);
  };

  /**
   * Handle database selection from dropdown
   */
  const handleDatabaseSelect = async (database: LegacyDatabase) => {
    try {
      await selectDatabase(database);
      setIsDropdownOpen(false);
    } catch (error) {
      console.error("Failed to select database:", error);
    }
  };

  /**
   * Handle adding a new database from the modal
   * Now includes schema fetching and saving to schemaInfo table
   */
  // const handleAddDatabase = async (
  //   database: LegacyDatabase
  // ): Promise<number> => {
  //   const dbId = await addDatabase(database);
  //   return dbId;
  // };

  /**
   * Handle opening the reset confirmation modal
   */
  const handleOpenResetModal = () => {
    setIsResetModalOpen(true);
  };

  /**
   * Handle closing the reset confirmation modal
   */
  const handleCloseResetModal = () => {
    setIsResetModalOpen(false);
  };

  /**
   * Handle confirming the reset action - clears all IndexedDB data
   */
  const handleConfirmReset = async () => {
    try {
      // Clear all IndexedDB data
      const databases = await window.indexedDB.databases();
      await Promise.all(
        databases.map((db) => {
          if (db.name) {
            return new Promise<void>((resolve, reject) => {
              const deleteReq = window.indexedDB.deleteDatabase(db.name!);
              deleteReq.onsuccess = () => resolve();
              deleteReq.onerror = () => reject(deleteReq.error);
            });
          }
        })
      );

      // Reload the page to reset application state
      window.location.reload();
    } catch (error) {
      console.error("Failed to reset data:", error);
    }
    setIsResetModalOpen(false);
  };

  return (
    <header className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
      {/* Logo and Database Dropdown */}
      <div className="flex items-center gap-4">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-gray-800 rounded-full flex items-center justify-center">
            <div className="w-4 h-4 bg-white rounded-full"></div>
          </div>
          <h1 className="text-xl font-semibold text-gray-800">DataLens AI</h1>
        </div>

        {/* Database Dropdown */}
        <div className="relative">
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <span className="text-sm text-gray-700">
              {selectedDatabase ? selectedDatabase.name : "Select Database"}
            </span>
            <ChevronDown className="w-4 h-4 text-gray-500" />
          </button>

          {/* Dropdown Menu */}
          {isDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
              {databases.length > 0 ? (
                databases.map((database) => (
                  <button
                    key={database.id}
                    onClick={() => {
                      handleDatabaseSelect(database);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg"
                  >
                    {database.name}
                  </button>
                ))
              ) : (
                <div className="px-3 py-2 text-sm text-gray-500">
                  No databases available
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-2">
        {/* Manage Database Button */}
        {location.pathname !== "/manage-database" && (
          <button
            onClick={() => navigate("/manage-database")}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <Database className="w-4 h-4" />
            <span className="text-sm font-medium">Manage Databases</span>
          </button>
        )}

        {/* Reset Button */}
        <button
          onClick={handleOpenResetModal}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
          <span className="text-sm font-medium">Reset</span>
        </button>

        {/* Add Database Button */}
        <button
          onClick={handleOpenModal}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          <span className="text-sm font-medium">Add new Database</span>
        </button>
      </div>

      {/* Database Modal */}
      <DatabaseModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        // onAddDatabase={handleAddDatabase}
      />

      {/* Reset Confirmation Modal */}
      {isResetModalOpen && (
        <div
          className="fixed inset-0  bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 animate-in fade-in duration-200"
          onClick={handleCloseResetModal}
        >
          <div
            className="bg-white rounded-lg p-6 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              Confirm Reset
            </h2>
            <p className="text-gray-600 mb-6">
              Are you sure you want to reset all data? This will permanently
              delete all conversations, messages, and database connections. This
              action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={handleCloseResetModal}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReset}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Reset All Data
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
