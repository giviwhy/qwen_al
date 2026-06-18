import React, { useState } from 'react';
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
      } else {
        alert('注册失败，请重试');
      }
    } else {
      const success = await login(username, password);
      if (success) {
        router.push('/dashboard');
      } else {
        alert('账号或密码错误');
      }
    }
  };

  return (
    <div className="login-container">
      <h2>{isRegistering ? '注册账号' : '系统登录'}</h2>
      <form onSubmit={handleSubmit}>
        <div>
          <label>用户名：</label>
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>
        {isRegistering && (
          <div>
            <label>邮箱：</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        )}
        <div>
          <label>密码：</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <button type="submit">{isRegistering ? '注册' : '登录'}</button>
      </form>
      <p style={{ marginTop: 12, textAlign: 'center' }}>
        {isRegistering ? '已有账号？' : '没有账号？'}{' '}
        <button
          type="button"
          style={{ background: 'transparent', border: 'none', color: '#0070f3', cursor: 'pointer' }}
          onClick={() => setIsRegistering(!isRegistering)}
        >
          {isRegistering ? '去登录' : '去注册'}
        </button>
      </p>
    </div>
  );
};

// 关键：底部默认导出，匹配 login.tsx 的 import LoginForm from
export default LoginForm;