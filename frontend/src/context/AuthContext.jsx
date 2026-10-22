import { createContext, useState, useEffect, useCallback } from 'react';
import { tokenStorage } from '../utils/tokenStorage';
import { authService } from '../services/authService';
import { onSessionExpired } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => tokenStorage.getUser());
  const [token, setToken] = useState(() => tokenStorage.getAccessToken());
  const [refreshToken, setRefreshToken] = useState(() => tokenStorage.getRefreshToken());
  const [isLoading, setIsLoading] = useState(true);
  const [sessionMessage, setSessionMessage] = useState(null);

  // Clear all credentials and reset state
  const clearLocalAuth = useCallback(() => {
    tokenStorage.clearSession();
    setUser(null);
    setToken(null);
    setRefreshToken(null);
  }, []);

  // Login action: persists tokens and user identity
  const loginUser = useCallback((loginData) => {
    const { token: newAccessToken, refreshToken: newRefreshToken, user: userData } = loginData;

    tokenStorage.saveSession({
      token: newAccessToken,
      refreshToken: newRefreshToken,
      user: userData,
    });

    setToken(newAccessToken || null);
    setRefreshToken(newRefreshToken || null);
    setUser(userData || null);
    setSessionMessage(null);
  }, []);

  // Logout action: notifies backend (if online) and clears local storage
  const logoutUser = useCallback(async () => {
    const currentToken = token || tokenStorage.getAccessToken();
    try {
      if (currentToken) {
        await authService.logout(currentToken);
      }
    } catch (err) {
      // Non-fatal on network error / server offline; client must still clear auth
      console.warn('[AuthContext] Backend logout notification failed or offline:', err.message);
    } finally {
      clearLocalAuth();
    }
  }, [token, clearLocalAuth]);

  // Session restoration on mount
  useEffect(() => {
    let isMounted = true;

    async function restoreSession() {
      const storedToken = tokenStorage.getAccessToken();
      const storedRefreshToken = tokenStorage.getRefreshToken();
      const storedUser = tokenStorage.getUser();

      if (!storedToken && !storedRefreshToken) {
        if (isMounted) setIsLoading(false);
        return;
      }

      // Check with backend /api/auth/me to verify token validity and get latest role
      try {
        const profile = await authService.getMe(storedToken);
        if (isMounted && profile) {
          const freshUser = {
            userId: profile.userId,
            name: profile.name,
            email: profile.email,
            phone: profile.phone,
            role: profile.role,
            status: profile.status,
          };
          tokenStorage.saveSession({
            token: tokenStorage.getAccessToken(),
            refreshToken: tokenStorage.getRefreshToken(),
            user: freshUser,
          });
          setUser(freshUser);
          setToken(tokenStorage.getAccessToken());
          setRefreshToken(tokenStorage.getRefreshToken());
        }
      } catch (err) {
        if (!isMounted) return;

        // If backend explicitly rejected the token (401 invalid/expired)
        if (err.status === 401) {
          clearLocalAuth();
          setSessionMessage('Your session has expired. Please sign in again.');
        } else if (err.status === 0 || err.status === 502) {
          // Backend is offline or unreachable: keep stored credentials for inspection,
          // but do not claim live verified session.
          if (storedUser) {
            setUser(storedUser);
            setToken(storedToken);
            setRefreshToken(storedRefreshToken);
          }
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    restoreSession();

    // Listen for automatic session expiry triggered by api interceptor
    onSessionExpired((msg) => {
      if (isMounted) {
        clearLocalAuth();
        setSessionMessage(msg || 'Your session has expired. Please sign in again.');
      }
    });

    return () => {
      isMounted = false;
    };
  }, [clearLocalAuth]);

  const value = {
    user,
    token,
    refreshToken,
    isAuthenticated: Boolean(user && token),
    isLoading,
    sessionMessage,
    setSessionMessage,
    loginUser,
    logoutUser,
    clearLocalAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export { AuthContext };
