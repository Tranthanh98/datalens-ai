import {
  Navigate,
  Route,
  BrowserRouter as Router,
  Routes,
} from "react-router-dom";
import Header from "./components/Header";
import ManageDatabase from "./pages/ManageDatabase";
import ChatPageV2 from "./pages/v2/ChatPageV2";
import DashboardPageV2 from "./pages/v2/DashboardPageV2";

/**
 * Main App component for DataLens AI
 * Manages the overall layout and routing
 */
function App() {
  return (
    <Router>
      <Routes>
        {/* Default route - redirect to dashboard */}
        <Route path="/" element={<Navigate to="/v2/dashboard" replace />} />

        {/* V2 Chat - Full screen without header */}
        <Route path="/v2/chat" element={<ChatPageV2 />} />

        {/* V2 Dashboard - Full screen without header */}
        <Route path="/v2/dashboard" element={<DashboardPageV2 />} />

        {/* Legacy routes with header */}
        <Route
          path="/*"
          element={
            <div className="h-screen flex flex-col bg-gray-50">
              {/* Header */}
              <Header />

              {/* Main Content with Routes */}
              <Routes>
                <Route path="/manage-database" element={<ManageDatabase />} />
              </Routes>
            </div>
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
