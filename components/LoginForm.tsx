import React, { useState, ChangeEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/router';

const LoginForm: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const { login, register } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isRegistering) {
      const success = await register(username, email, password);
      if (success) {
        alert('注册成功！请登录');
        setIsRegistering(false);
        setUsername('');
        setEmail('');
        setPassword('');
      } else {
        alert('注册失败，用户名/邮箱已存在');
      }
    } else {
      const success = await login(username, password);
      if (!success) {
        alert('账号或密码错误');
      }
    }
  };

  return (
    <div className="login-container border border-gray-200 rounded-xl shadow-lg bg-white p-8 w-full">
      <h2 className="text-center text-2xl font-bold text-gray-800 mb-6">
        {isRegistering ? '注册账号' : '系统登录'}
      </h2>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label className="text-sm text-gray-600 font-medium">用户名</label>
          <input
            type="text"
            value={username}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
            required
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
            placeholder="请输入用户名"
            autoComplete="username"
          />
        </div>

        {isRegistering && (
          <div className="flex flex-col gap-2">
            <label className="text-sm text-gray-600 font-medium">邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
              required
              className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
              placeholder="请输入邮箱"
            />
          </div>
        )}

        <div className="flex flex-col gap-2">
          <label className="text-sm text-gray-600 font-medium">密码</label>
          <input
            type="password"
            value={password}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
            required
            className="px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
            placeholder="请输入密码"
            autoComplete="current-password"
          />
        </div>

        <button
          type="submit"
          className="mt-2 py-2.5 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors"
        >
          {isRegistering ? '立即注册' : '登录'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        {isRegistering ? '已有账号？' : '没有账号？'}{' '}
        <button
          type="button"
          className="text-blue-500 hover:text-blue-600 bg-transparent border-none cursor-pointer font-medium"
          onClick={() => setIsRegistering(!isRegistering)}
        >
          {isRegistering ? '去登录' : '去注册'}
        </button>
      </p>
    </div>
  );
};

export default LoginForm;