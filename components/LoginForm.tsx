import React, { useState, ChangeEvent } from 'react';
import { useAuth } from '../context/AuthContext';

const LoginForm: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

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
    setLoading(false);
  };

  return (
    <div className="bg-white/95 backdrop-blur-lg rounded-2xl shadow-2xl p-8 w-full animate-scale-in">
      <h2 className="text-center text-2xl font-bold text-gray-800 mb-6">
        {isRegistering ? '注册账号' : '系统登录'}
      </h2>
      
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">用户名</label>
          <input
            type="text"
            value={username}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
            required
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 text-gray-800 placeholder-gray-400"
            placeholder="请输入用户名"
            autoComplete="username"
          />
        </div>

        {isRegistering && (
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">邮箱</label>
            <input
              type="email"
              value={email}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 text-gray-800 placeholder-gray-400"
              placeholder="请输入邮箱"
            />
          </div>
        )}

        <div className="space-y-2">
          <label className="block text-sm font-semibold text-gray-700">密码</label>
          <input
            type="password"
            value={password}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all duration-200 text-gray-800 placeholder-gray-400"
            placeholder="请输入密码"
            autoComplete="current-password"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="mt-2 py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl font-semibold hover:from-primary-600 hover:to-primary-700 transition-all duration-200 shadow-lg hover:shadow-xl hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              加载中...
            </span>
          ) : (
            isRegistering ? '立即注册' : '登录'
          )}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        {isRegistering ? '已有账号？' : '没有账号？'}{' '}
        <button
          type="button"
          className="text-primary-600 hover:text-primary-700 bg-transparent border-none cursor-pointer font-semibold transition-colors duration-200"
          onClick={() => setIsRegistering(!isRegistering)}
        >
          {isRegistering ? '去登录' : '去注册'}
        </button>
      </p>
    </div>
  );
};

export default LoginForm;
