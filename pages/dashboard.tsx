import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Group, Task, Notification, User } from '../types';
import { useRouter } from 'next/router';

const Dashboard: React.FC = () => {
    const [groups, setGroups] = useState<Group[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [currentGroupMembers, setCurrentGroupMembers] = useState<User[]>([]);
    const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const { user, logout } = useAuth();
    const router = useRouter();

    // Toast 提示状态
    const [toast, setToast] = useState<{ show: boolean; msg: string; type: 'success' | 'error' }>({
        show: false,
        msg: '',
        type: 'success',
    });

    // 切换选中小组函数
    const handleGroupChange = (gid: string) => {
        setSelectedGroup(gid);
        // 切换小组清空组员
        setCurrentGroupMembers([]);
    };

    // 统一带Token的请求封装
    const authFetch = async (url: string, options: RequestInit = {}) => {
        const token = localStorage.getItem('token');
        const response = await fetch(url, {
            ...options,
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });

        // Token 过期自动登出
        if (response.status === 401) {
            logout();
            return response;
        }

        return response;
    };

    // 路由就绪后判断登录态
    useEffect(() => {
        if (!router.isReady) return;
        setLoading(true);
        if (!user) {
            router.push('/login');
        } else {
            fetchData();
        }
        setLoading(false);
    }, [user, router.isReady]);

    // 选中小组时加载本组成员
    useEffect(() => {
        if (selectedGroup) {
            fetchCurrentGroupMember(selectedGroup);
        } else {
            setCurrentGroupMembers([]);
        }
    }, [selectedGroup]);

    // 获取当前选中小组内部成员
    const fetchCurrentGroupMember = async (gid: string) => {
        const res = await authFetch(`/api/group-members?groupId=${gid}`);
        if (res.ok) {
            const json = await res.json();
            setCurrentGroupMembers(json.data || []);
        } else {
            setCurrentGroupMembers([]);
        }
    };

    // 加载小组、个人通知数据
    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. 获取用户所属小组列表
            const groupsRes = await authFetch('/api/groups');
            if (groupsRes.ok) {
                const json = await groupsRes.json();
                const groupsData = json.data || [];
                setGroups(groupsData);
                // 自动选中第一个小组
                if (!selectedGroup && groupsData.length > 0) {
                    setSelectedGroup(groupsData[0].id);
                }
            }

            // 2. 获取个人通知
            const notifyRes = await authFetch('/api/notifications');
            if (notifyRes.ok) {
                const json = await notifyRes.json();
                setNotifications(json.data || []);
            }
        } catch (err) {
            console.error('拉取首页数据失败：', err);
            showToast('数据加载失败', 'error');
        } finally {
            setLoading(false);
        }
    };

    // Toast 提示函数
    const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ show: true, msg, type });
        setTimeout(() => {
            setToast(prev => ({ ...prev, show: false }));
        }, 3000);
    };

    // 加载中占位，阻断空user渲染
    if (loading || !router.isReady) return <div style={{ padding: "3rem", textAlign: "center" }}>页面加载中，请稍候...</div>;
    if (!user) return null;

    return (
        <div className="dashboard" style={{ padding: "1rem" }}>
            {/* Toast 提示组件 */}
            {toast.show && (
                <div
                    style={{
                        position: 'fixed',
                        top: 20,
                        right: 20,
                        background: toast.type === 'success' ? '#4CAF50' : '#F44336',
                        color: 'white',
                        padding: '12px 24px',
                        borderRadius: 4,
                        boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
                        zIndex: 9999,
                    }}
                >
                    {toast.msg}
                </div>
            )}

            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: "1rem" }}>
                <h1>团队协作任务看板</h1>
                <div className="user-info" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <span>
                        欢迎你，{user?.username}（{user?.role === 'admin' ? '管理员' : user?.role === 'leader' ? '组长' : '普通成员'}）
                    </span>
                    {/* 管理员跳转独立管理面板入口 */}
                    {user?.role === 'admin' && (
                        <button
                            style={{ padding: '6px 10px', cursor: 'pointer', background: "#2ecc71", color: "#fff", border: 0, borderRadius: 4 }}
                            onClick={() => router.push('/admin')}
                        >
                            进入后台管理面板
                        </button>
                    )}
                    <button style={{ padding: '6px 10px', cursor: 'pointer' }} onClick={logout}>
                        退出登录
                    </button>
                </div>
            </header>

            <main style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
                <aside style={{ width: '240px' }}>
                    <h2 style={{ marginBottom: '12px' }}>我的小组</h2>
                    {/* 移除管理员新建小组、编辑、删除、组员管理全部按钮 */}
                    <div className="groups-list">
                        {groups?.map((group) => (
                            <div
                                key={group.id}
                                className={`group-item ${selectedGroup === group.id ? 'active' : ''}`}
                                onClick={() => handleGroupChange(group.id)}
                                style={{
                                    padding: '12px',
                                    border: '1px #ccc solid',
                                    marginBottom: '8px',
                                    cursor: 'pointer',
                                    borderRadius: '6px',
                                    background: selectedGroup === group.id ? "#f0f7ff" : "#fff"
                                }}
                            >
                                <h3 style={{ marginBottom: '6px' }}>{group.name}</h3>
                                <p style={{ fontSize: '13px', marginBottom: '6px' }}>
                                    {group.description || '暂无描述'}
                                </p>
                                <small>组长：{group?.leader_name ?? '暂无组长'}</small>
                                {/* 无管理员操作按钮 */}
                            </div>
                        ))}
                    </div>
                </aside>

                <section className="main-content" style={{ flex: 1 }}>
                    {selectedGroup ? (
                        <GroupView
                            groupId={selectedGroup}
                            authFetch={authFetch}
                            userRole={user?.role}
                            currentGroupMembers={currentGroupMembers}
                        />
                    ) : (
                        <div style={{ padding: "3rem", textAlign: "center", border: "1px solid #eee", borderRadius: "8px" }}>请选择左侧小组查看任务详情</div>
                    )}
                </section>

                <aside className="notifications-panel" style={{ width: '280px', border: "1px solid #eee", padding: "12px", borderRadius: "8px" }}>
                    <h2 style={{ marginBottom: '12px' }}>我的消息通知</h2>
                    <div className="notifications-list">
                        {notifications?.length > 0 ? (
                            notifications?.map((notification) => (
                                <div
                                    key={notification.id}
                                    className={`notification ${notification.is_read ? '' : 'unread'}`}
                                    style={{
                                        padding: '12px',
                                        borderBottom: '1px #eee solid',
                                        marginBottom: '8px',
                                        background: notification.is_read ? "#fff" : "#f9fbff"
                                    }}
                                >
                                    <h4 style={{ marginBottom: '6px' }}>{notification.title}</h4>
                                    <p style={{ fontSize: '13px', marginBottom: '6px' }}>
                                        {notification.content}
                                    </p>
                                    <small style={{ fontSize: '12px' }}>
                                        发送人：{notification?.sender_name}
                                        {!notification.group_id && (
                                            <span style={{ color: '#e74c3c', fontWeight: 'bold' }}>【全站公告】</span>
                                        )}
                                        <br />
                                        {new Date(notification.created_at).toLocaleString()}
                                    </small>
                                </div>
                            ))
                        ) : (
                            <p style={{ textAlign: "center", color: "#888" }}>暂无通知消息</p>
                        )}
                    </div>
                </aside>
            </main>
        </div>
    );
};

