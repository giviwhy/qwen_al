import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Group, Task, Notification, User } from '../types';
import { useRouter } from 'next/router';

const Dashboard: React.FC = () => {
    const [groups, setGroups] = useState<Group[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [allUserList, setAllUserList] = useState<User[]>([]);
    const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const { user, logout } = useAuth();
    const router = useRouter();

    // 小组弹窗状态
    const [showCreateGroup, setShowCreateGroup] = useState(false);
    const [newGroupForm, setNewGroupForm] = useState({ name: '', description: '' });
    const [editGroupId, setEditGroupId] = useState<string | null>(null);
    const [editGroupForm, setEditGroupForm] = useState({ name: '', description: '' });
    const [memberPanelId, setMemberPanelId] = useState<string | null>(null);
    // 管理员全局通知弹窗
    const [showGlobalNotice, setShowGlobalNotice] = useState(false);
    const [globalNoticeForm, setGlobalNoticeForm] = useState({ title: '', content: '' });

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

    // 用户登录后拉取小组、通知、管理员拉取全部用户
    useEffect(() => {
        if (user) {
            fetchData();
            if (user.role === 'admin') fetchAllUsers();
        }
    }, [user, selectedGroup]);

    if (!user) return <div>加载中...</div>;

    // 获取全部系统用户（管理员组员下拉使用）
    const fetchAllUsers = async () => {
        const res = await authFetch('/api/users');
        if (res.ok) setAllUserList(await res.json());
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. 获取小组
            const groupsRes = await authFetch('/api/groups');
            if (groupsRes.ok) {
                const groupsData = await groupsRes.json();
                setGroups(groupsData);
                if (!selectedGroup && groupsData.length > 0) {
                    setSelectedGroup(groupsData[0].id);
                }
            }

            // 2. 获取通知
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

    // 创建小组提交
    const submitCreateGroup = async () => {
        const res = await authFetch('/api/create-group', {
            method: 'POST',
            body: JSON.stringify(newGroupForm)
        });
        if (res.ok) {
            fetchData();
            setShowCreateGroup(false);
            setNewGroupForm({ name: '', description: '' });
        }
    };

    // 保存编辑小组
    const saveEditGroup = async (gid: string) => {
        const res = await authFetch(`/api/group/${gid}`, {
            method: 'PUT',
            body: JSON.stringify(editGroupForm)
        });
        if (res.ok) {
            fetchData();
            setEditGroupId(null);
        }
    };

    // 删除小组
    const deleteGroup = async (gid: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('确定删除该小组？小组下所有任务、通知会同步清空')) return;
        const res = await authFetch(`/api/group/${gid}`, { method: 'DELETE' });
        if (res.ok) fetchData();
    };

    // 添加组员到小组
    const addGroupMember = async (groupId: string, uid: string) => {
        await authFetch('/api/group/add-member', {
            method: 'POST',
            body: JSON.stringify({ groupId, userId: uid })
        });
        alert('添加组员成功');
    };

    // 修改小组组长
    const changeGroupLeader = async (groupId: string, uid: string) => {
        await authFetch('/api/group/set-leader', {
            method: 'PUT',
            body: JSON.stringify({ groupId, newLeaderId: uid })
        });
        fetchData();
        alert('组长更换完成');
    };

    // 管理员发送全站通知
    const sendGlobalNotice = async () => {
        const res = await authFetch('/api/admin/send-all-notice', {
            method: 'POST',
            body: JSON.stringify(globalNoticeForm)
        });
        if (res.ok) {
            alert('全站通知发送成功，所有用户已接收');
            setShowGlobalNotice(false);
            setGlobalNoticeForm({ title: '', content: '' });
            fetchData();
        }
    };

    return (
        <div className="dashboard">
            <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1>团队协作任务看板</h1>
                <div className="user-info" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <span>欢迎你，{user.username}（{user.role === 'admin' ? '管理员' : user.role === 'leader' ? '组长' : '普通成员'}）</span>
                    {user.role === 'admin' && (
                        <button onClick={() => setShowGlobalNotice(true)}>群发全站通知</button>
                    )}
                    <button onClick={logout}>退出登录</button>
                </div>
            </header>

            {/* 管理员全局通知弹窗 */}
            {showGlobalNotice && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
                    <div style={{ background: '#fff', padding: 20, width: 420 }}>
                        <h3>发布全站公告</h3>
                        <input
                            placeholder="通知标题"
                            value={globalNoticeForm.title}
                            onChange={e => setGlobalNoticeForm({ ...globalNoticeForm, title: e.target.value })}
                            style={{ width: '100%', margin: '8px 0', padding: 8 }}
                        />
                        <textarea
                            placeholder="通知内容"
                            value={globalNoticeForm.content}
                            onChange={e => setGlobalNoticeForm({ ...globalNoticeForm, content: e.target.value })}
                            rows={4}
                            style={{ width: '100%', marginBottom: 12, padding: 8 }}
                        />
                        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                            <button onClick={() => setShowGlobalNotice(false)}>取消</button>
                            <button onClick={sendGlobalNotice}>发送公告</button>
                        </div>
                    </div>
                </div>
            )}

            <main style={{ display: 'flex', gap: '1rem', marginTop: 16 }}>
                <aside style={{ width: '240px' }}>
                    <h2>我的小组</h2>
                    {/* 管理员创建小组按钮 */}
                    {user.role === 'admin' && (
                        <>
                            <button
                                onClick={() => setShowCreateGroup(true)}
                                style={{ marginBottom: 10, padding: '6px 10px', cursor: 'pointer', width: '100%' }}
                            >
                                + 新建小组
                            </button>
                            {/* 新建小组弹窗 */}
                            {showCreateGroup && (
                                <div style={{ border: '1px solid #ccc', padding: 12, marginBottom: 10 }}>
                                    <h4>创建新小组</h4>
                                    <input
                                        placeholder="请输入小组名称"
                                        value={newGroupForm.name}
                                        onChange={(e) => setNewGroupForm({ ...newGroupForm, name: e.target.value })}
                                        style={{ display: 'block', margin: '6px 0', width: '100%' }}
                                    />
                                    <textarea
                                        placeholder="小组描述（选填）"
                                        value={newGroupForm.description}
                                        onChange={(e) => setNewGroupForm({ ...newGroupForm, description: e.target.value })}
                                        style={{ display: 'block', margin: '6px 0', width: '100%' }}
                                    />
                                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                        <button onClick={submitCreateGroup}>确认创建</button>
                                        <button onClick={() => setShowCreateGroup(false)}>取消</button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    <div className="groups-list">
                        {groups.map(group => (
                            <div
                                key={group.id}
                                className={`group-item ${selectedGroup === group.id ? 'active' : ''}`}
                                onClick={() => handleGroupChange(group.id)}
                                style={{ padding: '8px', border: '1px solid #ccc', marginBottom: 6, cursor: 'pointer' }}
                            >
                                <h3>{group.name}</h3>
                                <p>{group.description || '暂无描述'}</p>
                                <small>组长：{group.leader_name ?? '暂无组长'}</small>

                                {/* 管理员全套操作按钮：编辑、删除、组员管理 */}
                                {user.role === 'admin' && (
                                    <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setEditGroupId(group.id);
                                                setEditGroupForm({ name: group.name, description: group.description || '' });
                                            }}
                                            style={{ fontSize: 12 }}
                                        >
                                            编辑
                                        </button>
                                        <button
                                            onClick={(e) => deleteGroup(group.id, e)}
                                            style={{ fontSize: 12, color: 'red' }}
                                        >
                                            删除
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setMemberPanelId(group.id);
                                            }}
                                            style={{ fontSize: 12 }}
                                        >
                                            组员管理
                                        </button>
                                    </div>
                                )}

                                {/* 组员管理弹窗 */}
                                {memberPanelId === group.id && (
                                    <div onClick={e => e.stopPropagation()} style={{ border: '1px solid #aaa', padding: 10, marginTop: 8 }}>
                                        <h5>组员操作面板</h5>
                                        <p style={{ fontSize: 12, margin: '4px 0' }}>添加成员：</p>
                                        <select
                                            style={{ width: '100%', marginBottom: 6 }}
                                            onChange={ev => {
                                                const uid = ev.target.value;
                                                if (uid) addGroupMember(group.id, uid);
                                            }}
                                        >
                                            <option value="">选择用户加入小组</option>
                                            {allUserList.map(u => (
                                                <option key={u.id} value={u.id}>{u.username}</option>
                                            ))}
                                        </select>
                                        <p style={{ fontSize: 12, margin: '4px 0' }}>更换本组组长：</p>
                                        <select
                                            style={{ width: '100%', marginBottom: 8 }}
                                            onChange={ev => {
                                                const uid = ev.target.value;
                                                if (uid) changeGroupLeader(group.id, uid);
                                            }}
                                        >
                                            <option value="">选择用户设为组长</option>
                                            {allUserList.map(u => (
                                                <option key={u.id} value={u.id}>{u.username}</option>
                                            ))}
                                        </select>
                                        <button onClick={() => setMemberPanelId(null)} style={{ width: '100%' }}>关闭</button>
                                    </div>
                                )}

                                {/* 编辑小组弹窗 */}
                                {editGroupId === group.id && (
                                    <div onClick={e => e.stopPropagation()} style={{ border: '1px solid #aaa', padding: 8, marginTop: 6 }}>
                                        <input
                                            value={editGroupForm.name}
                                            onChange={(e) => setEditGroupForm({ ...editGroupForm, name: e.target.value })}
                                            style={{ width: '100%', marginBottom: 4 }}
                                        />
                                        <textarea
                                            value={editGroupForm.description}
                                            onChange={(e) => setEditGroupForm({ ...editGroupForm, description: e.target.value })}
                                            style={{ width: '100%', marginBottom: 4 }}
                                        />
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <button onClick={() => saveEditGroup(group.id)}>保存修改</button>
                                            <button onClick={() => setEditGroupId(null)}>取消</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </aside>

                <section className="main-content" style={{ flex: 1 }}>
                    {selectedGroup ? (
                        <GroupView groupId={selectedGroup} authFetch={authFetch} userRole={user.role} />
                    ) : (
                        <div>请选择左侧小组查看任务详情</div>
                    )}
                </section>

                <aside className="notifications-panel" style={{ width: '280px' }}>
                    <h2>消息通知</h2>
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
                                        发送人：{notification.sender_name}
                                        {!notification.group_id && <span style={{ color: '#f44336' }}>【全站公告】</span>}
                                        <br />
                                        {new Date(notification.created_at).toLocaleString()}
                                    </small>
                                </div>
                            ))
                        ) : (
                            <p>暂无通知消息</p>
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
    userRole: string;
}

const GroupView: React.FC<GroupViewProps> = ({ groupId, authFetch, userRole }) => {
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
                alert('创建任务失败，仅小组组长可发布任务');
            }
        } catch (err) {
            alert('网络异常，创建任务失败');
        }
    };

    if (loading) return <div>正在加载任务...</div>;

    return (
        <div className="group-view">
            <h2>任务列表</h2>
            {/* 仅组长展示新建任务表单，管理员/普通成员隐藏 */}
            {userRole === 'leader' ? (
                <form onSubmit={handleCreateTask} className="create-task-form" style={{ marginBottom: '1rem', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <h3>新建任务</h3>
                    <input
                        type="text"
                        placeholder="任务标题"
                        value={newTask.title}
                        onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                        required
                    />
                    <textarea
                        placeholder="任务描述（选填）"
                        value={newTask.description}
                        onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                    />
                    <select
                        value={newTask.assignedTo}
                        onChange={(e) => setNewTask({ ...newTask, assignedTo: e.target.value })}
                    >
                        <option value="">未分配成员</option>
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
                        <option value="low">低优先级</option>
                        <option value="medium">中优先级</option>
                        <option value="high">高优先级</option>
                    </select>
                    <button type="submit">提交创建任务</button>
                </form>
            ) : userRole === 'admin' ? (
                <p style={{ color: '#666' }}>提示：管理员无任务发布权限，请将组员设置为本组组长后发布任务</p>
            ) : null}

            <div className="tasks-board" style={{ display: 'flex', gap: '0.8rem', overflowX: 'auto' }}>
                <div className="task-column" style={{ minWidth: 220, border: '1px solid #eee', padding: 8 }}>
                    <h3>待处理</h3>
                    {tasks.filter(t => t.status === 'todo').map(task => (
                        <TaskCard key={task.id} task={task} />
                    ))}
                </div>
                <div className="task-column" style={{ minWidth: 220, border: '1px solid #eee', padding: 8 }}>
                    <h3>进行中</h3>
                    {tasks.filter(t => t.status === 'in-progress').map(task => (
                        <TaskCard key={task.id} task={task} />
                    ))}
                </div>
                <div className="task-column" style={{ minWidth: 220, border: '1px solid #eee', padding: 8 }}>
                    <h3>待审核</h3>
                    {tasks.filter(t => t.status === 'review').map(task => (
                        <TaskCard key={task.id} task={task} />
                    ))}
                </div>
                <div className="task-column" style={{ minWidth: 220, border: '1px solid #eee', padding: 8 }}>
                    <h3>已完成</h3>
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
                <span className={`priority ${task.priority}`}>
                    {task.priority === 'low' ? '低' : task.priority === 'medium' ? '中' : '高'}优先级
                </span>
            </div>
            {showDetails && (
                <div className="task-details" style={{ marginTop: 6, fontSize: 14 }}>
                    <p><strong>任务描述：</strong>{task.description || '无'}</p>
                    <p><strong>负责人：</strong>{task.assignee_name || '未分配'}</p>
                    <p><strong>创建人：</strong>{task.creator_name}</p>
                    <p>
                        <strong>当前状态：</strong>
                        {task.status === 'todo' ? '待处理'
                            : task.status === 'in-progress' ? '进行中'
                                : task.status === 'review' ? '待审核' : '已完成'}
                    </p>
                    {task.due_date && <p><strong>截止日期：</strong>{new Date(task.due_date).toLocaleDateString()}</p>}
                </div>
            )}
        </div>
    );
};

export const dynamic = "force-dynamic";
export default Dashboard;