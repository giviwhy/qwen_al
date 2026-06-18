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
};
type ColumnMap = {
    todo: Task[];
    doing: Task[];
    done: Task[];
};

export default function MemberDashboard() {
    const { user, logout } = useAuth();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [groups, setGroups] = useState<Group[]>([]);
    const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
    const [columns, setColumns] = useState<ColumnMap>({ todo: [], doing: [], done: [] });
    const [detailTask, setDetailTask] = useState<Task | null>(null);

    // 身份鉴权跳转
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

    // 加载自己加入的小组
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

    // 切换小组加载任务并分栏
    useEffect(() => {
        if (!activeGroupId || loading) return;
        const loadTasks = async () => {
            const token = localStorage.getItem('token');
            try {
                const res = await fetch(`/api/member-tasks?groupId=${activeGroupId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (!res.ok) throw new Error('任务接口异常');
                const data = await res.json();
                if (!data.success) return alert(data.msg);
                const todo = data.data.filter((t: Task) => t.status === 'todo');
                const doing = data.data.filter((t: Task) => t.status === 'doing');
                const done = data.data.filter((t: Task) => t.status === 'done');
                setColumns({ todo, doing, done });
            } catch (err) {
                console.error('加载任务失败', err);
                alert('任务加载失败，请重新选择小组');
            }
        };
        loadTasks();
    }, [activeGroupId, loading]);

    // 拖拽结束处理
    const onDragEnd = async (result: DropResult) => {
        const { destination, source, draggableId } = result;
        if (!destination) return;
        if (source.droppableId === destination.droppableId) return;

        const taskId = draggableId;
        const newStatus = destination.droppableId;
        const token = localStorage.getItem('token');

        try {
            // 后端更新状态
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

            // 本地状态更新
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

    if (loading || !user || user.role !== 'member') return <div className="p-10 text-center">页面加载/跳转中...</div>;

    return (
        <div className="max-w-7xl mx-auto p-6">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold">组员任务看板</h1>
                {/* 通知铃铛 + 操作按钮 */}
                <div className="flex items-center gap-3">
                    <NotifyBell />
                    <button onClick={() => router.push('/dashboard')} className="px-3 py-2 bg-gray-200 rounded">工作台</button>
                    <button onClick={logout} className="px-3 py-2 bg-red-500 text-white rounded">退出</button>
                </div>
            </div>

            {/* 小组选择 */}
            <div className="border p-4 rounded mb-6">
                <h2 className="font-semibold mb-3">我的小组</h2>
                {groups.length === 0 ? (
                    <p>暂无加入任何小组，请联系组长添加</p>
                ) : (
                    <div className="flex gap-3 flex-wrap">
                        {groups.map(g => (
                            <button
                                key={g.id}
                                onClick={() => setActiveGroupId(g.id)}
                                className={`px-4 py-2 rounded ${activeGroupId === g.id ? 'bg-blue-500 text-white' : 'bg-gray-100'}`}
                            >
                                {g.name}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {activeGroupId ? (
                <DragDropContext onDragEnd={onDragEnd}>
                    <div className="grid grid-cols-3 gap-4">
                        {(['todo', 'doing', 'done'] as const).map(colId => (
                            <div key={colId} className="bg-gray-50 p-4 rounded min-h-[400px]">
                                <h3 className="font-bold text-lg mb-4 capitalize">
                                    {colId === 'todo' ? '待办' : colId === 'doing' ? '进行中' : '已完成'}
                                    <span className="ml-2 text-sm text-gray-500">({columns[colId].length})</span>
                                </h3>
                                <Droppable droppableId={colId}>
                                    {(provided) => (
                                        <div
                                            ref={provided.innerRef}
                                            {...provided.droppableProps}
                                            className="space-y-3"
                                        >
                                            {columns[colId].map((task, idx) => (
                                                <Draggable key={task.id} draggableId={task.id} index={idx}>
                                                    {(prov) => (
                                                        <div
                                                            ref={prov.innerRef}
                                                            {...prov.draggableProps}
                                                            {...prov.dragHandleProps}
                                                            onClick={() => setDetailTask(task)}
                                                            className="bg-white p-3 rounded border cursor-pointer hover:shadow"
                                                        >
                                                            <div className="font-medium">{task.title}</div>
                                                            <div className="text-xs text-gray-500 mt-1">分配：{task.assignee_name}</div>
                                                            <div className={`text-xs mt-1 ${task.priority === 'high' ? 'text-red-500' : task.priority === 'medium' ? 'text-orange-500' : 'text-green-500'}`}>
                                                                优先级：{task.priority}
                                                            </div>
                                                        </div>
                                                    )}
                                                </Draggable>
                                            ))}
                                            {provided.placeholder}
                                        </div>
                                    )}
                                </Droppable>
                            </div>
                        ))}
                    </div>
                </DragDropContext>
            ) : (
                <div className="text-center py-20 text-gray-500">请上方选择小组查看任务看板</div>
            )}

            {/* 任务详情弹窗 */}
            {detailTask && (
                <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded w-full max-w-lg p-6">
                        <h2 className="text-xl font-bold mb-4">{detailTask.title}</h2>
                        <div className="space-y-2 text-sm">
                            <p><span className="font-medium">任务详情：</span>{detailTask.description || '无'}</p>
                            <p><span className="font-medium">分配人：</span>{detailTask.assignee_name}</p>
                            <p><span className="font-medium">创建人：</span>{detailTask.creator_name}</p>
                            <p><span className="font-medium">当前状态：</span>{detailTask.status}</p>
                            <p><span className="font-medium">优先级：</span>{detailTask.priority}</p>
                            <p><span className="font-medium">截止日期：</span>{detailTask.due_date || '无'}</p>
                            <p><span className="font-medium">创建时间：</span>{detailTask.created_at}</p>
                        </div>
                        <button
                            onClick={() => setDetailTask(null)}
                            className="mt-6 w-full py-2 bg-gray-200 rounded"
                        >
                            关闭
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}