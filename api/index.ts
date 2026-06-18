import { NextApiRequest, NextApiResponse } from 'next';
import { Pool } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // CORS 处理
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // 初始化数据库表
    await initializeDatabase();

    switch (req.query.endpoint) {
      case 'auth/register':
        return registerUser(req, res);
      case 'auth/login':
        return loginUser(req, res);
      case 'groups':
        return handleGroups(req, res);
      case 'tasks':
        return handleTasks(req, res);
      case 'notifications':
        return handleNotifications(req, res);
      default:
        return res.status(404).json({ error: 'Endpoint not found' });
    }
  } catch (error) {
    console.error('API Error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function initializeDatabase() {
  const client = await pool.connect();
  
  try {
    // 创建用户表
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role VARCHAR(20) DEFAULT 'member',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建小组表
    await client.query(`
      CREATE TABLE IF NOT EXISTS groups (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(100) NOT NULL,
        description TEXT,
        admin_id UUID REFERENCES users(id),
        leader_id UUID REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建任务表
    await client.query(`
      CREATE TABLE IF NOT EXISTS tasks (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(200) NOT NULL,
        description TEXT,
        status VARCHAR(20) DEFAULT 'todo',
        priority VARCHAR(10) DEFAULT 'medium',
        assigned_to UUID REFERENCES users(id),
        group_id UUID REFERENCES groups(id),
        creator_id UUID REFERENCES users(id),
        due_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建通知表
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title VARCHAR(200) NOT NULL,
        content TEXT NOT NULL,
        type VARCHAR(20) DEFAULT 'info',
        group_id UUID REFERENCES groups(id),
        sender_id UUID REFERENCES users(id),
        recipient_id UUID REFERENCES users(id),
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建用户组关系表
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_groups (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id),
        group_id UUID REFERENCES groups(id),
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 插入默认管理员账户（仅在首次初始化时）
    const adminExists = await client.query(
      'SELECT id FROM users WHERE role = $1 LIMIT 1',
      ['admin']
    );
    
    if (adminExists.rowCount === 0) {
      const adminPasswordHash = await bcrypt.hash('admin123', 10);
      await client.query(
        'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4)',
        ['admin', 'admin@example.com', adminPasswordHash, 'admin']
      );
    }
  } finally {
    client.release();
  }
}

async function authenticateToken(token: string): Promise<any> {
  if (!token || !token.startsWith('Bearer ')) {
    throw new Error('Invalid token format');
  }
  
  const actualToken = token.slice(7);
  try {
    return jwt.verify(actualToken, process.env.JWT_SECRET || 'default_secret');
  } catch (error) {
    throw new Error('Invalid token');
  }
}

async function registerUser(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, email, password, role = 'member' } = req.body;

  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const client = await pool.connect();
  try {
    // 检查用户名或邮箱是否已存在
    const existingUser = await client.query(
      'SELECT id FROM users WHERE username = $1 OR email = $2',
      [username, email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }

    // 密码加密
    const passwordHash = await bcrypt.hash(password, 10);

    // 创建新用户
    const result = await client.query(
      'INSERT INTO users (username, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, username, email, role',
      [username, email, passwordHash, role]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({ error: 'Registration failed' });
  } finally {
    client.release();
  }
}

async function loginUser(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Missing username or password' });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(
      'SELECT id, username, email, password_hash, role FROM users WHERE username = $1 OR email = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // 生成 JWT token
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      process.env.JWT_SECRET || 'default_secret',
      { expiresIn: '24h' }
    );

    return res.status(200).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Login failed' });
  } finally {
    client.release();
  }
}

async function handleGroups(req: NextApiRequest, res: NextApiResponse) {
  let token;
  if (req.headers.authorization) {
    token = req.headers.authorization;
  } else if (req.query.token) {
    token = `Bearer ${req.query.token}`;
  }

  if (!token) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  let decodedToken;
  try {
    decodedToken = await authenticateToken(token);
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const client = await pool.connect();
  try {
    switch (req.method) {
      case 'GET':
        // 获取用户所在的所有小组
        const userGroupsResult = await client.query(`
          SELECT g.*, u.username as admin_name, ul.username as leader_name 
          FROM groups g 
          LEFT JOIN users u ON g.admin_id = u.id 
          LEFT JOIN users ul ON g.leader_id = ul.id 
          JOIN user_groups ug ON g.id = ug.group_id 
          WHERE ug.user_id = $1
        `, [decodedToken.id]);

        return res.status(200).json(userGroupsResult.rows);

      case 'POST':
        // 创建小组（仅管理员可操作）
        if (decodedToken.role !== 'admin') {
          return res.status(403).json({ error: 'Only admins can create groups' });
        }

        const { name, description, leaderId } = req.body;
        if (!name) {
          return res.status(400).json({ error: 'Group name is required' });
        }

        // 检查组长是否存在
        if (leaderId) {
          const leaderCheck = await client.query(
            'SELECT id, role FROM users WHERE id = $1 AND role IN ($2, $3)',
            [leaderId, 'leader', 'admin']
          );
          
          if (leaderCheck.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid leader ID' });
          }
        }

        const result = await client.query(
          'INSERT INTO groups (name, description, admin_id, leader_id) VALUES ($1, $2, $3, $4) RETURNING *',
          [name, description, decodedToken.id, leaderId || null]
        );

        // 自动将管理员加入小组
        await client.query(
          'INSERT INTO user_groups (user_id, group_id) VALUES ($1, $2)',
          [decodedToken.id, result.rows[0].id]
        );

        // 如果指定了组长，也将其加入小组
        if (leaderId) {
          await client.query(
            'INSERT INTO user_groups (user_id, group_id) VALUES ($1, $2)',
            [leaderId, result.rows[0].id]
          );
        }

        return res.status(201).json(result.rows[0]);

      case 'PUT':
        // 更新小组（仅管理员或组长可操作）
        const groupId = req.query.id as string;
        if (!groupId) {
          return res.status(400).json({ error: 'Group ID is required' });
        }

        // 检查权限
        const groupCheck = await client.query(
          'SELECT admin_id, leader_id FROM groups WHERE id = $1',
          [groupId]
        );

        if (groupCheck.rows.length === 0) {
          return res.status(404).json({ error: 'Group not found' });
        }

        const group = groupCheck.rows[0];
        if (
          decodedToken.id !== group.admin_id && 
          decodedToken.id !== group.leader_id &&
          decodedToken.role !== 'admin'
        ) {
          return res.status(403).json({ error: 'Insufficient permissions' });
        }

        const { newName, newDescription, newLeaderId } = req.body;
        
        const updateFields = [];
        const updateValues = [];
        let paramIndex = 1;

        if (newName) {
          updateFields.push(`name = $${paramIndex}`);
          updateValues.push(newName);
          paramIndex++;
        }
        if (newDescription !== undefined) {
          updateFields.push(`description = $${paramIndex}`);
          updateValues.push(newDescription);
          paramIndex++;
        }
        if (newLeaderId !== undefined) {
          // 验证新的组长身份
          const newLeaderCheck = await client.query(
            'SELECT id, role FROM users WHERE id = $1 AND role IN ($2, $3)',
            [newLeaderId, 'leader', 'admin']
          );
          
          if (newLeaderCheck.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid leader ID' });
          }
          
          updateFields.push(`leader_id = $${paramIndex}`);
          updateValues.push(newLeaderId);
          paramIndex++;
        }

        if (updateFields.length === 0) {
          return res.status(400).json({ error: 'No fields to update' });
        }

        updateValues.push(groupId);
        const updateQuery = `
          UPDATE groups SET ${updateFields.join(', ')} WHERE id = $${paramIndex}
          RETURNING *
        `;

        const updatedGroup = await client.query(updateQuery, updateValues);
        return res.status(200).json(updatedGroup.rows[0]);

      case 'DELETE':
        // 删除小组（仅管理员可操作）
        if (decodedToken.role !== 'admin') {
          return res.status(403).json({ error: 'Only admins can delete groups' });
        }

        const deleteGroupId = req.query.id as string;
        if (!deleteGroupId) {
          return res.status(400).json({ error: 'Group ID is required' });
        }

        await client.query('DELETE FROM groups WHERE id = $1', [deleteGroupId]);
        return res.status(200).json({ message: 'Group deleted successfully' });

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } finally {
    client.release();
  }
}

async function handleTasks(req: NextApiRequest, res: NextApiResponse) {
  let token;
  if (req.headers.authorization) {
    token = req.headers.authorization;
  } else if (req.query.token) {
    token = `Bearer ${req.query.token}`;
  }

  if (!token) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  let decodedToken;
  try {
    decodedToken = await authenticateToken(token);
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const client = await pool.connect();
  try {
    switch (req.method) {
      case 'GET':
        // 获取任务列表
        const groupId = req.query.groupId as string;
        if (!groupId) {
          return res.status(400).json({ error: 'Group ID is required' });
        }

        // 检查用户是否属于该小组
        const membershipCheck = await client.query(
          'SELECT user_id FROM user_groups WHERE user_id = $1 AND group_id = $2',
          [decodedToken.id, groupId]
        );

        if (membershipCheck.rows.length === 0) {
          return res.status(403).json({ error: 'Not a member of this group' });
        }

        let tasksQuery = '';
        if (req.query.assignedTo) {
          // 获取分配给特定用户的所有任务
          tasksQuery = `
            SELECT t.*, u.username as assignee_name, uc.username as creator_name 
            FROM tasks t 
            LEFT JOIN users u ON t.assigned_to = u.id 
            LEFT JOIN users uc ON t.creator_id = uc.id 
            WHERE t.group_id = $1 AND t.assigned_to = $2
            ORDER BY t.created_at DESC
          `;
          const tasksResult = await client.query(tasksQuery, [groupId, req.query.assignedTo]);
          return res.status(200).json(tasksResult.rows);
        } else {
          // 获取小组所有任务
          tasksQuery = `
            SELECT t.*, u.username as assignee_name, uc.username as creator_name 
            FROM tasks t 
            LEFT JOIN users u ON t.assigned_to = u.id 
            LEFT JOIN users uc ON t.creator_id = uc.id 
            WHERE t.group_id = $1
            ORDER BY t.created_at DESC
          `;
          const tasksResult = await client.query(tasksQuery, [groupId]);
          return res.status(200).json(tasksResult.rows);
        }

      case 'POST':
        // 创建任务（组长或管理员可操作）
        const { title, description, groupId: taskGroupId, assignedTo, dueDate, priority = 'medium' } = req.body;

        if (!title || !taskGroupId) {
          return res.status(400).json({ error: 'Title and Group ID are required' });
        }

        // 检查用户权限
        const groupCheck = await client.query(
          'SELECT admin_id, leader_id FROM groups WHERE id = $1',
          [taskGroupId]
        );

        if (groupCheck.rows.length === 0) {
          return res.status(404).json({ error: 'Group not found' });
        }

        const group = groupCheck.rows[0];
        if (
          decodedToken.id !== group.admin_id && 
          decodedToken.id !== group.leader_id &&
          decodedToken.role !== 'admin'
        ) {
          return res.status(403).json({ error: 'Only leaders and admins can create tasks' });
        }

        // 验证被分配用户是否属于该小组
        if (assignedTo) {
          const assignmentCheck = await client.query(
            'SELECT user_id FROM user_groups WHERE user_id = $1 AND group_id = $2',
            [assignedTo, taskGroupId]
          );

          if (assignmentCheck.rows.length === 0) {
            return res.status(400).json({ error: 'Assigned user is not a member of this group' });
          }
        }

        const result = await client.query(
          `INSERT INTO tasks (title, description, group_id, assigned_to, creator_id, due_date, priority) 
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
          [title, description, taskGroupId, assignedTo || null, decodedToken.id, dueDate || null, priority]
        );

        // 创建通知
        if (assignedTo) {
          await client.query(
            `INSERT INTO notifications (title, content, type, group_id, sender_id, recipient_id) 
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              `New Task Assigned: ${title}`,
              `You have been assigned a new task: ${title}`,
              'task',
              taskGroupId,
              decodedToken.id,
              assignedTo
            ]
          );
        }

        return res.status(201).json(result.rows[0]);

      case 'PUT':
        // 更新任务（任务创建者、分配者、组长或管理员可操作）
        const taskId = req.query.id as string;
        if (!taskId) {
          return res.status(400).json({ error: 'Task ID is required' });
        }

        const taskCheck = await client.query(
          'SELECT * FROM tasks WHERE id = $1',
          [taskId]
        );

        if (taskCheck.rows.length === 0) {
          return res.status(404).json({ error: 'Task not found' });
        }

        const task = taskCheck.rows[0];

        // 检查权限
        const groupInfo = await client.query(
          'SELECT admin_id, leader_id FROM groups WHERE id = $1',
          [task.group_id]
        );
        
        const groupData = groupInfo.rows[0];
        const hasPermission = (
          decodedToken.id === task.creator_id ||
          decodedToken.id === task.assigned_to ||
          decodedToken.id === groupData.admin_id ||
          decodedToken.id === groupData.leader_id ||
          decodedToken.role === 'admin'
        );

        if (!hasPermission) {
          return res.status(403).json({ error: 'Insufficient permissions to update this task' });
        }

        const { newStatus, newAssignedTo, newTitle, newDescription, newDueDate, newPriority } = req.body;
        
        const updateFields = [];
        const updateValues = [];
        let paramIndex = 1;

        if (newStatus) {
          updateFields.push(`status = $${paramIndex}`);
          updateValues.push(newStatus);
          paramIndex++;
        }
        if (newTitle) {
          updateFields.push(`title = $${paramIndex}`);
          updateValues.push(newTitle);
          paramIndex++;
        }
        if (newDescription !== undefined) {
          updateFields.push(`description = $${paramIndex}`);
          updateValues.push(newDescription);
          paramIndex++;
        }
        if (newAssignedTo !== undefined) {
          // 验证新的分配用户
          const newAssignmentCheck = await client.query(
            'SELECT user_id FROM user_groups WHERE user_id = $1 AND group_id = $2',
            [newAssignedTo, task.group_id]
          );

          if (newAssignmentCheck.rows.length === 0) {
            return res.status(400).json({ error: 'Assigned user is not a member of this group' });
          }
          
          updateFields.push(`assigned_to = $${paramIndex}`);
          updateValues.push(newAssignedTo);
          paramIndex++;
        }
        if (newDueDate !== undefined) {
          updateFields.push(`due_date = $${paramIndex}`);
          updateValues.push(newDueDate);
          paramIndex++;
        }
        if (newPriority) {
          updateFields.push(`priority = $${paramIndex}`);
          updateValues.push(newPriority);
          paramIndex++;
        }

        updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
        
        if (updateFields.length <= 1) { // Only updated_at was added
          return res.status(400).json({ error: 'No fields to update' });
        }

        updateValues.push(taskId);
        const updateQuery = `
          UPDATE tasks SET ${updateFields.join(', ')} WHERE id = $${paramIndex}
          RETURNING *
        `;

        const updatedTask = await client.query(updateQuery, updateValues);
        return res.status(200).json(updatedTask.rows[0]);

      case 'DELETE':
        // 删除任务（仅任务创建者、组长或管理员可操作）
        const deleteTaskId = req.query.id as string;
        if (!deleteTaskId) {
          return res.status(400).json({ error: 'Task ID is required' });
        }

        const deleteTaskCheck = await client.query(
          'SELECT t.*, g.admin_id, g.leader_id FROM tasks t JOIN groups g ON t.group_id = g.id WHERE t.id = $1',
          [deleteTaskId]
        );

        if (deleteTaskCheck.rows.length === 0) {
          return res.status(404).json({ error: 'Task not found' });
        }

        const deleteTask = deleteTaskCheck.rows[0];
        if (
          decodedToken.id !== deleteTask.creator_id &&
          decodedToken.id !== deleteTask.admin_id && 
          decodedToken.id !== deleteTask.leader_id &&
          decodedToken.role !== 'admin'
        ) {
          return res.status(403).json({ error: 'Insufficient permissions to delete this task' });
        }

        await client.query('DELETE FROM tasks WHERE id = $1', [deleteTaskId]);
        return res.status(200).json({ message: 'Task deleted successfully' });

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } finally {
    client.release();
  }
}

async function handleNotifications(req: NextApiRequest, res: NextApiResponse) {
  let token;
  if (req.headers.authorization) {
    token = req.headers.authorization;
  } else if (req.query.token) {
    token = `Bearer ${req.query.token}`;
  }

  if (!token) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  let decodedToken;
  try {
    decodedToken = await authenticateToken(token);
  } catch (error) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const client = await pool.connect();
  try {
    switch (req.method) {
      case 'GET':
        // 获取用户的通知列表
        const notificationsResult = await client.query(`
          SELECT n.*, u.username as sender_name 
          FROM notifications n 
          LEFT JOIN users u ON n.sender_id = u.id 
          WHERE n.recipient_id = $1 
          ORDER BY n.created_at DESC
        `, [decodedToken.id]);

        return res.status(200).json(notificationsResult.rows);

      case 'POST':
        // 发布通知（组长或管理员可操作）
        const { title, content, groupId, recipients } = req.body;

        if (!title || !content || !groupId) {
          return res.status(400).json({ error: 'Title, content, and group ID are required' });
        }

        // 检查权限
        const groupCheck = await client.query(
          'SELECT admin_id, leader_id FROM groups WHERE id = $1',
          [groupId]
        );

        if (groupCheck.rows.length === 0) {
          return res.status(404).json({ error: 'Group not found' });
        }

        const group = groupCheck.rows[0];
        if (
          decodedToken.id !== group.admin_id && 
          decodedToken.id !== group.leader_id &&
          decodedToken.role !== 'admin'
        ) {
          return res.status(403).json({ error: 'Only leaders and admins can send notifications' });
        }

        if (recipients && Array.isArray(recipients)) {
          // 发送给特定用户
          for (const userId of recipients) {
            await client.query(
              `INSERT INTO notifications (title, content, type, group_id, sender_id, recipient_id) 
               VALUES ($1, $2, $3, $4, $5, $6)`,
              [title, content, 'notification', groupId, decodedToken.id, userId]
            );
          }
        } else {
          // 发送给小组所有成员
          const groupMembers = await client.query(
            'SELECT user_id FROM user_groups WHERE group_id = $1',
            [groupId]
          );

          for (const member of groupMembers.rows) {
            if (member.user_id !== decodedToken.id) { // 不发送给自己
              await client.query(
                `INSERT INTO notifications (title, content, type, group_id, sender_id, recipient_id) 
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [title, content, 'notification', groupId, decodedToken.id, member.user_id]
              );
            }
          }
        }

        return res.status(201).json({ message: 'Notification sent successfully' });

      case 'PUT':
        // 标记通知为已读
        const notificationId = req.query.id as string;
        if (!notificationId) {
          return res.status(400).json({ error: 'Notification ID is required' });
        }

        // 检查通知是否属于当前用户
        const notificationCheck = await client.query(
          'SELECT recipient_id FROM notifications WHERE id = $1',
          [notificationId]
        );

        if (notificationCheck.rows.length === 0) {
          return res.status(404).json({ error: 'Notification not found' });
        }

        if (notificationCheck.rows[0].recipient_id !== decodedToken.id) {
          return res.status(403).json({ error: 'Cannot modify another user\'s notification' });
        }

        await client.query(
          'UPDATE notifications SET is_read = true WHERE id = $1',
          [notificationId]
        );

        return res.status(200).json({ message: 'Notification marked as read' });

      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } finally {
    client.release();
  }
}