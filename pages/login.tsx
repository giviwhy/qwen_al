import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import LoginForm from '../components/LoginForm';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
    const router = useRouter();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!user) return;

        const redirectByRole = async () => {
            setLoading(true);
            if (user.role === 'admin') {
                router.push('/admin');
                return;
            }

            const token = localStorage.getItem('token');
            if (!token) {
                setLoading(false);
                return;
            }
            try {
                const res = await fetch('/api/user-leader-groups', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const data = await res.json();
                if (data.success && data.data.length > 0) {
                    router.push('/group-leader');
                } else {
                    router.push('/dashboard');
                }
            } catch (err) {
                router.push('/dashboard');
            } finally {
                setLoading(false);
            }
        };

        redirectByRole();
    }, [user, router]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-dashboard">
                <div className="flex flex-col items-center gap-4 animate-fade-in">
                    <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-lg text-gray-600 font-medium">正在跳转对应管理页面...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-auth relative overflow-hidden">
            <div className="absolute inset-0 overflow-hidden">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-white/10 rounded-full blur-3xl"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary-500/5 rounded-full blur-3xl"></div>
            </div>
            
            <div className="relative z-10 w-full max-w-md px-4 py-16">
                <div className="text-center mb-8 animate-slide-up">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl mb-4">
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">协作任务看板</h1>
                    <p className="text-white/80">团队协作，高效办公</p>
                </div>
                
                <LoginForm />
            </div>
        </div>
    );
}
