import { Route, Routes } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { Layout } from "./components/Layout";
import { LandingPage } from "./pages/LandingPage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ApiDocsPage } from "./pages/ApiDocsPage";
import { DangerCommandListPage } from "./pages/DangerCommandListPage";
import { SystemConfigPage } from "./pages/SystemConfigPage";
import { OfficialIntroPage } from "./pages/OfficialIntroPage";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminRoute } from "./components/AdminRoute";

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Routes>
          {/* 官网介绍：独立单页，无侧栏与主站菜单 */}
          <Route path="/intro" element={<OfficialIntroPage />} />
          {/* 其余页面使用统一 Layout（侧栏 + header） */}
          <Route path="*" element={
            <Layout>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <DashboardPage />
                    </ProtectedRoute>
                  }
                />
                <Route path="/docs" element={<ApiDocsPage />} />
                <Route
                  path="/admin/danger-commands"
                  element={
                    <AdminRoute>
                      <DangerCommandListPage />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/system-config"
                  element={
                    <AdminRoute>
                      <SystemConfigPage />
                    </AdminRoute>
                  }
                />
              </Routes>
            </Layout>
          } />
        </Routes>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

