import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

type NotifyItem = {
    id: string;
    title: string;
    content: string;
    sender_name: string;
    isUnread: boolean;
    group_id: string | null;
};

export default function NotifyBell() {
    const router = useRouter();
    const [showPanel, setShowPanel] = useState(false);
    const [list, setList] = useState<NotifyItem[]>([]);
    const unreadNum = list.filter(i => i.isUnread).length;

    // 拉取通知（增加token判空、401跳转、异常捕获 + 通知ID去重）
    const loadNotify = async () => {
        const token = localStorage.getItem('token');
        // 无token直接跳登录
        if (!token) {
            router.push('/login');
            return;
        }
        try {
            const res = await fetch('/api/user/get-notifications', {
                headers: { Authorization: `Bearer ${token}` }
            });
            // 鉴权失败跳转登录
            if (res.status === 401) {
                localStorage.removeItem('token');
                router.push('/login');
                return;
            }
            if (!res.ok) {
                console.warn('通知接口异常，跳过加载');
                return;
            }
            const json = await res.json();
            if (json.success) {
                // 根据通知唯一id去重，避免重复渲染
                const uniqueMap = new Map<string, NotifyItem>();
                json.data.forEach((item: NotifyItem) => {
                    if (!uniqueMap.has(item.id)) {
                        uniqueMap.set(item.id, item);
                    }
                });
                setList(Array.from(uniqueMap.values()));
            }
        } catch (err) {
            console.error('获取通知失败', err);
        }
    };

    useEffect(() => {
        if (showPanel) loadNotify();
    }, [showPanel, router]);

    // 标记已读（增加容错）
    const markRead = async (notifyId: string) => {
        const token = localStorage.getItem('token');
        if (!token) {
            router.push('/login');
            return;
        }
        try {
            const res = await fetch('/api/user/read-notification', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ notifyId })
            });
            if (res.status === 401) {
                localStorage.removeItem('token');
                router.push('/login');
                return;
            }
            // 本地直接更新状态，不用重新请求接口
            setList(prev => prev.map(item =>
                item.id === notifyId ? { ...item, isUnread: false } : item
            ));
        } catch (err) {
            console.error('标记已读失败', err);
        }
    };

    return (
        <div className="relative inline-block">
            <button
                onClick={() => setShowPanel(!showPanel)}
                className="relative p-2 rounded hover:bg-gray-100"
            >
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