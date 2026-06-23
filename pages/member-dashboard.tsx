import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/router';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import NotifyBell from '../components/NotifyBell';

type Group = {
    id: string;
    name: string;
    description: string;
};
type Task = {
    id: string;
    title: string;
    description: string | null;
    assignee_id: string;
    assignee_name: string;
    creator_name: string;
    status: string;
    priority: string;
    due_date: string | null;
    created_at: string;
    uploaded_files?: string;
    review_status?: string;
    review_comment?: string;
};
type ColumnMap = {
    todo: Task[];
    doing: Task[];
    done: Task[];
};
type Member = {
    id: string;
    username: string;
};

export default function MemberDashboard() {
    const { user, logout } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [groups, setGroups] = useState<Group[]>([]);
    const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
    const [columns, setColumns] = useState<ColumnMap>({ todo: [], doing: [], done: [] });
    const [detailTask, setDetailTask] = useState<Task | null>(null);
    const [members, setMembers] = useState<Member[]>([]);
    const [uploadedFiles, setUploadedFiles] = useState<{ name: string; content: string }[]>([]);
    const [isUploading, setIsUploading] = useState(false);

    useEffect(() => {
        const check = async () => {
            setLoading(true);
            if (!user) {
                router.push('/login');
                return;
            }
            if (user.role === 'admin') {
                router.push('/admin');
                return;
            }
            if (user.role === 'leader') {
                router.push('/group-leader');
                return;
            }
            setLoading(false);
        };
        check();
    }, [user, router]);

    useEffect(() => {
        if (loading || !user || user.role !== 'member') return;
        const fetchGroups = async () => {
            const token = localStorage.getItem('token');
            if (!token) return router.push('/login');
            try {
                const res = await fetch(`/api/user-member-groups`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (!res.ok) throw new Error('小组接口异常');
                const data = await res.json();
                if (data.success) setGroups(data.data);
            } catch (err) {
                console.error('加载小组失败', err);
                alert('小组列表加载失败，请刷新页面');
            }
        };
        fetchGroups();
    }, [loading, user]);

    useEffect(() => {
        if (!activeGroupId || loading) return;
        const token = localStorage.getItem('token');
        const fetchAll = async () => {
            try {
                // 并行加载任务和组员
                const [taskRes, memberRes] = await Promise.all([
                    fetch(`/api/member-tasks?groupId=${activeGroupId}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    }),
                    fetch(`/api/group-members?groupId=${activeGroupId}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    })
                ]);

                // 处理任务数据
                if (!taskRes.ok) throw new Error('任务接口异常');
                const taskData = await taskRes.json();
                if (!taskData.success) return alert(taskData.msg);
                const todo = taskData.data.filter((t: Task) => t.status === 'todo');
                const doing = taskData.data.filter((t: Task) => t.status === 'doing');
                const done = taskData.data.filter((t: Task) => t.status === 'done');
                setColumns({ todo, doing, done });

                // 处理组员数据
                if (!memberRes.ok) throw new Error('组员接口异常');
                const memberData = await memberRes.json();
                if (memberData.success) setMembers(memberData.data);
            } catch (err) {
                console.error('加载数据失败', err);
                alert('数据加载失败，请重新选择小组');
            }
        };
        fetchAll();
    }, [activeGroupId, loading]);

    // 当选择任务详情时，加载已上传的文件
    useEffect(() => {
        if (detailTask && detailTask.uploaded_files) {
            try {
                setUploadedFiles(JSON.parse(detailTask.uploaded_files));
            } catch {
                setUploadedFiles([]);
            }
        } else {
            setUploadedFiles([]);
        }
    }, [detailTask]);

    const onDragEnd = async (result: DropResult) => {
        const { destination, source, draggableId } = result;
        if (!destination) return;
        if (source.droppableId === destination.droppableId) return;

        const taskId = draggableId;
        const newStatus = destination.droppableId;
        const token = localStorage.getItem('token');

        // 如果是拖拽到"已完成"，需要先检查是否有文件
        if (newStatus === 'done') {
            const task = [...columns.todo, ...columns.doing, ...columns.done].find(t => t.id === taskId);
            if (task && task.assignee_id === user?.id) {
                // 检查任务是否有上传文件
                const hasFiles = task.uploaded_files && JSON.parse(task.uploaded_files).length > 0;
                if (!hasFiles) {
                    alert('完成任务前请先上传相关文件！');
                    return;
                }
            }
        }

        try {
            const res = await fetch('/api/update-task-status', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ taskId, status: newStatus })
            });
            if (!res.ok) throw new Error('状态更新接口异常');
            const ret = await res.json();
            if (!ret.success) return alert(ret.msg);

            const sourceCol = [...columns[source.droppableId as keyof ColumnMap]];
            const destCol = [...columns[destination.droppableId as keyof ColumnMap]];
            const moveItem = sourceCol.splice(source.index, 1)[0];
            destCol.splice(destination.index, 0, moveItem);
            setColumns({
                ...columns,
                [source.droppableId]: sourceCol,
                [destination.droppableId]: destCol
            });
        } catch (err) {
            console.error('拖拽更新失败', err);
            alert('仅可拖拽分配给你本人的任务');
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!detailTask) return;
        const file = e.target.files?.[0];
        if (!file) return;

        // 文件大小限制：最大 2MB
        const maxSize = 2 * 1024 * 1024; // 2MB
        if (file.size > maxSize) {
            alert(`文件大小不能超过 2MB，当前文件大小：${(file.size / 1024 / 1024).toFixed(2)}MB`);
            return;
        }

        // 限制文件类型为图片
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
        if (!allowedTypes.includes(file.type)) {
            alert('只支持上传图片文件（JPG、PNG、GIF、WebP、BMP）');
            return;
        }

        setIsUploading(true);
        try {
            const reader = new FileReader();
            reader.onload = async (event) => {
                const content = (event.target?.result as string).split(',')[1]; // 去掉 Base64 头部
                const token = localStorage.getItem('token');

                const res = await fetch('/api/task/upload-file', {
                    method: 'POST',
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        taskId: detailTask.id,
                        fileName: file.name,
                        fileContent: content
                    })
                });

                if (!res.ok) throw new Error('文件上传失败');
                const data = await res.json();
                if (data.success) {
                    setUploadedFiles(data.data);
                    alert('文件上传成功');
                } else {
                    alert(data.msg);
                }
                setIsUploading(false);
            };
            reader.readAsDataURL(file);
        } catch (err) {
            console.error('文件上传失败', err);
            alert('文件上传失败');
            setIsUploading(false);
        }
    };

    const handleDownloadFile = (fileName: string, fileContent: string) => {
        const link = document.createElement('a');
        link.href = `data:application/octet-stream;base64,${fileContent}`;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
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

    if (loading || !user || user.role !== 'member') {
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
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                            </div>
                            <h1 className="text-xl font-bold text-white">组员任务看板</h1>
                        </div>
                        <div className="flex items-center gap-3">
                            <NotifyBell />
                            <button
                                onClick={() => router.push('/dashboard')}
                                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-all duration-200 text-sm font-medium"
                            >
                                工作台
                            </button>
                            <button
                                onClick={logout}
                                className="px-4 py-2 bg-red-500/80 hover:bg-red-500 text-white rounded-lg transition-all duration-200 text-sm font-medium"
                            >
                                退出
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-8">
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    {/* 左侧：小组选择和组员列表 */}
                    <div className="lg:col-span-1 space-y-6">
                        {/* 小组选择 */}
                        <div className="bg-white rounded-2xl shadow-lg p-6">
                            <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                                <svg className="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                我的小组
                            </h2>
                            {groups.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                    <svg className="w-16 h-16 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <p>暂无加入任何小组</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {groups.map(g => (
                                        <button
                                            key={g.id}
                                            onClick={() => setActiveGroupId(g.id)}
                                            className={`w-full px-4 py-3 rounded-xl font-medium text-left transition-all duration-200 ${activeGroupId === g.id
                                                ? 'bg-gradient-to-r from-primary-500 to-primary-600 text-white shadow-lg shadow-primary-500/30'
                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                }`}
                                        >
                                            <span className="block">{g.name}</span>
                                            {g.description && (
                                                <span className="block text-xs opacity-70 mt-0.5 truncate">{g.description}</span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* 当前组员列表 */}
                        {activeGroupId && (
                            <div className="bg-white rounded-2xl shadow-lg p-6">
                                <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
                                    <svg className="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                    </svg>
                                    当前组员 ({members.length})
                                </h2>
                                <div className="space-y-2">
                                    {members.length === 0 ? (
                                        <p className="text-center text-gray-400 py-4">暂无组员</p>
                                    ) : (
                                        members.map(member => (
                                            <div key={member.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                                                <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                                                    <svg className="w-4 h-4 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                    </svg>
                                                </div>
                                                <span className="text-sm text-gray-700 font-medium">{member.username}</span>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 右侧：任务看板 */}
                    <div className="lg:col-span-3">
                        {activeGroupId ? (
                            <DragDropContext onDragEnd={onDragEnd}>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {(['todo', 'doing', 'done'] as const).map(colId => (
                                        <div key={colId} className="bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg overflow-hidden">
                                            <div className="p-4 bg-gradient-to-r from-gray-50 to-gray-100 border-b">
                                                <div className="flex items-center justify-between">
                                                    <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                                                        {colId === 'todo' && (
                                                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                                            </svg>
                                                        )}
                                                        {colId === 'doing' && (
                                                            <svg className="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                                                            </svg>
                                                        )}
                                                        {colId === 'done' && (
                                                            <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                                            </svg>
                                                        )}
                                                        {colId === 'todo' ? '待办' : colId === 'doing' ? '进行中' : '已完成'}
                                                    </h3>
                                                    <span className="px-3 py-1 bg-gray-200 text-gray-600 text-sm font-medium rounded-full">
                                                        {columns[colId].length}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="p-4 min-h-[400px]">
                                                <Droppable droppableId={colId}>
                                                    {(provided) => (
                                                        <div
                                                            ref={provided.innerRef}
                                                            {...provided.droppableProps}
                                                            className="space-y-3"
                                                        >
                                                            {columns[colId].map((task, idx) => {
                                                                const hasFiles = task.uploaded_files && JSON.parse(task.uploaded_files).length > 0;
                                                                return (
                                                                    <Draggable key={task.id} draggableId={task.id} index={idx}>
                                                                        {(prov) => (
                                                                            <div
                                                                                ref={prov.innerRef}
                                                                                {...prov.draggableProps}
                                                                                {...prov.dragHandleProps}
                                                                                onClick={() => setDetailTask(task)}
                                                                                className="bg-white p-4 rounded-xl border border-gray-100 cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group"
                                                                            >
                                                                                <div className="flex items-start justify-between gap-2 mb-2">
                                                                                    <h4 className="font-medium text-gray-800 group-hover:text-primary-600 transition-colors">
                                                                                        {task.title}
                                                                                    </h4>
                                                                                    <div className="flex items-center gap-1">
                                                                                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full border ${getPriorityColor(task.priority)}`}>
                                                                                            {getPriorityLabel(task.priority)}
                                                                                        </span>
                                                                                        {hasFiles && (
                                                                                            <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
                                                                                                已上传
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                                <div className="flex items-center gap-4 text-xs text-gray-500">
                                                                                    <span className="flex items-center gap-1">
                                                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                                                                        </svg>
                                                                                        {task.assignee_name}
                                                                                    </span>
                                                                                    {task.due_date && (
                                                                                        <span className="flex items-center gap-1">
                                                                                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                                                            </svg>
                                                                                            {task.due_date}
                                                                                        </span>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </Draggable>
                                                                );
                                                            })}
                                                            {provided.placeholder}
                                                        </div>
                                                    )}
                                                </Droppable>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </DragDropContext>
                        ) : (
                            <div className="bg-white/50 backdrop-blur-sm rounded-2xl shadow-lg p-12 text-center">
                                <svg className="w-20 h-20 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                                </svg>
                                <h3 className="text-lg font-semibold text-gray-600 mb-2">请选择小组</h3>
                                <p className="text-gray-500">从左侧选择一个小组，查看你的任务看板</p>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* 任务详情弹窗 */}
            {detailTask && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-scale-in max-h-[90vh] overflow-y-auto">
                        <div className="bg-gradient-to-r from-primary-500 to-primary-600 p-6">
                            <div className="flex items-start justify-between">
                                <h2 className="text-xl font-bold text-white">{detailTask.title}</h2>
                                <button
                                    onClick={() => setDetailTask(null)}
                                    className="text-white/80 hover:text-white transition-colors"
                                >
                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </div>
                            <span className={`inline-block mt-2 px-3 py-1 text-xs font-medium rounded-full bg-white/20 text-white border border-white/30`}>
                                {getPriorityLabel(detailTask.priority)}优先级
                            </span>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <h4 className="text-sm font-semibold text-gray-500 mb-1">任务详情</h4>
                                <p className="text-gray-700">{detailTask.description || '无描述'}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-500 mb-1">分配人</h4>
                                    <p className="text-gray-700 flex items-center gap-2">
                                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                        {detailTask.assignee_name}
                                    </p>
                                </div>
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-500 mb-1">创建人</h4>
                                    <p className="text-gray-700 flex items-center gap-2">
                                        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                        {detailTask.creator_name}
                                    </p>
                                </div>
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-500 mb-1">当前状态</h4>
                                    <p className="text-gray-700">{detailTask.status === 'todo' ? '待办' : detailTask.status === 'doing' ? '进行中' : '已完成'}</p>
                                </div>
                                <div>
                                    <h4 className="text-sm font-semibold text-gray-500 mb-1">截止日期</h4>
                                    <p className="text-gray-700">{detailTask.due_date || '无'}</p>
                                </div>
                            </div>
                            <div>
                                <h4 className="text-sm font-semibold text-gray-500 mb-1">创建时间</h4>
                                <p className="text-gray-700">{detailTask.created_at}</p>
                            </div>

                            {/* 文件上传区域 */}
                            {detailTask.assignee_id === user?.id && (
                                <div className="border border-gray-200 rounded-xl p-4">
                                    <h4 className="text-sm font-semibold text-gray-500 mb-3">文件上传（完成任务前请上传相关文件）</h4>
                                    <p className="text-xs text-gray-400 mb-2">支持格式：JPG、PNG、GIF、WebP、BMP，最大 2MB</p>
                                    <input
                                        type="file"
                                        accept="image/jpeg,image/png,image/gif,image/webp,image/bmp"
                                        onChange={handleFileUpload}
                                        disabled={isUploading}
                                        className="w-full p-3 border border-gray-200 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors cursor-pointer"
                                    />
                                    {isUploading && (
                                        <p className="mt-2 text-sm text-primary-600">上传中...</p>
                                    )}
                                </div>
                            )}

                            {/* 已上传文件列表 */}
                            {uploadedFiles.length > 0 && (
                                <div className="border border-gray-200 rounded-xl p-4">
                                    <h4 className="text-sm font-semibold text-gray-500 mb-3">已上传文件 ({uploadedFiles.length})</h4>
                                    <div className="space-y-2">
                                        {uploadedFiles.map((file, idx) => (
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
                            )}

                            {/* 审核状态 */}
                            {detailTask.review_status && (
                                <div className={`border rounded-xl p-4 ${detailTask.review_status === 'approved' ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}`}>
                                    <h4 className="text-sm font-semibold text-gray-500 mb-1">审核状态</h4>
                                    <p className={`font-medium ${detailTask.review_status === 'approved' ? 'text-green-700' : 'text-red-700'}`}>
                                        {detailTask.review_status === 'approved' ? '审核通过' : detailTask.review_status === 'rejected' ? '审核未通过' : '待审核'}
                                    </p>
                                    {detailTask.review_comment && (
                                        <p className="text-sm text-gray-600 mt-2">审核意见：{detailTask.review_comment}</p>
                                    )}
                                </div>
                            )}
                        </div>
                        <div className="p-6 pt-0">
                            <button
                                onClick={() => setDetailTask(null)}
                                className="w-full py-3 bg-gradient-to-r from-primary-500 to-primary-600 text-white rounded-xl font-medium hover:from-primary-600 hover:to-primary-700 transition-all duration-200 shadow-lg"
                            >
                                关闭
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}