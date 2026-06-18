import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Group, Task, Notification, User } from '../types';
import { useRouter } from 'next/router';

const Dashboard: React.FC = () => {
    const [groups, setGroups] = useState<Group[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [allUserList, setAllUserList] = useState<User[]>([]);
    const [currentGroupMembers, setCurrentGroupMembers] = useState<User[]>([]);
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

    // 登录后加载数据 + 选中小组时加载本组成员
    useEffect(() => {
        if (user) {
            fetchData();
            if (user.role === 'admin') fetchAllUsers();
        }
    }, [user]);

    useEffect(() => {
        if (selectedGroup) {
            fetchCurrentGroupMember(selectedGroup);
        } else {
            setCurrentGroupMembers([]);
        }
    }, [selectedGroup]);

    if (!user) return <div>加载中...</div>;

    // 获取全部系统用户（管理员添加新成员用）
    const fetchAllUsers = async () => {
        const res = await authFetch('/api/users');
        if (res.ok) setAllUserList(await res.json());
    };

    // 获取当前选中小组内部成员
    const fetchCurrentGroupMember = async (gid: string) => {
        const res = await authFetch(`/api/group-members?groupId=${gid}`);
        if (res.ok) setCurrentGroupMembers(await res.json());
    };

    // 加载小组、通知基础数据
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

    // 创建小组
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

    // 添加组员（全用户下拉，可拉外部人）
    const addGroupMember = async (groupId: string, uid: string) => {
        await authFetch('/api/group/add-member', {
            method: 'POST',
            body: JSON.stringify({ groupId, userId: uid })
        });
        alert('添加组员成功');
        fetchCurrentGroupMember(groupId);
    };

    // 修改组长：仅允许选择本组内成员
    const changeGroupLeader = async (groupId: string, uid: string) => {
        try {
            const res = await authFetch('/api/group/set-leader', {
                method: 'PUT',
                body: JSON.stringify({ groupId, newLeaderId: uid })
            });
            const json = await res.json();
            if (!json.success) {
                alert(json.msg || '更换组长失败');
                return;
            }
            // 等待小组列表刷新（更新页面组长文字）
            await fetchData();
            // 再刷新当前组员下拉
            await fetchCurrentGroupMember(groupId);
            alert('组长更换完成');
        } catch (err) {
            console.error('更换组长报错：', err);
            alert('网络异常，更换失败');
        }
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
                <div className="user-info" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <span>欢迎你，{user.username}（{user.role === 'admin' ? '管理员' : user.role === 'leader' ? '组长' : '普通成员'}）</span>
                    {user.role === 'admin' && (
                        <button style={{ padding: '6px 10px', cursor: 'pointer' }} onClick={() => setShowGlobalNotice(true)}>群发全站通知</button>
                    )}
                    <button style={{ padding: '6px 10px', cursor: 'pointer' }} onClick={logout}>退出登录</button>
                </div>
            </header>

            {/* 全站公告弹窗 优化宽高排版 */}
            {showGlobalNotice && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
                    <div style={{ background: '#fff', padding: '24px', width: '460px', borderRadius: '8px' }}>
                        <h3 style={{ marginBottom: '16px' }}>发布全站公告</h3>
                        <input
                            placeholder="通知标题"
                            value={globalNoticeForm.title}
                            onChange={e => setGlobalNoticeForm({ ...globalNoticeForm, title: e.target.value })}
                            style={{ width: '100%', margin: '8px 0', padding: '10px', border: '1px #ddd solid', borderRadius: '4px' }}
                        />
                        <textarea
                            placeholder="通知内容"
                            value={globalNoticeForm.content}
                            onChange={e => setGlobalNoticeForm({ ...globalNoticeForm, content: e.target.value })}
                            rows={5}
                            style={{ width: '100%', marginBottom: '16px', padding: '10px', border: '1px #ddd solid', borderRadius: '4px' }}
                        />
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button style={{ padding: '8px 16px' }} onClick={() => setShowGlobalNotice(false)}>取消</button>
                            <button style={{ padding: '8px 16px', background: '#0070f3', color: '#fff', border: 0, borderRadius: '4px' }} onClick={sendGlobalNotice}>发送公告</button>
                        </div>
                    </div>
                </div>
            )}

            <main style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
                <aside style={{ width: '240px' }}>
                    <h2 style={{ marginBottom: '12px' }}>我的小组</h2>
                    {/* 管理员创建小组按钮 */}
                    {user.role === 'admin' && (
                        <>
                            <button
                                onClick={() => setShowCreateGroup(true)}
                                style={{ marginBottom: '12px', padding: '8px 10px', cursor: 'pointer', width: '100%' }}
                            >
                                + 新建小组
                            </button>
                            {/* 新建小组弹窗 */}
                            {showCreateGroup && (
                                <div style={{ border: '1px #ccc solid', padding: '16px', marginBottom: '12px', borderRadius: '6px' }}>
                                    <h4 style={{ marginBottom: '12px' }}>创建新小组</h4>
                                    <input
                                        placeholder="请输入小组名称"
                                        value={newGroupForm.name}
                                        onChange={(e) => setNewGroupForm({ ...newGroupForm, name: e.target.value })}
                                        style={{ display: 'block', margin: '8px 0', width: '100%', padding: '8px' }}
                                    />
                                    <textarea
                                        placeholder="小组描述（选填）"
                                        value={newGroupForm.description}
                                        onChange={(e) => setNewGroupForm({ ...newGroupForm, description: e.target.value })}
                                        style={{ display: 'block', margin: '8px 0', width: '100%', padding: '8px' }}
                                    />
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
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
                                style={{ padding: '12px', border: '1px #ccc solid', marginBottom: '8px', cursor: 'pointer', borderRadius: '6px' }}
                            >
                                <h3 style={{ marginBottom: '6px' }}>{group.name}</h3>
                                <p style={{ fontSize: '13px', marginBottom: '6px' }}>{group.description || '暂无描述'}</p>
                                <small>组长：{group.leader_name ?? '暂无组长'}</small>

                                {/* 管理员操作按钮 */}
                                {user.role === 'admin' && (
                                    <div style={{ marginTop: '10px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setEditGroupId(group.id);
                                                setEditGroupForm({ name: group.name, description: group.description || '' });
                                            }}
                                            style={{ fontSize: '12px', padding: '4px 6px' }}
                                        >
                                            编辑
                                        </button>
                                        <button
                                            onClick={(e) => deleteGroup(group.id, e)}
                                            style={{ fontSize: '12px', padding: '4px 6px', color: '#fff', background: '#e74c3c', border: 0, borderRadius: '3px' }}
                                        >
                                            删除
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setMemberPanelId(group.id);
                                            }}
                                            style={{ fontSize: '12px', padding: '4px 6px', background: '#2ecc71', color: '#fff', border: 0, borderRadius: '3px' }}
                                        >
                                            组员管理
                                        </button>
                                    </div>
                                )}

                                {/* 组员管理弹窗 */}
                                {memberPanelId === group.id && (
                                    <div onClick={e => e.stopPropagation()} style={{ border: '1px #aaa solid', padding: '14px', marginTop: '10px', borderRadius: '6px' }}>
                                        <h5 style={{ marginBottom: '10px' }}>组员操作面板</h5>
                                        <p style={{ fontSize: '12px', margin: '4px 0' }}>添加新成员（全体用户）：</p>
                                        <select
                                            style={{ width: '100%', marginBottom: '12px', padding: '6px' }}
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

                                        <p style={{ fontSize: '12px', margin: '4px 0' }}>更换组长（仅本组成员）：</p>
                                        <select
                                            style={{ width: '100%', marginBottom: '12px', padding: '6px' }}
                                            onChange={ev => {
                                                const uid = ev.target.value;
                                                if (uid) changeGroupLeader(group.id, uid);
                                            }}
                                        >
                                            <option value="">选择本组成员设为组长</option>
                                            {currentGroupMembers.map(u => (
                                                <option key={u.id} value={u.id}>{u.username}</option>
                                            ))}
                                        </select>
                                        <button style={{ width: '100%', padding: '6px' }} onClick={() => setMemberPanelId(null)}>关闭</button>
                                    </div>
                                )}

                                {/* 编辑小组弹窗 */}
                                {editGroupId === group.id && (
                                    <div onClick={e => e.stopPropagation()} style={{ border: '1px #aaa solid', padding: '14px', marginTop: '10px', borderRadius: '6px' }}>
                                        <input
                                            value={editGroupForm.name}
                                            onChange={(e) => setEditGroupForm({ ...editGroupForm, name: e.target.value })}
                                            style={{ width: '100%', marginBottom: '8px', padding: '8px' }}
                                        />
                                        <textarea
                                            value={editGroupForm.description}
                                            onChange={(e) => setEditGroupForm({ ...editGroupForm, description: e.target.value })}
                                            style={{ width: '100%', marginBottom: '12px', padding: '8px' }}
                                        />
                                        <div style={{ display: 'flex', gap: '8px' }}>
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
                    <h2 style={{ marginBottom: '12px' }}>消息通知</h2>
                    <div className="notifications-list">
                        {notifications.length > 0 ? (
                            notifications.map(notification => (
                                <div
                                    key={notification.id}
                                    className={`notification ${notification.is_read ? '' : 'unread'}`}
                                    style={{ padding: '12px', borderBottom: '1px #eee solid', marginBottom: '8px' }}
                                >
                                    <h4 style={{ marginBottom: '6px' }}>{notification.title}</h4>
                                    <p style={{ fontSize: '13px', marginBottom: '6px' }}>{notification.content}</p>
                                    <small style={{ fontSize: '12px' }}>
                                        发送人：{notification.sender_name}
                                        {!notification.group_id && <span style={{ color: '#e74c3c', fontWeight: 'bold' }}>【全站公告】</span>}
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
            <h2 style={{ marginBottom: '16px' }}>任务列表</h2>
            {/* 仅组长展示新建任务表单 */}
            {userRole === 'leader' ? (
                <form onSubmit={handleCreateTask} className="create-task-form" style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <h3>新建任务</h3>
                    <input
                        type="text"
                        placeholder="任务标题"
                        value={newTask.title}
                        onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                        required
                        style={{ padding: '8px' }}
                    />
                    <textarea
                        placeholder="任务描述（选填）"
                        value={newTask.description}
                        onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                        style={{ padding: '8px' }}
                    />
                    <select
                        value={newTask.assignedTo}
                        onChange={(e) => setNewTask({ ...newTask, assignedTo: e.target.value })}
                        style={{ padding: '8px' }}
                    >
                        <option value="">未分配成员</option>
                    </select>
                    <input
                        type="date"
                        value={newTask.dueDate}
                        onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                        style={{ padding: '8px' }}
                    />
                    <select
                        value={newTask.priority}
                        onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                        style={{ padding: '8px' }}
                    >
                        <option value="low">低优先级</option>
                        <option value="medium">中优先级</option>
                        <option value="high">高优先级</option>
                    </select>
                    <button type="submit" style={{ padding: '10px', background: '#0070f3', color: '#fff', border: 0, borderRadius: '4px' }}>提交创建任务</button>
                </form>
            ) : userRole === 'admin' ? (
                <p style={{ color: '#666', marginBottom: '16px' }}>提示：管理员无任务发布权限，请将组员设置为本组组长后发布任务</p>
            ) : null}

            <div className="tasks-board" style={{ display: 'flex', gap: '16px', overflowX: 'auto', paddingBottom: '10px' }}>
                <div className="task-column" style={{ minWidth: '250px' }}>
                    <h3>待处理</h3>
                    {tasks.filter(t => t.status === 'todo').map(task => (
                        <TaskCard key={task.id} task={task} />
                    ))}
                </div>
                <div className="task-column" style={{ minWidth: '250px' }}>
                    <h3>进行中</h3>
                    {tasks.filter(t => t.status === 'in-progress').map(task => (
                        <TaskCard key={task.id} task={task} />
                    ))}
                </div>
                <div className="task-column" style={{ minWidth: '250px' }}>
                    <h3>待审核</h3>
                    {tasks.filter(t => t.status === 'review').map(task => (
                        <TaskCard key={task.id} task={task} />
                    ))}
                </div>
                <div className="task-column" style={{ minWidth: '250px' }}>
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
        <div className={`task-card priority-${task.priority}`} style={{ border: '1px #ddd solid', padding: '12px', marginBottom: '10px', borderRadius: '6px' }}>
            <div onClick={() => setShowDetails(!showDetails)} style={{ cursor: 'pointer' }}>
                <h4 style={{ marginBottom: '6px' }}>{task.title}</h4>
                <span style={{ fontSize: '12px' }}>
                    {task.priority === 'low' ? '低' : task.priority === 'medium' ? '中' : '高'}优先级
                </span>
            </div>
            {showDetails && (
                <div style={{ marginTop: '10px', fontSize: '14px' }}>
                    <p><strong>任务描述：</strong>{task.description || '无'}</p>
                    <p><strong>负责人：</strong>{task.assignee_name || '未分配'}</p>
                    <p><strong>创建人：</strong>{task.creator_name}</p>
                    <p>
                        <strong>当前状态：</strong>
                        {task.status === 'todo' ? '待处理'
                            : task.status === 'in-progress' ? '进行中'
                                : task.status === 'review' ? '待审核' : '已完成'}
                    </p>
                    {task.due_date && <p><strong>截止日期：</strong>{task.due_date}</p>}
                </div>
            )}
        </div>
    );
};

export const dynamic = "force-dynamic";
export default Dashboard;