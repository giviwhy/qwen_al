import React from 'react';
import { useRouter } from 'next/router';
import LoginForm from '../components/LoginForm';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
    const router = useRouter();
    const { user } = useAuth();

    React.useEffect(() => {
        if (user) {
            router.push('/dashboard');
        }
    }, [user, router]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-16">
            <div className="w-full max-w-md">
                <LoginForm />
            </div>
        </div>
    );
}