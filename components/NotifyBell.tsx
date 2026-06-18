
import { useState, useEffect } from 'react';

type NotifyItem = {
    id: string;
    title: string;
    content: string;
    sender_name: string;
    isUnread: boolean;
    group_id: string | null;
};

export default function NotifyBell() {
    const [showPanel, setShowPanel] = useState(false);
    const [list, setList] = useState<NotifyItem[]>([]);
    const unreadNum = list.filter(i => i.isUnread).length;

    // 拉取通知
    const loadNotify = async () => {
        const token = localStorage.getItem('token');
        const res = await fetch('/api/user/get-notifications', {
            headers: { Authorization: `Bearer ${token}` }
        });
        const json = await res.json();
        if (json.success) setList(json.data);
    };

    useEffect(() => {
        if (showPanel) loadNotify();
    }, [showPanel]);

    // 标记已读
    const markRead = async (notifyId: string) => {
        const token = localStorage.getItem('token');
        await fetch('/api/user/read-notification', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ notifyId })
        });
        setList(prev => prev.map(item => item.id === notifyId ? { ...item, isUnread: false } : item));
    };

    return (
        <div className="relative inline-block">
            <button onClick={() => setShowPanel(!showPanel)} className="relative p-2 rounded hover:bg-gray-100">
                🔔
                {unreadNum > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white w-5 h-5 rounded-full text-xs flex items-center justify-center">
                        {unreadNum}
                    </span>
                )}
            </button>

            {showPanel && (
                <div className="absolute right-0 top-12 w-[440px] bg-white shadow-lg rounded border z-50 max-h-[520px] overflow-y-auto">
                    <div className="p-4 border-b font-bold text-lg">系统通知</div>
                    {list.length === 0 ? (
                        <div className="py-10 text-center text-gray-500">暂无通知</div>
                    ) : (
                        list.map(item => (
                            <div
                                key={item.id}
                                onClick={() => markRead(item.id)}
                                className={`p-4 border-b cursor-pointer hover:bg-gray-50 ${item.isUnread ? 'bg-blue-50' : ''}`}
                            >
                                <div className="flex justify-between items-center">
                                    <h4 className="font-semibold">{item.title}</h4>
                                    {item.isUnread && <span className="text-xs bg-blue-500 text-white px-2 rounded">新</span>}
                                </div>
                                <p className="text-sm text-gray-600 mt-2">{item.content}</p>
                                <div className="text-xs text-gray-400 mt-2">
                                    发布人：{item.sender_name}
                                    {item.group_id === null && <span className="ml-2 text-green-600">【全局通知】</span>}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}