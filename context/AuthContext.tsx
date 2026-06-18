import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { User, AuthContextType } from '../types';
import { useRouter } from 'next/router';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const router = useRouter();

    // 页面刷新恢复登录态
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
                console.error('初始化用户失败：', err);
                localStorage.removeItem('token');
            }
        };
        initUser();
    }, []);

    // 判断当前用户是否是小组组长
    const checkIsGroupLeader = async (token: string): Promise<boolean> => {
        const res = await fetch('/api/user-leader-groups', {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        return data.success && Array.isArray(data.data) && data.data.length > 0;
    };

    const login = async (username: string, password: string): Promise<boolean> => {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password }),
        });
        const data = await response.json();

        if (response.ok && data.success) {
            const token = data.data.token;
            const loginUser = data.data.user;
            localStorage.setItem('token', token);
            setUser(loginUser);

            // 1. 全局超级管理员直接进后台
            if (loginUser.role === 'admin') {
                router.push('/admin');
                return true;
            }

            // 2. 普通用户：判断是否拥有组长身份
            const isLeader = await checkIsGroupLeader(token);
            if (isLeader) {
                router.push('/group-leader');
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