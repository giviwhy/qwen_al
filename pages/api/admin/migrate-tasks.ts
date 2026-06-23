import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import db from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, msg: '仅支持POST' });
    }

    try {
        // 添加文件上传和审核相关字段
        await db.query(`
            ALTER TABLE tasks 
            ADD COLUMN IF NOT EXISTS uploaded_files TEXT,
            ADD COLUMN IF NOT EXISTS review_status VARCHAR(20) DEFAULT 'pending',
            ADD COLUMN IF NOT EXISTS review_comment TEXT,
            ADD COLUMN IF NOT EXISTS reviewer_id VARCHAR(36),
            ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMP
        `, []);

        // 为status字段添加新的状态值（如果需要）
        // 注意：这里不修改已有数据的状态

        return res.status(200).json({
            success: true,
            msg: '数据库迁移成功，已添加文件上传和审核字段'
        });
    } catch (err) {
        console.error('数据库迁移失败：', err);
        return res.status(500).json({
            success: false,
            msg: '数据库迁移失败: ' + (err as Error).message
        });
    }
}