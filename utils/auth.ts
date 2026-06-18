// utils/auth.ts
import { NextApiRequest } from 'next';
import jwt from 'jsonwebtoken';

// 从请求头提取token
export function getTokenFromHeader(req: NextApiRequest): string | null {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    return authHeader.split(' ')[1];
}

// 异步校验token并解析payload
export async function verifyToken(token: string) {
    try {
        return jwt.verify(token, process.env.JWT_SECRET!) as {
            id: string;
            username: string;
            role: 'admin' | 'user';
        };
    } catch {
        return null;
    }
}