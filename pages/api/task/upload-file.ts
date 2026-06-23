import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import db from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, msg: '仅支持POST' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, msg: '未登录' });
    }
    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET;

    let loginUserId: string;
    try {
        const payload = jwt.verify(token, secret!) as { id: string; role: string };
        loginUserId = payload.id;
    } catch {
        return res.status(401).json({ success: false, msg: '登录失效' });
    }

    const { taskId, fileName, fileContent } = req.body;
    
    if (!taskId || !fileName || !fileContent) {
        return res.status(400).json({ success: false, msg: '缺少必要参数' });
    }

    try {
        // 检查任务是否存在且当前用户是任务的执行者
        const taskRow = await db.query(
            `SELECT assignee_id, status FROM tasks WHERE id = $1`,
            [taskId]
        );
        
        if (taskRow.rows.length === 0) {
            return res.status(404).json({ success: false, msg: '任务不存在' });
        }

        if (taskRow.rows[0].assignee_id !== loginUserId) {
            return res.status(403).json({ success: false, msg: '只能上传自己任务的文件' });
        }

        // 获取当前已上传的文件列表
        const currentFiles = taskRow.rows[0].uploaded_files ? JSON.parse(taskRow.rows[0].uploaded_files) : [];
        
        // 添加新文件（存储为Base64）
        const newFile = {
            id: Date.now().toString(),
            name: fileName,
            content: fileContent,
            uploadedAt: new Date().toISOString(),
            uploadedBy: loginUserId
        };
        
        currentFiles.push(newFile);

        // 更新任务的文件列表
        await db.query(
            `UPDATE tasks SET uploaded_files = $1 WHERE id = $2`,
            [JSON.stringify(currentFiles), taskId]
        );

        return res.status(200).json({
            success: true,
            msg: '文件上传成功',
            data: currentFiles
        });
    } catch (err) {
        console.error('文件上传失败：', err);
        return res.status(500).json({
            success: false,
            msg: '文件上传失败: ' + (err as Error).message
        });
    }
}