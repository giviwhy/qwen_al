import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/router';
import NotifyBell from '../components/NotifyBell';

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
    assignee_id: string;
    status: string;
    priority: string;
    due_date: string | null;
    created_at: string;
    uploaded_files?: string;
    review_status?: string;
    review_comment?: string;
};

export default function GroupLeaderPage() {
    const { user, logout } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [myGroups, setMyGroups] = useState<GroupItem[]>([]);
    const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
    const [members, setMembers] = useState<MemberItem[]>([]);
    const [taskList, setTaskList] = useState<TaskItem[]>([]);

    const [taskTitle, setTaskTitle] = useState('');
    const [taskDesc, setTaskDesc] = useState('');
    const [assignUserId, setAssignUserId] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');

    const [editOpen, setEditOpen] = useState(false);
    const [editTask, setEditTask] = useState<TaskItem | null>(null);

    // 审核相关状态
    const [reviewOpen, setReviewOpen] = useState(false);
    const [reviewTask, setReviewTask] = useState<TaskItem | null>(null);
    const [reviewComment, setReviewComment] = useState('');
    const [reviewFiles, setReviewFiles] = useState<{ name: string; content: string; id: string }[]>([]);

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
                if (!res.ok) throw new Error('小组接口访问失败');
                const data = await res.json();
                if (data.success) setMyGroups(data.data);
                if (data.msg === "未登录") router.push('/login');
            } catch (err) {
                console.error('加载小组失败', err);
                alert('小组列表加载失败，请刷新页面');
            }
        };
        fetchLeaderGroups();
    }, [user, loading, router]);

    useEffect(() => {
        if (!activeGroupId || loading || !user) return;
        const token = localStorage.getItem('token');
        if (!token) {
            router.push('/login');
            return;
        }
        const fetchAll = async () => {
            try {
                const [memRes, taskRes] = await Promise.all([
                    fetch(`/api/group-members?groupId=${activeGroupId}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    }),
                    fetch(`/api/group/${activeGroupId}/tasks`, {
                        headers: { Authorization: `Bearer ${token}` }
                    })
                ]);

                if (!memRes.ok) throw new Error('组员接口访问失败');
                const memData = await memRes.json();
                if (memData.success) {
                    setMembers(memData.data);
                } else {
                    alert(`组员加载失败：${memData.msg}`);
                    if (memData.msg === "未登录") router.push('/login');
                }

                if (!taskRes.ok) throw new Error('任务接口访问失败');
                const taskData = await taskRes.json();
                if (taskData.success) {
                    setTaskList(taskData.data);
                } else {
                    alert(`任务加载失败：${taskData.msg}`);
                    if (taskData.msg === "未登录") router.push('/login');
                }
            } catch (err) {
                console.error('加载组员/任务失败', err);
                alert('网络请求异常，请重新选择小组');
            }
        };
        fetchAll();
    }, [activeGroupId, user, loading, router]);

    // 当选择审核任务时，加载文件
    useEffect(() => {
        if (reviewTask && reviewTask.uploaded_files) {
            try {
                setReviewFiles(JSON.parse(reviewTask.uploaded_files));
            } catch {
                setReviewFiles([]);
            }
        } else {
            setReviewFiles([]);
        }
    }, [reviewTask]);

    const refreshTasks = async () => {
        if (!activeGroupId || loading) return;
        const token = localStorage.getItem('token');
        if (!token) {
            router.push('/login');
            return;
        }
        try {
            const res = await fetch(`/api/group/${activeGroupId}/tasks`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('刷新接口异常');
            const data = await res.json();
            if (data.success) setTaskList(data.data);
            if (data.msg === "未登录") router.push('/login');
        } catch (err) {
            console.error('刷新任务失败', err);
            alert('刷新任务列表失败');
        }
    };

    const handleCreateTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!activeGroupId || !assignUserId || !taskTitle.trim()) return;
        const token = localStorage.getItem('token');
        if (!token) {
            router.push('/login');
            return;
        }
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
            if (!res.ok) throw new Error('发布任务接口异常');
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
            if (data.msg === "未登录") router.push('/login');
        } catch (err) {
            alert('发布任务请求失败');
            console.error(err);
        }
    };

    const openEdit = (task: TaskItem) => {
        setEditTask(task);
        setTaskTitle(task.title);
        setTaskDesc(task.description || '');
        setAssignUserId(task.assignee_id);
        setDueDate(task.due_date || '');
        setPriority(task.priority as 'low' | 'medium' | 'high');
        setEditOpen(true);
    };

    const handleUpdateTask = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editTask || !activeGroupId || !assignUserId || !taskTitle.trim()) return;
        const token = localStorage.getItem('token');
        if (!token) {
            router.push('/login');
            return;
        }
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
            if (!res.ok) throw new Error('编辑接口异常');
            const data = await res.json();
            alert(data.msg);
            if (data.success) {
                setEditOpen(false);
                setEditTask(null);
                refreshTasks();
            }
            if (data.msg === "未登录") router.push('/login');
        } catch (err) {
            alert('修改任务请求失败');
            console.error(err);
        }
    };

    const handleDeleteTask = async (tid: string) => {
        if (!window.confirm('确定删除该任务？')) return;
        const token = localStorage.getItem('token');
        if (!token) {
            router.push('/login');
            return;
        }
        try {
            const res = await fetch('/api/group/task-delete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ taskId: tid })
            });
            if (!res.ok) throw new Error('删除接口异常');
            const data = await res.json();
            alert(data.msg);
            if (data.success) refreshTasks();
            if (data.msg === "未登录") router.push('/login');
        } catch (err) {
            alert('删除任务请求失败');
            console.error(err);
        }
    };

    // 下载文件
    const handleDownloadFile = (fileName: string, fileContent: string) => {
        const link = document.createElement('a');
        link.href = `data:application/octet-stream;base64,${fileContent}`;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    // 打开审核弹窗
    const openReview = (task: TaskItem) => {
        setReviewTask(task);
        setReviewComment('');
        setReviewOpen(true);
    };

    // 审核任务
    const handleReview = async (status: 'approved' | 'rejected') => {
        if (!reviewTask) return;
        const token = localStorage.getItem('token');
        if (!token) {
            router.push('/login');
            return;
        }
        try {
            const res = await fetch('/api/task/review', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    taskId: reviewTask.id,
                    status,
                    comment: reviewComment
                })
            });
            if (!res.ok) throw new Error('审核接口异常');
            const data = await res.json();
            alert(data.msg);
            if (data.success) {
                setReviewOpen(false);
                setReviewTask(null);
                setReviewComment('');
                refreshTasks();
            }
        } catch (err) {
            alert('审核失败');
            console.error(err);
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'high': return 'bg-red-100 text-red-700 border-red-200';
            case 'medium': return 'bg-amber-100 text-amber-700 border-amber-200';
            case 'low': return 'bg-green-100 text-green-700 border-green-200';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    const getPriorityLabel = (priority: string) => {
        switch (priority) {
            case 'high': return '高';
            case 'medium': return '中';
            case 'low': return '低';
            default: return priority;
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'todo': return '待办';
            case 'doing': return '进行中';
            case 'done': return '已完成';
            default: return status;
        }
    };

    // 获取待审核的任务列表
    const pendingReviewTasks = taskList.filter(t => t.status === 'done' && (!t.review_status || t.review_status === 'pending'));

    if (loading || !user || user.role === 'admin') {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-dashboard">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-lg text-gray-600 font-medium">页面加载/跳转中...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-dashboard">
            <header className="bg-gradient-to-r from-slate-800 to-slate-700 shadow-lg">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            </div>
                            <h1 className="text-xl font-bold text-white">组长管理后台</h1>
                        </div>
                        <div className="flex items-center gap-3">
                            <NotifyBell />
                            <button
                                onClick={() => router.push('/dashboard')}
                                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all duration-200 text-sm font-medium"
                            >
                                返回工作台
                            </button>
                            <button
                                onClick={logout}
                                className="px-4 py-2 bg-red-500/80 hover:bg-red-500 text-white rounded-lg transition-all duration-200 text-sm font-medium"
                            >
                                退出登录
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="bg-white rounded-2xl shadow-lg p-6">
                        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                            <svg className="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                            我负责的小组
                        </h2>
                        {myGroups.length === 0 ? (
                            <div className="text-center py-8 text-gray-500">
                                <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <p>暂无管理的小组</p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {myGroups.map(g => (
                                    <div
                                        key={g.id}
                                        onClick={() => setActiveGroupId(g.id)}
                                        className={`p-4 rounded-xl cursor-pointer transition-all duration-200 ${activeGroupId === g.id
                                                ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/30'
                                                : 'bg-gray-50 hover:bg-gray-100'
                                            }`}
                                    >
                                        <div className="font-semibold">{g.name}</div>
                                        <div className={`text-sm ${activeGroupId === g.id ? 'text-white/80' : 'text-gray-500'}`}>
                                            {g.description || '无描述'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="lg:col-span-2 space-y-6">
                        {/* 审核任务区域 */}
                        {activeGroupId && pendingReviewTasks.length > 0 && (
                            <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl shadow-lg p-6 border border-amber-200">
                                <h2 className="text-lg font-semibold text-amber-800 mb-4 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    待审核任务 ({pendingReviewTasks.length})
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {pendingReviewTasks.map(task => {
                                        const hasFiles = task.uploaded_files && JSON.parse(task.uploaded_files).length > 0;
                                        return (
                                            <div key={task.id} className="bg-white p-4 rounded-xl border border-amber-200 hover:shadow-md transition-all">
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="flex-1">
                                                        <h4 className="font-semibold text-gray-800 mb-2">{task.title}</h4>
                                                        <div className="flex items-center gap-3 text-sm text-gray-500">
                                                            <span>执行者: {task.assignee_name}</span>
                                                            {hasFiles && (
                                                                <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                                                                    已上传文件
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => openReview(task)}
                                                        className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-all"
                                                    >
                                                        审核
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        <div className="bg-white rounded-2xl shadow-lg p-6">
                            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                                <svg className="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                组员管理
                            </h2>
                            {!activeGroupId ? (
                                <div className="text-center py-8 text-gray-500">
                                    <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                                    </svg>
                                    <p>请左侧选择小组查看成员</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {members.map(m => (
                                        <div key={m.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
                                                    <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                    </svg>
                                                </div>
                                                <span className="font-medium text-gray-700">{m.username}</span>
                                            </div>
                                            {m.is_leader && (
                                                <span className="px-3 py-1 bg-primary-100 text-primary-700 text-xs font-medium rounded-full">
                                                    组长
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {activeGroupId && (
                            <div className="bg-white rounded-2xl shadow-lg p-6">
                                <h2 className="text-lg font-semibold text-gray-800 mb-6 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                    </svg>
                                    本组任务管理
                                </h2>

                                <form onSubmit={handleCreateTask} className="border-b border-gray-100 pb-6 mb-6">
                                    <h3 className="font-semibold text-gray-700 mb-4">发布新任务</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-600 mb-2">任务标题 *</label>
                                            <input
                                                value={taskTitle}
                                                onChange={e => setTaskTitle(e.target.value)}
                                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                                                required
                                                placeholder="输入任务标题"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-600 mb-2">优先级</label>
                                            <select
                                                value={priority}
                                                onChange={e => setPriority(e.target.value as 'low' | 'medium' | 'high')}
                                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                                            >
                                                <option value="low">低</option>
                                                <option value="medium">中</option>
                                                <option value="high">高</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-600 mb-2">分配组员 *</label>
                                            <select
                                                value={assignUserId}
                                                onChange={e => setAssignUserId(e.target.value)}
                                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
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
                                            <label className="block text-sm font-medium text-gray-600 mb-2">截止日期</label>
                                            <input
                                                type="date"
                                                value={dueDate}
                                                onChange={e => setDueDate(e.target.value)}
                                                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                                            />
                                        </div>
                                    </div>
                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-gray-600 mb-2">任务详情</label>
                                        <textarea
                                            value={taskDesc}
                                            onChange={e => setTaskDesc(e.target.value)}
                                            rows={3}
                                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all resize-none"
                                            placeholder="填写任务要求、交付标准"
                                        />
                                    </div>
                                    <button
                                        type="submit"
                                        disabled={members.length === 0}
                                        className={`w-full max-w-xs py-3 rounded-xl font-semibold transition-all duration-200 ${members.length > 0
                                                ? 'bg-gradient-to-r from-green-500 to-green-600 text-white hover:from-green-600 hover:to-green-700 shadow-lg hover:shadow-xl'
                                                : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                            }`}
                                    >
                                        {members.length === 0 ? '暂无组员，无法发布' : '发布任务'}
                                    </button>
                                </form>

                                <h3 className="font-semibold text-gray-700 mb-4">全部任务</h3>
                                {taskList.length === 0 ? (
                                    <div className="text-center py-8 text-gray-500">
                                        <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                        </svg>
                                        <p>暂无任务，可在上方表单发布新任务</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {taskList.map(t => {
                                            const hasFiles = t.uploaded_files && JSON.parse(t.uploaded_files).length > 0;
                                            return (
                                                <div key={t.id} className="p-4 bg-gray-50 rounded-xl border border-gray-100 hover:shadow-md transition-all duration-200">
                                                    <div className="flex items-start justify-between gap-4">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <h4 className="font-semibold text-gray-800">{t.title}</h4>
                                                                <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${getPriorityColor(t.priority)}`}>
                                                                    {getPriorityLabel(t.priority)}
                                                                </span>
                                                                {hasFiles && (
                                                                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                                                                        已上传
                                                                    </span>
                                                                )}
                                                                {t.review_status === 'approved' && (
                                                                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">
                                                                        已通过
                                                                    </span>
                                                                )}
                                                                {t.review_status === 'rejected' && (
                                                                    <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">
                                                                        已打回
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-sm text-gray-600 mb-2">{t.description || '无详情'}</p>
                                                            <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500">
                                                                <span className="flex items-center gap-1">
                                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                                    </svg>
                                                                    {t.assignee_name}
                                                                </span>
                                                                <span>{getStatusLabel(t.status)}</span>
                                                                {t.due_date && (
                                                                    <span className="flex items-center gap-1">
                                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                                        </svg>
                                                                        {t.due_date}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-2 shrink-0">
                                                            {t.status === 'done' && (!t.review_status || t.review_status === 'pending') && (
                                                                <button
                                                                    onClick={() => openReview(t)}
                                                                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-all duration-200"
                                                                >审核</button>
                                                            )}
                                                            <button
                                                                onClick={() => openEdit(t)}
                                                                className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium transition-all duration-200"
                                                            >编辑</button>
                                                            <button
                                                                onClick={() => handleDeleteTask(t.id)}
                                                                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-all duration-200"
                                                            >删除</button>
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {editOpen && editTask && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in">
                            <div className="bg-gradient-to-r from-primary-500 to-primary-600 p-6">
                                <h3 className="text-xl font-bold text-white">编辑任务</h3>
                            </div>
                            <form onSubmit={handleUpdateTask} className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-600 mb-2">标题 *</label>
                                    <input
                                        value={taskTitle}
                                        onChange={e => setTaskTitle(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-600 mb-2">分配组员</label>
                                    <select
                                        value={assignUserId}
                                        onChange={e => setAssignUserId(e.target.value)}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
                                        <label className="block text-sm font-medium text-gray-600 mb-2">优先级</label>
                                        <select
                                            value={priority}
                                            onChange={e => setPriority(e.target.value as 'low' | 'medium' | 'high')}
                                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                        >
                                            <option value="low">低</option>
                                            <option value="medium">中</option>
                                            <option value="high">高</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-600 mb-2">截止日期</label>
                                        <input
                                            type="date"
                                            value={dueDate}
                                            onChange={e => setDueDate(e.target.value)}
                                            className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-600 mb-2">详情</label>
                                    <textarea
                                        value={taskDesc}
                                        onChange={e => setTaskDesc(e.target.value)}
                                        rows={3}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                                    />
                                </div>
                                <div className="flex gap-3 justify-end pt-2">
                                    <button
                                        type="button"
                                        onClick={() => setEditOpen(false)}
                                        className="px-5 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-medium transition-all duration-200"
                                    >取消</button>
                                    <button
                                        type="submit"
                                        className="px-5 py-2.5 bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 text-white rounded-xl font-medium transition-all duration-200 shadow-lg"
                                    >保存修改</button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* 审核弹窗 */}
                {reviewOpen && reviewTask && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in max-h-[90vh] overflow-y-auto">
                            <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-6">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h3 className="text-xl font-bold text-white">审核任务</h3>
                                        <p className="text-white/80 mt-1">{reviewTask.title}</p>
                                    </div>
                                    <button
                                        onClick={() => setReviewOpen(false)}
                                        className="text-white/80 hover:text-white transition-colors"
                                    >
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                            <div className="p-6 space-y-4">
                                {/* 任务信息 */}
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div>
                                        <span className="text-gray-500">执行者：</span>
                                        <span className="text-gray-800 font-medium">{reviewTask.assignee_name}</span>
                                    </div>
                                    <div>
                                        <span className="text-gray-500">状态：</span>
                                        <span className="text-green-600 font-medium">已完成</span>
                                    </div>
                                </div>

                                {/* 任务描述 */}
                                {reviewTask.description && (
                                    <div>
                                        <h4 className="text-sm font-semibold text-gray-500 mb-2">任务描述</h4>
                                        <p className="text-gray-700 text-sm">{reviewTask.description}</p>
                                    </div>
                                )}

                                {/* 上传的文件 */}
                                {reviewFiles.length > 0 ? (
                                    <div className="border border-gray-200 rounded-xl p-4">
                                        <h4 className="text-sm font-semibold text-gray-500 mb-3">提交的文件 ({reviewFiles.length})</h4>
                                        <div className="space-y-2">
                                            {reviewFiles.map((file, idx) => (
                                                <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                                                    <span className="text-sm text-gray-700 truncate max-w-[200px]">{file.name}</span>
                                                    <button
                                                        onClick={() => handleDownloadFile(file.name, file.content)}
                                                        className="px-3 py-1 bg-primary-100 hover:bg-primary-200 text-primary-700 text-sm font-medium rounded-lg transition-colors"
                                                    >
                                                        下载
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="border border-gray-200 rounded-xl p-4 bg-gray-50">
                                        <p className="text-sm text-gray-500 text-center">暂无上传文件</p>
                                    </div>
                                )}

                                {/* 审核理由 */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-500 mb-2">审核意见</label>
                                    <textarea
                                        value={reviewComment}
                                        onChange={e => setReviewComment(e.target.value)}
                                        rows={3}
                                        placeholder="请输入审核理由（选填，未通过时建议填写）"
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                                    />
                                </div>

                                {/* 审核按钮 */}
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => handleReview('rejected')}
                                        className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-semibold transition-all duration-200"
                                    >
                                        打回任务
                                    </button>
                                    <button
                                        onClick={() => handleReview('approved')}
                                        className="flex-1 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-semibold transition-all duration-200"
                                    >
                                        审核通过
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}