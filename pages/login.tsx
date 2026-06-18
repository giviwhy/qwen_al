import React from 'react';
import { useRouter } from 'next/router';
import LoginForm from '../components/LoginForm';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
    const router = useRouter();
    const { user } = useAuth();

    // 已登录直接跳看板
    React.useEffect(() => {
        if (user) {
            router.push('/dashboard');
        }
    }, [user, router]);

    return (
        <div style={{ maxWidth: 450, margin: '6rem auto', padding: '0 20px' }}>
            <LoginForm />
        </div>
    );
}