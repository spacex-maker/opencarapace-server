import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { Layout } from "./components/Layout";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { DashboardPage } from "./pages/DashboardPage";
import { ApiDocsPage } from "./pages/ApiDocsPage";
import { UserDangerCommandsPage } from "./pages/UserDangerCommandsPage";
import { AdminDangerCommandsPage } from "./pages/AdminDangerCommandsPage";
import { UserSkillsPage } from "./pages/UserSkillsPage";
import { AdminSkillsPage } from "./pages/AdminSkillsPage";
import { SystemConfigPage } from "./pages/SystemConfigPage";
import { MyInterceptLogsPage } from "./pages/MyInterceptLogsPage";
import { AdminInterceptLogsPage } from "./pages/AdminInterceptLogsPage";
import { AdminTrackingEventsPage } from "./pages/AdminTrackingEventsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { ApiKeysPage } from "./pages/ApiKeysPage";
import { OfficialIntroPage } from "./pages/OfficialIntroPage";
import { TokenUsagesPage } from "./pages/TokenUsagesPage";
import { DownloadPage } from "./pages/DownloadPage";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminRoute } from "./components/AdminRoute";
import { ConfirmProvider } from "./contexts/ConfirmContext";
import { trackEvent } from "./tracking/clientTracking";

function App() {
  const location = useLocation();

  useEffect(() => {
    trackEvent("page_view", {
      pageId: location.pathname,
      module: "web",
      eventProps: {
        search: location.search || "",
      },
    });
  }, [location.pathname, location.search]);

  return (
    <ThemeProvider>
      <AuthProvider>
        <ConfirmProvider>
        <Routes>
          {/* 根路径：官网（无侧栏）；旧 /intro 重定向到 / */}
          <Route path="/" element={<OfficialIntroPage />} />
          <Route path="/intro" element={<Navigate to="/" replace />} />
          <Route path="/download" element={<DownloadPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          {/* 后台：侧栏 + 顶栏；需从官网或侧栏进入 /dashboard 等 */}
          <Route path="*" element={
            <Layout>
              <Routes>
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
                <Route
                  path="/my/token-usages"
                  element={
                    <ProtectedRoute>
                      <TokenUsagesPage />
                    </ProtectedRoute>
                  }
                />
                <Route path="/docs" element={<ApiDocsPage />} />
                <Route
                  path="/skills"
                  element={
                    <ProtectedRoute>
                      <UserSkillsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/danger-commands"
                  element={
                    <ProtectedRoute>
                      <UserDangerCommandsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin/danger-commands"
                  element={
                    <AdminRoute>
                      <AdminDangerCommandsPage />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/skills"
                  element={
                    <AdminRoute>
                      <AdminSkillsPage />
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
                      <AdminInterceptLogsPage />
                    </AdminRoute>
                  }
                />
                <Route
                  path="/admin/tracking-events"
                  element={
                    <AdminRoute>
                      <AdminTrackingEventsPage />
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

