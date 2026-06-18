import React, { createContext, useContext, useState, useEffect } from 'react';

export type User = {
  id: string;
  username: string;
  role: string;
};

type AuthContextType = {
  user: User | null;
  logout: () => void;
  refreshUser: () => Promise<boolean>;
  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, email: string, password: string) => Promise<boolean>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);

  // 刷新当前登录用户信息
  const refreshUser = async (): Promise<boolean> => {
    const token = localStorage.getItem('token');
    if (!token) {
      setUser(null);
      return false;
    }
    const res = await fetch('/api/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.success) {
      setUser(data.data);
      return true;
    } else {
      localStorage.removeItem('token');
      setUser(null);
      return false;
    }
  };

  // 登录方法，给LoginForm调用
  const login = async (username: string, password: string): Promise<boolean> => {
    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) return false;
    localStorage.setItem('token', data.token);
    await refreshUser();
    return true;
  };

  // 注册方法，给LoginForm调用
  const register = async (username: string, email: string, password: string): Promise<boolean> => {
    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password }),
    });
    const data = await res.json();
    return data.success;
  };

  // 退出登录
  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    window.location.href = '/login';
  };

  // 页面初始化自动校验登录
  useEffect(() => {
    refreshUser();
  }, []);

  return (
    <AuthContext.Provider value={{ user, logout, refreshUser, login, register }}>
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth 必须包裹在 AuthProvider 中使用');
  return ctx;
}