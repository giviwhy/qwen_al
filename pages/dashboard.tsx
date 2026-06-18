import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Group, Task, Notification } from '../types';
import { useRouter } from 'next/router';

const Dashboard: React.FC = () => {
    const [groups, setGroups] = useState<Group[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const { user, logout } = useAuth();
    const router = useRouter();

    // 统一带Token的请求封装
    const authFetch = async (url: string, options: RequestInit = {}) => {
        const token = localStorage.getItem('token');
        return fetch(url, {
            ...options,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
    };

    // 未登录跳转登录页
    useEffect(() => {
        if (!user && router.isReady) {
            router.push('/login');
        }
    }, [user, router]);

    // 用户登录后拉取小组、通知
    useEffect(() => {
        if (user) {
            fetchData();
        }
    }, [user, selectedGroup]);

    if (!user) return <div>Loading...</div>;

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. 获取小组（新接口 /api/groups）
            const groupsRes = await authFetch('/api/groups');
            if (groupsRes.ok) {
                const groupsData = await groupsRes.json();
                setGroups(groupsData);
                if (!selectedGroup && groupsData.length > 0) {
                    setSelectedGroup(groupsData[0].id);
                }
            }

            // 2. 获取通知（替换旧参数接口为 /api/notifications）
            const notifyRes = await authFetch('/api/notifications');
            if (notifyRes.ok) {
                const notifyData = await notifyRes.json();
                setNotifications(notifyData);
            }
        } catch (err) {
            console.error('拉取首页数据失败：', err);
        } finally {
            setLoading(false);
        }
    };

    const handleGroupChange = (groupId: string) => {
        setSelectedGroup(groupId);
    };

    return (
        <div className="dashboard">
            <header>
                <h1>Team Collaboration Board</h1>
                <div className="user-info">
                    <span>Welcome, {user.username} ({user.role})</span>
                    <button onClick={logout}>Logout</button>
                </div>
            </header>
            <main style={{ display: 'flex', gap: '1rem' }}>
                <aside style={{ width: '240px' }}>
                    <h2>Your Groups</h2>
                    <div className="groups-list">
                        {groups.map(group => (
                            <div
                                key={group.id}
                                className={`group-item ${selectedGroup === group.id ? 'active' : ''}`}
                                onClick={() => handleGroupChange(group.id)}
                                style={{ padding: '8px', border: '1px solid #ccc', marginBottom: 6, cursor: 'pointer' }}
                            >
                                <h3>{group.name}</h3>
                                <p>{group.description}</p>
                                {group.leader_name && <small>Leader: {group.leader_name}</small>}
                            </div>
                        ))}
                    </div>
                </aside>

                <section className="main-content" style={{ flex: 1 }}>
                    {selectedGroup ? (
                        <GroupView groupId={selectedGroup} authFetch={authFetch} />
                    ) : (
                        <div>Select a group to view details</div>
                    )}
                </section>

                <aside className="notifications-panel" style={{ width: '280px' }}>
                    <h2>Notifications</h2>
                    <div className="notifications-list">
                        {notifications.length > 0 ? (
                            notifications.map(notification => (
                                <div
                                    key={notification.id}
                                    className={`notification ${notification.is_read ? 'read' : 'unread'}`}
                                    style={{ padding: 8, borderBottom: '1px solid #eee' }}
                                >
                                    <h4>{notification.title}</h4>
                                    <p>{notification.content}</p>
                                    <small>
                                        From: {notification.sender_name} |{' '}
                                        {new Date(notification.created_at).toLocaleString()}
                                    </small>
                                </div>
                            ))
                        ) : (
                            <p>No notifications</p>
                        )}
                    </div>
                </aside>
            </main>
        </div >
    );
};

interface GroupViewProps {
    groupId: string;
    authFetch: (url: string, opt?: RequestInit) => Promise<Response>;
}

const GroupView: React.FC<GroupViewProps> = ({ groupId, authFetch }) => {
    const { user } = useAuth();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [newTask, setNewTask] = useState({
        title: '',
        description: '',
        assignedTo: '',
        dueDate: '',
        priority: 'medium',
    });

    useEffect(() => {
        fetchTasks();
    }, [groupId]);

    const fetchTasks = async () => {
        setLoading(true);
        try {
            // 替换旧参数接口为 /api/tasks?groupId=xxx
            const res = await authFetch(`/api/tasks?groupId=${groupId}`);
            if (res.ok) {
                const taskData = await res.json();
                setTasks(taskData);
            }
        } catch (err) {
            console.error('拉取任务失败：', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateTask = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await authFetch('/api/tasks', {
                method: 'POST',
                body: JSON.stringify({
                    title: newTask.title,
                    description: newTask.description,
                    groupId: groupId,
                    assignedTo: newTask.assignedTo || null,
                    dueDate: newTask.dueDate || null,
                    priority: newTask.priority,
                })
            });

            if (res.ok) {
                const createdTask = await res.json();
                setTasks([createdTask, ...tasks]);
                setNewTask({
                    title: '',
                    description: '',
                    assignedTo: '',
                    dueDate: '',
                    priority: 'medium',
                });
            } else {
                alert('Failed to create task');
            }
        } catch (err) {
            alert('网络异常，创建任务失败');
        }
    };

    if (loading) return <div>Loading tasks...</div>;

    return (
        <div className="group-view">
            <h2>Tasks</h2>
            {(user.role === 'leader' || user.role === 'admin') && (
                <form onSubmit={handleCreateTask} className="create-task-form" style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <h3>Create New Task</h3>
                    <input
                        type="text"
                        placeholder="Task title"
                        value={newTask.title}
                        onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                        required
                    />
                    <textarea
                        placeholder="Task description"
                        value={newTask.description}
                        onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                    />
                    <select
                        value={newTask.assignedTo}
                        onChange={(e) => setNewTask({ ...newTask, assignedTo: e.target.value })}
                    >
                        <option value="">Unassigned</option>
                        {/* 后续可填充当前小组成员 */}
                    </select>
                    <input
                        type="date"
                        value={newTask.dueDate}
                        onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                    />
                    <select
                        value={newTask.priority}
                        onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                    >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                    </select>
                    <button type="submit">Create Task</button>
                </form>
            )}
            <div className="tasks-board" style={{ display: 'flex', gap: '0.8rem', overflowX: 'auto' }}>
                <div className="task-column" style={{ minWidth: 220, border: '1px solid #eee', padding: 8 }}>
                    <h3>To Do</h3>
                    {tasks.filter(t => t.status === 'todo').map(task => (
                        <TaskCard key={task.id} task={task} />
                    ))}
                </div>
                <div className="task-column" style={{ minWidth: 220, border: '1px solid #eee', padding: 8 }}>
                    <h3>In Progress</h3>
                    {tasks.filter(t => t.status === 'in-progress').map(task => (
                        <TaskCard key={task.id} task={task} />
                    ))}
                </div>
                <div className="task-column" style={{ minWidth: 220, border: '1px solid #eee', padding: 8 }}>
                    <h3>Review</h3>
                    {tasks.filter(t => t.status === 'review').map(task => (
                        <TaskCard key={task.id} task={task} />
                    ))}
                </div>
                <div className="task-column" style={{ minWidth: 220, border: '1px solid #eee', padding: 8 }}>
                    <h3>Done</h3>
                    {tasks.filter(t => t.status === 'done').map(task => (
                        <TaskCard key={task.id} task={task} />
                    ))}
                </div>
            </div>
        </div>
    );
};

interface TaskCardProps {
    task: Task;
}

const TaskCard: React.FC<TaskCardProps> = ({ task }) => {
    const [showDetails, setShowDetails] = useState(false);
    return (
        <div className="task-card" style={{ border: '1px solid #ddd', padding: 8, marginBottom: 6, borderRadius: 4 }}>
            <div className="task-header" onClick={() => setShowDetails(!showDetails)} style={{ cursor: 'pointer' }}>
                <h4 style={{ margin: 0 }}>{task.title}</h4>
                <span className={`priority ${task.priority}`}>{task.priority}</span>
            </div>
            {showDetails && (
                <div className="task-details" style={{ marginTop: 6, fontSize: 14 }}>
                    <p><strong>Description:</strong> {task.description || '无'}</p>
                    <p><strong>Assigned to:</strong> {task.assignee_name || 'Unassigned'}</p>
                    <p><strong>Created by:</strong> {task.creator_name}</p>
                    <p><strong>Status:</strong> {task.status}</p>
                    {task.due_date && <p><strong>Due:</strong> {new Date(task.due_date).toLocaleDateString()}</p>}
                </div>
            )}
        </div>
    );
};

export const dynamic = "force-dynamic";
export default Dashboard;