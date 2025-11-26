import { Route, BrowserRouter as Router, Routes } from "react-router-dom";
import Header from "./components/Header";
import HomePage from "./pages/HomePage";
import ManageDatabase from "./pages/ManageDatabase";
import ChatPageV2 from "./pages/v2/ChatPageV2";

/**
 * Main App component for DataLens AI
 * Manages the overall layout and routing
 */
function App() {
  return (
    <Router>
      <Routes>
        {/* V2 Chat - Full screen without header */}
        <Route path="/v2/chat" element={<ChatPageV2 />} />

        {/* Legacy routes with header */}
        <Route
          path="/*"
          element={
            <div className="h-screen flex flex-col bg-gray-50">
              {/* Header */}
              <Header />

              {/* Main Content with Routes */}
              <Routes>
                <Route path="/" element={<HomePage />} />
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