// GroupView 子组件（仅组长/管理员能创建、删除本组任务，无小组管理功能）
interface GroupViewProps {
    groupId: string;
    authFetch: (url: string, opt?: RequestInit) => Promise<Response>;
    userRole?: string;
    currentGroupMembers: User[];
}

const GroupView: React.FC<GroupViewProps> = ({ groupId, authFetch, userRole, currentGroupMembers }) => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [newTask, setNewTask] = useState({
        title: '',
        description: '',
        assignedTo: '',
        dueDate: '',
        priority: 'medium' as 'low' | 'medium' | 'high',
    });

    useEffect(() => {
        fetchTasks();
    }, [groupId]);

    const fetchTasks = async () => {
        setLoading(true);
        try {
            const res = await authFetch(`/api/tasks?groupId=${groupId}`);
            if (res.ok) {
                const json = await res.json();
                setTasks(json.data || []);
            }
        } catch (err) {
            console.error('加载任务失败', err);
        } finally {
            setLoading(false);
        }
    };

    // 创建任务
    const handleCreateTask = async () => {
        if (!newTask.title.trim()) return alert('任务标题不能为空');
        const res = await authFetch('/api/tasks', {
            method: 'POST',
            body: JSON.stringify({
                groupId,
                ...newTask
            })
        });
        if (res.ok) {
            setNewTask({
                title: '',
                description: '',
                assignedTo: '',
                dueDate: '',
                priority: 'medium'
            });
            fetchTasks();
        } else {
            alert('创建任务失败');
        }
    };

    // 修改任务状态
    const changeTaskStatus = async (taskId: string, status: string) => {
        await authFetch(`/api/task/${taskId}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status })
        });
        fetchTasks();
    };

    // 删除任务
    const deleteTaskItem = async (taskId: string) => {
        if (!confirm('确定删除该任务？')) return;
        const res = await authFetch(`/api/task/${taskId}`, { method: 'DELETE' });
        if (res.ok) fetchTasks();
        else alert('删除失败');
    };

    if (loading) return <div style={{ padding: "3rem", textAlign: "center" }}>任务加载中...</div>;

    return (
        <div style={{ border: "1px solid #eee", padding: "16px", borderRadius: "8px" }}>
            <h2 style={{ marginBottom: "1rem" }}>小组任务列表</h2>

            {/* 组长/管理员才可见新建任务面板（仅任务操作，不属于小组全局管理） */}
            {(userRole === 'admin' || userRole === 'leader') && (
                <div style={{ border: '1px solid #ddd', padding: 16, marginBottom: 20, borderRadius: 6 }}>
                    <h4 style={{ marginBottom: "0.8rem" }}>新建任务</h4>
                    <input
                        placeholder="任务标题"
                        value={newTask.title}
                        onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                        style={{ width: '100%', margin: '8px 0', padding: 8, border: "1px solid #ddd", borderRadius: "4px" }}
                    />
                    <textarea
                        placeholder="任务描述"
                        value={newTask.description}
                        onChange={e => setNewTask({ ...newTask, description: e.target.value })}
                        style={{ width: '100%', margin: '8px 0', padding: 8, border: "1px solid #ddd", borderRadius: "4px" }}
                    />
                    <div style={{ display: 'flex', gap: 10, margin: '8px 0', flexWrap: "wrap" }}>
                        <select
                            value={newTask.assignedTo}
                            onChange={e => setNewTask({ ...newTask, assignedTo: e.target.value })}
                            style={{ flex: 1, padding: 8, border: "1px solid #ddd", borderRadius: "4px" }}
                        >
                            <option value="">选择负责人</option>
                            {currentGroupMembers?.map(m => (
                                <option key={m.id} value={m.id}>{m.username}</option>
                            ))}
                        </select>
                        <input
                            type="date"
                            value={newTask.dueDate}
                            onChange={e => setNewTask({ ...newTask, dueDate: e.target.value })}
                            style={{ flex: 1, padding: 8, border: "1px solid #ddd", borderRadius: "4px" }}
                        />
                        <select
                            value={newTask.priority}
                            onChange={e => setNewTask({ ...newTask, priority: e.target.value as any })}
                            style={{ flex: 1, padding: 8, border: "1px solid #ddd", borderRadius: "4px" }}
                        >
                            <option value="low">低优先级</option>
                            <option value="medium">中优先级</option>
                            <option value="high">高优先级</option>
                        </select>
                    </div>
                    <button
                        onClick={handleCreateTask}
                        style={{ padding: '8px 16px', background: '#0070f3', color: '#fff', border: 0, borderRadius: 4 }}
                    >
                        创建任务
                    </button>
                </div>
            )}

            {/* 任务列表 */}
            {tasks?.length === 0 ? (
                <p style={{ textAlign: "center", padding: "2rem", color: "#888" }}>该小组暂无任务</p>
            ) : (
                <div style={{ border: '1px solid #ddd', borderRadius: 6 }}>
                    {tasks?.map(task => (
                        <div key={task.id} style={{ padding: 12, borderBottom: '1px solid #eee' }}>
                            <h4>{task.title}
                                {task.priority === 'high' && <span style={{ color: 'red', marginLeft: 8 }}>高优</span>}
                                {task.priority === 'low' && <span style={{ color: 'gray', marginLeft: 8 }}>低优</span>}
                            </h4>
                            <p style={{ fontSize: 13, margin: 4 }}>{task.description || '无描述'}</p>
                            <div style={{ fontSize: 12, color: '#666', margin: 6 }}>
                                负责人：{task?.assignee_name || '未分配'}
                                &nbsp;|&nbsp;
                                创建人：{task?.creator_name}
                                &nbsp;|&nbsp;
                                截止日期：{task.due_date || '无'}
                                &nbsp;|&nbsp;
                                当前状态：{task.status === 'todo' ? '待完成' : task.status === 'in-progress' ? '进行中' : task.status === 'review' ? '审核中' : '已完成'}
                            </div>

                            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                                <button onClick={() => changeTaskStatus(task.id, 'todo')}>待完成</button>
                                <button onClick={() => changeTaskStatus(task.id, 'doing')}>进行中</button>
                                <button onClick={() => changeTaskStatus(task.id, 'done')}>已完成</button>
                                {(userRole === 'admin' || userRole === 'leader') && (
                                    <button
                                        onClick={() => deleteTaskItem(task.id)}
                                        style={{ color: '#fff', background: '#e74c3c', border: 0, padding: '4px 8px' }}
                                    >
                                        删除任务
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Dashboard;