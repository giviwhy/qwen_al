import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { User, AuthContextType } from '../types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);

    // 页面刷新自动读取token，恢复登录态（新增持久化逻辑）
    useEffect(() => {
        const initUser = async () => {
            const token = localStorage.getItem('token');
            if (!token) return;
            try {
                const res = await fetch('/api/me', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.ok) {
                    const userData = await res.json();
                    setUser(userData);
                } else {
                    localStorage.removeItem('token');
                }
            } catch (err) {
                localStorage.removeItem('token');
            }
        };
        initUser();
    }, []);

    const login = async (username: string, password: string): Promise<boolean> => {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        const data = await response.json();
        if (response.ok) {
            localStorage.setItem('token', data.token);
            setUser(data.user);
            return true;
        }
        return false;
    }; // 删掉多余 };

    const register = async (username: string, email: string, password: string): Promise<boolean> => {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password }),
        });
        const data = await response.json();
        return data.success;
    }; // 删掉多余 };

    const logout = () => {
        localStorage.removeItem('token');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, register }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}