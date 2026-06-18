import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import LoginForm from '../components/LoginForm';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
    const router = useRouter();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // 未登录直接返回，不执行跳转逻辑
        if (!user) return;

        const redirectByRole = async () => {
            setLoading(true);
            // 超级管理员直接进入后台
            if (user.role === 'admin') {
                router.push('/admin');
                return;
            }

            // 普通用户，判断是否为小组组长
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
                // 接口异常兜底跳工作台
                router.push('/dashboard');
            } finally {
                setLoading(false);
            }
        };

        redirectByRole();
    }, [user, router]);

    // 跳转加载中展示提示
    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <p className="text-lg text-gray-600">正在跳转对应管理页面...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-16">
            <div className="w-full max-w-md">
                <LoginForm />
            </div>
        </div>
    );
}