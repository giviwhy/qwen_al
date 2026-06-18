import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { User, AuthContextType } from '../types';
import { useRouter } from 'next/router';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const router = useRouter();

    // 页面刷新拉取登录态
    useEffect(() => {
        const initUser = async () => {
            const token = localStorage.getItem('token');
            if (!token) return;
            try {
                const res = await fetch('/api/me', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const result = await res.json();
                if (res.ok && result.success) {
                    setUser(result.data);
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

        if (response.ok && data.success) {
            localStorage.setItem('token', data.data.token);
            setUser(data.data.user);
            // 登录成功按角色自动跳转
            if (data.data.user.role === 'admin') {
                router.push('/admin');
            } else {
                router.push('/dashboard');
            }
            return true;
        }
        return false;
    };

    const register = async (username: string, email: string, password: string): Promise<boolean> => {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password }),
        });
        const data = await response.json();
        return data.success;
    };

    const logout = () => {
        localStorage.removeItem('token');
        setUser(null);
        router.push('/login');
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