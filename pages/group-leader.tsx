import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/router';

type GroupItem = {
    id: string;
    name: string;
    description: string;
    leader_name: string;
};

type MemberItem = {
    id: string;
    username: string;
    is_leader: boolean;
};

type TaskItem = {
    id: string;
    title: string;
    description: string | null;
    assignee_name: string;
    creator_name: string;
    assigned_to: string;
    status: string;
    priority: string;
    due_date: string | null;
    created_at: string;
};

export default function GroupLeaderPage() {
    const { user, logout } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(true); // 全局加载锁
    const [myGroups, setMyGroups] = useState<GroupItem[]>([]);
    const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
    const [members, setMembers] = useState<MemberItem[]>([]);
    const [taskList, setTaskList] = useState<TaskItem[]>([]);

    // 发布任务表单
    const [taskTitle, setTaskTitle] = useState('');
    const [taskDesc, setTaskDesc] = useState('');
    const [assignUserId, setAssignUserId] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');

    // 编辑弹窗
    const [editOpen, setEditOpen] = useState(false);
    const [editTask, setEditTask] = useState<TaskItem | null>(null);

    // 第一步：鉴权+等待用户加载完成
    useEffect(() => {
        const checkAuth = async () => {
            setLoading(true);
            if (!user) {
                router.push('/login');
                setLoading(false);
                return;
            }
            if (user.role === 'admin') {
                router.push('/admin');
                setLoading(false);
                return;
            }
            setLoading(false);
        };
        checkAuth();
    }, [user, router]);

    // 加载当前用户作为组长的所有小组（仅登录成功后执行）
    useEffect(() => {
        if (loading || !user || user.role === 'admin') return;
        const fetchLeaderGroups = async () => {
            const token = localStorage.getItem('token');
            if (!token) {
                router.push('/login');
                return;
            }
            try {
                const res = await fetch(`/api/user-leader-groups`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const data = await res.json();
                if (data.success) setMyGroups(data.data);
            } catch (err) {
                console.error('加载小组失败', err);
                alert('小组列表加载失败，请刷新页面');
            }
        };
        fetchLeaderGroups();
    }, [user, loading]);

    // 切换小组：加载组员 + 本组任务，增加失败弹窗提示
    useEffect(() => {
        if (!activeGroupId || loading || !user) return;
        const token = localStorage.getItem('token');
        if (!token) return;
        const fetchAll = async () => {
            try {
                // 加载组员
                const memRes = await fetch(`/api/group-members?groupId=${activeGroupId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const memData = await memRes.json();
                if (memData.success) {
                    setMembers(memData.data);
                } else {
                    alert(`组员加载失败：${memData.msg}`);
                }

                // 加载本组任务
                const taskRes = await fetch(`/api/group/${activeGroupId}/tasks`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const taskData = await taskRes.json();
                if (taskData.success) {
                    setTaskList(taskData.data);
                } else {
                    alert(`任务加载失败：${taskData.msg}`);
                }
            } catch (err) {
                console.error('加载组员/任务失败', err);
                alert('网络请求异常，请重新选择小组');
            }
        };
        fetchAll();
    }, [activeGroupId, user, loading]);

    // 刷新任务列表公共方法
    const refreshTasks = async () => {
        if (!activeGroupId || loading) return;
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`/api/group/${activeGroupId}/tasks`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) setTaskList(data.data);
        } catch (err) {
            console.error('刷新任务失败', err);
            alert('刷新任务列表失败');
        }
    };

    // 发布新任务
    const handleCreateTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeGroupId || !assignUserId || !taskTitle.trim()) return;
        const token = localStorage.getItem('token');
        try {
            const res = await fetch(`/api/group/${activeGroupId}/tasks`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    groupId: activeGroupId,
                    title: taskTitle,
                    description: taskDesc,
                    assignedTo: assignUserId,
                    dueDate,
                    priority
                })
            });
            const data = await res.json();
            alert(data.msg);
            if (data.success) {
                setTaskTitle('');
                setTaskDesc('');
                setAssignUserId('');
                setDueDate('');
                setPriority('medium');
                refreshTasks();
            }
        } catch (err) {
            alert('发布任务请求失败');
            console.error(err);
        }
    };

    // 打开编辑弹窗，回填数据
    const openEdit = (task: TaskItem) => {
        setEditTask(task);
        setTaskTitle(task.title);
        setTaskDesc(task.description || '');
        setAssignUserId(task.assigned_to);
        setDueDate(task.due_date || '');
        setPriority(task.priority as 'low' | 'medium' | 'high');
        setEditOpen(true);
    };

    // 保存编辑任务
    const handleUpdateTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editTask || !activeGroupId || !assignUserId || !taskTitle.trim()) return;
        const token = localStorage.getItem('token');
        try {
            const res = await fetch('/api/group/task-update', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    taskId: editTask.id,
                    title: taskTitle,
                    description: taskDesc,
                    assignedTo: assignUserId,
                    status: editTask.status,
                    dueDate,
                    priority
                })
            });
            const data = await res.json();
            alert(data.msg);
            if (data.success) {
                setEditOpen(false);
                setEditTask(null);
                refreshTasks();
            }
        } catch (err) {
            alert('修改任务请求失败');
            console.error(err);
        }
    };

    // 删除任务
    const handleDeleteTask = async (tid: string) => {
        if (!window.confirm('确定删除该任务？')) return;
        const token = localStorage.getItem('token');
        try {
            const res = await fetch('/api/group/task-delete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ taskId: tid })
            });
            const data = await res.json();
            alert(data.msg);
            if (data.success) refreshTasks();
        } catch (err) {
            alert('删除任务请求失败');
            console.error(err);
        }
    };

    // 加载中阻断页面渲染
    if (loading || !user || user.role === 'admin') {
        return <div className="p-10 text-center text-lg">页面加载/跳转中...</div>;
    }

    return (
        <div className="max-w-7xl mx-auto p-6">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-2xl font-bold">组长管理后台</h1>
                <div className="flex gap-4">
                    <button onClick={() => router.push('/dashboard')} className="px-4 py-2 bg-gray-200 rounded">返回工作台</button>
                    <button onClick={logout} className="px-4 py-2 bg-red-500 text-white rounded text-white">退出登录</button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 左侧：我的小组 */}
                <div className="border rounded p-4">
                    <h2 className="text-lg font-semibold mb-4">我负责的小组</h2>
                    {myGroups.length === 0 ? (
                        <p className="text-gray-500">暂无管理的小组</p>
                    ) : (
                        myGroups.map(g => (
                            <div
                                key={g.id}
                                onClick={() => setActiveGroupId(g.id)}
                                className={`p-3 mb-2 rounded cursor-pointer ${activeGroupId === g.id ? 'bg-blue-100 border border-blue-400' : 'bg-gray-50'}`}
                            >
                                <div className="font-medium">{g.name}</div>
                                <div className="text-sm text-gray-500">{g.description || '无描述'}</div>
                            </div>
                        ))
                    )}
                </div>

                {/* 中间：组员管理 */}
                <div className="md:col-span-2 border rounded p-4">
                    <h2 className="text-lg font-semibold mb-4">组员管理</h2>
                    {!activeGroupId ? (
                        <p className="text-gray-500">请左侧选择小组查看成员</p>
                    ) : (
                        <div className="space-y-2">
                            {members.map(m => (
                                <div key={m.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                                    <span>{m.username}</span>
                                    {m.is_leader && <span className="text-blue-600 text-sm font-medium">组长</span>}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* 下方：任务发布 + 任务列表，选中小组才显示 */}
            {activeGroupId && (
                <div className="mt-8 border rounded p-4">
                    <h2 className="text-lg font-semibold mb-6">本组任务管理</h2>

                    {/* 新建任务表单（核心发布区域） */}
                    <form onSubmit={handleCreateTask} className="border-b pb-6 mb-8 space-y-4">
                        <h3 className="font-medium text-base">发布新任务</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm mb-1">任务标题 *</label>
                                <input
                                    value={taskTitle}
                                    onChange={e => setTaskTitle(e.target.value)}
                                    className="w-full border px-3 py-2 rounded"
                                    required
                                    placeholder="输入任务标题"
                                />
                            </div>
                            <div>
                                <label className="block text-sm mb-1">优先级</label>
                                <select
                                    value={priority}
                                    onChange={e => setPriority(e.target.value as 'low' | 'medium' | 'high')}
                                    className="w-full border px-3 py-2 rounded"
                                >
                                    <option value="low">低</option>
                                    <option value="medium">中</option>
                                    <option value="high">高</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm mb-1">分配组员 *</label>
                                <select
                                    value={assignUserId}
                                    onChange={e => setAssignUserId(e.target.value)}
                                    className="w-full border px-3 py-2 rounded"
                                    required
                                >
                                    <option value="">请选择组员</option>
                                    {members.length === 0 ? (
                                        <option disabled value="">暂无本组组员，无法发布任务</option>
                                    ) : (
                                        members.map(m => (
                                            <option key={m.id} value={m.id}>
                                                {m.username}{m.is_leader ? ' (组长)' : ''}
                                            </option>
                                        ))
                                    )}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm mb-1">截止日期</label>
                                <input
                                    type="date"
                                    value={dueDate}
                                    onChange={e => setDueDate(e.target.value)}
                                    className="w-full border px-3 py-2 rounded"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm mb-1">任务详情</label>
                            <textarea
                                value={taskDesc}
                                onChange={e => setTaskDesc(e.target.value)}
                                rows={3}
                                className="w-full border px-3 py-2 rounded"
                                placeholder="填写任务要求、交付标准"
                            />
                        </div>
                        {/* 无组员时按钮置灰不可点击 */}
                        <button
                            type="submit"
                            disabled={members.length === 0}
                            className={`px-5 py-2 rounded ${members.length > 0 ? 'bg-green-500 hover:bg-green-600 text-white' : 'bg-gray-300 cursor-not-allowed text-gray-500'}`}
                        >
                            {members.length === 0 ? '暂无组员，无法发布' : '发布任务'}
                        </button>
                    </form>

                    {/* 本组任务列表 */}
                    <h3 className="font-medium text-base mb-4">全部任务</h3>
                    {taskList.length === 0 ? (
                        <p className="text-gray-500">暂无任务，可在上方表单发布新任务</p>
                    ) : (
                        <div className="space-y-4">
                            {taskList.map(t => (
                                <div key={t.id} className="p-4 bg-gray-50 rounded flex flex-col md:flex-row md:justify-between md:items-start gap-3">
                                    <div>
                                        <div className="font-semibold text-lg">{t.title}</div>
                                        <div className="text-sm text-gray-600 my-1">{t.description || '无详情'}</div>
                                        <div className="text-xs text-gray-500 space-x-3">
                                            <span>分配：{t.assignee_name}</span>
                                            <span>状态：{t.status}</span>
                                            <span>优先级：{t.priority}</span>
                                            {t.due_date && <span>截止：{t.due_date}</span>}
                                        </div>
                                    </div>
                                    <div className="flex gap-2 shrink-0">
                                        <button
                                            onClick={() => openEdit(t)}
                                            className="px-3 py-1 bg-blue-400 text-white rounded text-sm"
                                        >编辑</button>
                                        <button
                                            onClick={() => handleDeleteTask(t.id)}
                                            className="px-3 py-1 bg-red-400 text-white rounded text-sm"
                                        >删除</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* 编辑任务弹窗 */}
            {editOpen && editTask && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white w-full max-w-lg rounded-lg p-6">
                        <h3 className="text-xl font-bold mb-4">编辑任务</h3>
                        <form onSubmit={handleUpdateTask} className="space-y-4">
                            <div>
                                <label className="block text-sm mb-1">标题 *</label>
                                <input
                                    value={taskTitle}
                                    onChange={e => setTaskTitle(e.target.value)}
                                    className="w-full border px-3 py-2 rounded"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm mb-1">分配组员</label>
                                <select
                                    value={assignUserId}
                                    onChange={e => setAssignUserId(e.target.value)}
                                    className="w-full border px-3 py-2 rounded"
                                >
                                    {members.map(m => (
                                        <option key={m.id} value={m.id}>
                                            {m.username}{m.is_leader ? ' (组长)' : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm mb-1">优先级</label>
                                    <select
                                        value={priority}
                                        onChange={e => setPriority(e.target.value as 'low' | 'medium' | 'high')}
                                        className="w-full border px-3 py-2 rounded"
                                    >
                                        <option value="low">低</option>
                                        <option value="medium">中</option>
                                        <option value="high">高</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm mb-1">截止日期</label>
                                    <input
                                        type="date"
                                        value={dueDate}
                                        onChange={e => setDueDate(e.target.value)}
                                        className="w-full border px-3 py-2 rounded"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm mb-1">详情</label>
                                <textarea
                                    value={taskDesc}
                                    onChange={e => setTaskDesc(e.target.value)}
                                    rows={3}
                                    className="w-full border px-3 py-2 rounded"
                                />
                            </div>
                            <div className="flex gap-3 justify-end pt-2">
                                <button
                                    type="button"
                                    onClick={() => setEditOpen(false)}
                                    className="px-4 py-2 bg-gray-200 rounded"
                                >取消</button>
                                <button
                                    type="submit"
                                    className="px-4 py-2 bg-blue-500 text-white rounded"
                                >保存修改</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}