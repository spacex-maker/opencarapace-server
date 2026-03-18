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
import { SkillsListPage } from "./pages/SkillsListPage";
import { SystemConfigPage } from "./pages/SystemConfigPage";
import { InterceptLogsPage } from "./pages/InterceptLogsPage";
import { MyInterceptLogsPage } from "./pages/MyInterceptLogsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { ApiKeysPage } from "./pages/ApiKeysPage";
import { OfficialIntroPage } from "./pages/OfficialIntroPage";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminRoute } from "./components/AdminRoute";
import { ConfirmProvider } from "./contexts/ConfirmContext";

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ConfirmProvider>
        <Routes>
          {/* 独立单页：无侧栏，整页展示 */}
          <Route path="/intro" element={<OfficialIntroPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          {/* 其余页面使用统一 Layout（侧栏 + header） */}
          <Route path="*" element={
            <Layout>
              <Routes>
                <Route path="/" element={<LandingPage />} />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute>
                      <DashboardPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/settings"
                  element={
                    <ProtectedRoute>
                      <SettingsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/api-keys"
                  element={
                    <ProtectedRoute>
                      <ApiKeysPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/my/intercept-logs"
                  element={
                    <ProtectedRoute>
                      <MyInterceptLogsPage />
                    </ProtectedRoute>
                  }
                />
                <Route path="/docs" element={<ApiDocsPage />} />
                <Route
                  path="/skills"
                  element={
                    <ProtectedRoute>
                      <SkillsListPage mode="user" />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/danger-commands"
                  element={
                    <ProtectedRoute>
                      <DangerCommandListPage mode="user" />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/danger-commands"
                  element={
                    <AdminRoute>
                      <DangerCommandListPage mode="admin" />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/skills"
                  element={
                    <AdminRoute>
                      <SkillsListPage mode="admin" />
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
                <Route
                  path="/admin/intercept-logs"
                  element={
                    <AdminRoute>
                      <InterceptLogsPage />
                    </AdminRoute>
                  }
                />
              </Routes>
            </Layout>
          } />
        </Routes>
        </ConfirmProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;

