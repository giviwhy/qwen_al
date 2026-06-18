import type { NextApiRequest, NextApiResponse } from 'next';
import jwt from 'jsonwebtoken';
import db from '../../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ success: false, msg: '仅支持GET', data: [] });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ success: false, msg: '未登录', data: [] });
  const token = authHeader.split(' ')[1];
  const secret = process.env.JWT_SECRET;
  let userId: string, role: string;
  try {
    const payload = jwt.verify(token, secret!) as { id: string; role: string };
    userId = payload.id;
    role = payload.role;
  } catch {
    return res.status(401).json({ success: false, msg: '登录失效', data: [] });
  }

  const groupRes = await db.query(`SELECT group_id FROM group_members WHERE user_id = $1`, [userId]);
  const userGroupIds = groupRes.rows.map(r => r.group_id);

  const result = await db.query(`
    SELECT
      n.*,
      nr.read_at,
      u.username as sender_name
    FROM notifications n
    LEFT JOIN users u ON n.sender_id = u.id
    LEFT JOIN notification_read nr ON n.id = nr.notification_id AND nr.user_id = $1
    WHERE n.group_id IS NULL OR n.group_id = ANY($2::uuid[])
    ORDER BY n.id DESC
  `, [userId, userGroupIds.length ? userGroupIds : null]);

  const list = result.rows.map(item => ({
    ...item,
    isUnread: item.read_at === null
  }));

  return res.status(200).json({ success: true, data: list });
}