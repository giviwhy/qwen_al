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

    // Toast 提示状态
    const [toast, setToast] = useState<{ show: boolean; msg: string; type: 'success' | 'error' }>({
        show: false,
        msg: '',
        type: 'success',
    });

    // 小组弹窗状态
    const [showCreateGroup, setShowCreateGroup] = useState(false);
    const [newGroupForm, setNewGroupForm] = useState({ name: '', description: '' });
    const [editGroupId, setEditGroupId] = useState<string | null>(null);
    const [editGroupForm, setEditGroupForm] = useState({ name: '', description: '' });
    const [memberPanelId, setMemberPanelId] = useState<string | null>(null);

    // 管理员全局通知弹窗
    const [showGlobalNotice, setShowGlobalNotice] = useState(false);
    const [globalNoticeForm, setGlobalNoticeForm] = useState({ title: '', content: '' });

    // 切换选中小组函数
    const handleGroupChange = (gid: string) => {
        setSelectedGroup(gid);
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
            if (user.role === 'admin') fetchAllUsers();
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

    // 获取全部系统用户（管理员添加新成员用）
    const fetchAllUsers = async () => {
        const res = await authFetch('/api/users');
        if (res.ok) {
            const json = await res.json();
            setAllUserList(json.data || []);
        }
    };

    // 获取当前选中小组内部成员
    const fetchCurrentGroupMember = async (gid: string) => {
        const res = await authFetch(`/api/group-members?groupId=${gid}`);
        if (res.ok) {
            const json = await res.json();
            setCurrentGroupMembers(json.data || []);
        }
    };

    // 加载小组、通知基础数据【核心修复：只取接口返回的data数组】
    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. 获取小组列表
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

            // 2. 获取通知列表
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

    // 创建小组
    const submitCreateGroup = async () => {
        const res = await authFetch('/api/create-group', {
            method: 'POST',
            body: JSON.stringify(newGroupForm),
        });
        if (res.ok) {
            fetchData();
            setShowCreateGroup(false);
            setNewGroupForm({ name: '', description: '' });
            showToast('小组创建成功');
        } else {
            showToast('创建失败，请重试', 'error');
        }
    };

    // 保存编辑小组
    const saveEditGroup = async (gid: string) => {
        const res = await authFetch(`/api/group/${gid}`, {
            method: 'PUT',
            body: JSON.stringify(editGroupForm),
        });
        if (res.ok) {
            fetchData();
            setEditGroupId(null);
            showToast('小组信息已更新');
        } else {
            showToast('更新失败', 'error');
        }
    };

    // 删除小组
    const deleteGroup = async (gid: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('确定删除该小组？小组下所有任务、通知会同步清空')) return;

        const res = await authFetch(`/api/group/${gid}`, { method: 'DELETE' });
        if (res.ok) {
            if (selectedGroup === gid) {
                setSelectedGroup(null);
            }
            fetchData();
            showToast('小组已删除');
        } else {
            showToast('删除失败', 'error');
        }
    };

    // 添加组员
    const addGroupMember = async (groupId: string, uid: string) => {
        const res = await authFetch('/api/group/add-member', {
            method: 'POST',
            body: JSON.stringify({ groupId, userId: uid }),
        });

        if (res.ok) {
            await fetchCurrentGroupMember(groupId);
            await fetchAllUsers();
            showToast('添加组员成功');
        } else {
            showToast('添加失败，该用户可能已在小组内', 'error');
        }
    };

    // 修改组长
    const changeGroupLeader = async (groupId: string, uid: string) => {
        try {
            const res = await authFetch('/api/group/set-leader', {
                method: 'PUT',
                body: JSON.stringify({ groupId, newLeaderId: uid }),
            });
            const json = await res.json();
            if (!json.success) {
                showToast(json.msg || '更换组长失败', 'error');
                return;
            }
            await fetchData();
            await fetchCurrentGroupMember(groupId);
            showToast('组长更换完成');
        } catch (err) {
            console.error('更换组长报错：', err);
            showToast('网络异常', 'error');
        }
    };

    // 管理员发送全站通知
    const sendGlobalNotice = async () => {
        const res = await authFetch('/api/admin/send-all-notice', {
            method: 'POST',
            body: JSON.stringify(globalNoticeForm),
        });
        if (res.ok) {
            setShowGlobalNotice(false);
            setGlobalNoticeForm({ title: '', content: '' });
            fetchData();
            showToast('全站通知发送成功');
        } else {
            showToast('发送失败', 'error');
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
                        transition: 'opacity 0.3s',
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
                    {user?.role === 'admin' && (
                        <button style={{ padding: '6px 10px', cursor: 'pointer' }} onClick={() => setShowGlobalNotice(true)}>
                            群发全站通知
                        </button>
                    )}
                    <button style={{ padding: '6px 10px', cursor: 'pointer' }} onClick={logout}>
                        退出登录
                    </button>
                </div>
            </header>

            {/* 全站公告弹窗 */}
            {showGlobalNotice && (
                <div
                    style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 999,
                    }}
                >
                    <div style={{ background: '#fff', padding: '24px', width: '460px', borderRadius: '8px' }}>
                        <h3 style={{ marginBottom: '16px' }}>发布全站公告</h3>
                        <input
                            placeholder="通知标题"
                            value={globalNoticeForm.title}
                            onChange={(e) => setGlobalNoticeForm({ ...globalNoticeForm, title: e.target.value })}
                            style={{
                                width: '100%',
                                margin: '8px 0',
                                padding: '10px',
                                border: '1px #ddd solid',
                                borderRadius: '4px',
                            }}
                        />
                        <textarea
                            placeholder="通知内容"
                            value={globalNoticeForm.content}
                            onChange={(e) => setGlobalNoticeForm({ ...globalNoticeForm, content: e.target.value })}
                            rows={5}
                            style={{
                                width: '100%',
                                marginBottom: '16px',
                                padding: '10px',
                                border: '1px #ddd solid',
                                borderRadius: '4px',
                            }}
                        />
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                            <button style={{ padding: '8px 16px' }} onClick={() => setShowGlobalNotice(false)}>
                                取消
                            </button>
                            <button
                                style={{
                                    padding: '8px 16px',
                                    background: '#0070f3',
                                    color: '#fff',
                                    border: 0,
                                    borderRadius: '4px',
                                }}
                                onClick={sendGlobalNotice}
                            >
                                发送公告
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <main style={{ display: 'flex', gap: '16px', marginTop: '16px' }}>
                <aside style={{ width: '240px' }}>
                    <h2 style={{ marginBottom: '12px' }}>我的小组</h2>
                    {/* 管理员创建小组按钮 */}
                    {user?.role === 'admin' && (
                        <>
                            <button
                                onClick={() => setShowCreateGroup(true)}
                                style={{ marginBottom: '12px', padding: '8px 10px', cursor: 'pointer', width: '100%' }}
                            >
                                + 新建小组
                            </button>
                            {/* 新建小组弹窗 */}
                            {showCreateGroup && (
                                <div
                                    style={{
                                        border: '1px #ccc solid',
                                        padding: '16px',
                                        marginBottom: '12px',
                                        borderRadius: '6px',
                                    }}
                                >
                                    <h4 style={{ marginBottom: '12px' }}>创建新小组</h4>
                                    <input
                                        placeholder="请输入小组名称"
                                        value={newGroupForm.name}
                                        onChange={(e) =>
                                            setNewGroupForm({ ...newGroupForm, name: e.target.value })
                                        }
                                        style={{ display: 'block', margin: '8px 0', width: '100%', padding: '8px' }}
                                    />
                                    <textarea
                                        placeholder="小组描述（选填）"
                                        value={newGroupForm.description}
                                        onChange={(e) =>
                                            setNewGroupForm({ ...newGroupForm, description: e.target.value })
                                        }
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

                                {/* 管理员操作按钮 */}
                                {user?.role === 'admin' && (
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
                                            style={{
                                                fontSize: '12px',
                                                padding: '4px 6px',
                                                color: '#fff',
                                                background: '#e74c3c',
                                                border: 0,
                                                borderRadius: '3px',
                                            }}
                                        >
                                            删除
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setMemberPanelId(group.id);
                                            }}
                                            style={{
                                                fontSize: '12px',
                                                padding: '4px 6px',
                                                background: '#2ecc71',
                                                color: '#fff',
                                                border: 0,
                                                borderRadius: '3px',
                                            }}
                                        >
                                            组员管理
                                        </button>
                                    </div>
                                )}

                                {/* 组员管理弹窗 */}
                                {memberPanelId === group.id && (
                                    <div
                                        onClick={(e) => e.stopPropagation()}
                                        style={{
                                            border: '1px #aaa solid',
                                            padding: '14px',
                                            marginTop: '10px',
                                            borderRadius: '6px',
                                        }}
                                    >
                                        <h5 style={{ marginBottom: '10px' }}>组员操作面板</h5>
                                        <p style={{ fontSize: '12px', margin: '4px 0' }}>添加新成员（全体用户）：</p>
                                        <select
                                            style={{ width: '100%', marginBottom: '12px', padding: '6px' }}
                                            onChange={(ev) => {
                                                const uid = ev.target.value;
                                                if (uid) addGroupMember(group.id, uid);
                                            }}
                                        >
                                            <option value="">选择用户加入小组</option>
                                            {allUserList?.map((u) => (
                                                <option key={u.id} value={u.id}>
                                                    {u.username}
                                                </option>
                                            ))}
                                        </select>

                                        <p style={{ fontSize: '12px', margin: '4px 0' }}>更换组长（仅本组成员）：</p>
                                        <select
                                            style={{ width: '100%', marginBottom: '12px', padding: '6px' }}
                                            onChange={(ev) => {
                                                const uid = ev.target.value;
                                                if (uid) changeGroupLeader(group.id, uid);
                                            }}
                                        >
                                            <option value="">选择本组成员设为组长</option>
                                            {currentGroupMembers?.map((u) => (
                                                <option key={u.id} value={u.id}>
                                                    {u.username}
                                                </option>
                                            ))}
                                        </select>
                                        <button style={{ width: '100%', padding: '6px' }} onClick={() => setMemberPanelId(null)}>
                                            关闭
                                        </button>
                                    </div>
                                )}

                                {/* 编辑小组弹窗 */}
                                {editGroupId === group.id && (
                                    <div
                                        onClick={(e) => e.stopPropagation()}
                                        style={{
                                            border: '1px #aaa solid',
                                            padding: '14px',
                                            marginTop: '10px',
                                            borderRadius: '6px',
                                        }}
                                    >
                                        <input
                                            value={editGroupForm.name}
                                            onChange={(e) =>
                                                setEditGroupForm({ ...editGroupForm, name: e.target.value })
                                            }
                                            style={{ width: '100%', marginBottom: '8px', padding: '8px' }}
                                        />
                                        <textarea
                                            value={editGroupForm.description}
                                            onChange={(e) =>
                                                setEditGroupForm({ ...editGroupForm, description: e.target.value })
                                            }
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
                    <h2 style={{ marginBottom: '12px' }}>消息通知</h2>
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

// GroupView 子组件
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

            {/* 组长/管理员才可见新建任务面板 */}
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