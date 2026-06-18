import React, { createContext, useContext, useState, ReactNode } from 'react';
import { User, AuthContextType } from '../types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);

    const login = async (username: string, password: string): Promise<boolean> => {
        try {
            const response = await fetch('/api?endpoint=auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            if (response.ok) {
                const data = await response.json();
                localStorage.setItem('token', data.token);
                setUser(data.user);
                return true;
            } else {
                return false;
            }
        } catch (error) {
            console.error('Login error:', error);
            return false;
        }
    };

    const register = async (username: string, email: string, password: string): Promise<boolean> => {
        try {
            const response = await fetch('/api?endpoint=auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, email, password }),
            });

            return response.ok;
        } catch (error) {
            console.error('Registration error:', error);
            return false;
        }
    };

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