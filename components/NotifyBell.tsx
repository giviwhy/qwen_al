import { useState, useEffect, useRef } from 'react';
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
    const [badgeCount, setBadgeCount] = useState(0);
    const intervalRef = useRef<number | null>(null);

    const unreadNum = list.filter(i => i.isUnread).length;

    const loadNotify = async (forceUpdate = false) => {
        const token = localStorage.getItem('token');
        if (!token) {
            router.push('/login');
            return;
        }
        try {
            const res = await fetch('/api/user/get-notifications', {
                headers: { Authorization: `Bearer ${token}` }
            });
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
                const uniqueMap = new Map<string, NotifyItem>();
                json.data.forEach((item: NotifyItem) => {
                    if (!uniqueMap.has(item.id)) {
                        uniqueMap.set(item.id, item);
                    }
                });
                const newList = Array.from(uniqueMap.values());
                const newUnreadCount = newList.filter(i => i.isUnread).length;

                // 如果不是强制更新，只在有新通知时更新列表
                if (forceUpdate || newUnreadCount > badgeCount) {
                    setList(newList);
                }
                setBadgeCount(newUnreadCount);
            }
        } catch (err) {
            console.error('获取通知失败', err);
        }
    };

    // 组件挂载时加载一次通知
    useEffect(() => {
        loadNotify(true);
    }, []);

    // 打开面板时刷新通知列表
    useEffect(() => {
        if (showPanel) {
            loadNotify(true);
        }
    }, [showPanel, router]);

    // 添加轮询机制，每30秒自动检查新通知
    useEffect(() => {
        // 启动轮询（每30秒检查一次）
        intervalRef.current = window.setInterval(() => {
            loadNotify(false);
        }, 30000); // 30秒

        return () => {
            // 组件卸载时清除定时器
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
            }
        };
    }, [badgeCount]);

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
            setList(prev => prev.map(item =>
                item.id === notifyId ? { ...item, isUnread: false } : item
            ));
            setBadgeCount(prev => Math.max(0, prev - 1));
        } catch (err) {
            console.error('标记已读失败', err);
        }
    };

    const markAllRead = async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            router.push('/login');
            return;
        }
        try {
            // 批量标记所有未读通知为已读
            const unreadIds = list.filter(i => i.isUnread).map(i => i.id);
            if (unreadIds.length === 0) return;

            await Promise.all(
                unreadIds.map(id =>
                    fetch('/api/user/read-notification', {
                        method: 'POST',
                        headers: {
                            Authorization: `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ notifyId: id })
                    })
                )
            );

            setList(prev => prev.map(item => ({ ...item, isUnread: false })));
            setBadgeCount(0);
        } catch (err) {
            console.error('标记全部已读失败', err);
        }
    };

    return (
        <div className="relative inline-block">
            <button
                onClick={() => setShowPanel(!showPanel)}
                className="relative p-2 rounded-xl hover:bg-white/20 transition-all duration-200"
            >
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {badgeCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white w-5 h-5 rounded-full text-xs font-medium flex items-center justify-center shadow-lg animate-pulse">
                        {badgeCount > 9 ? '9+' : badgeCount}
                    </span>
                )}
            </button>

            {showPanel && (
                <div className="absolute right-0 top-12 w-[400px] bg-white rounded-2xl shadow-xl border border-gray-100 z-50 max-h-[520px] overflow-y-auto animate-scale-in">
                    <div className="p-4 border-b border-gray-100 bg-gradient-to-r from-primary-50 to-gray-50">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <svg className="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                </svg>
                                <h3 className="font-semibold text-gray-800">系统通知</h3>
                                <span className="px-2 py-0.5 bg-primary-100 text-primary-700 text-xs font-medium rounded-full">
                                    {badgeCount} 条未读
                                </span>
                            </div>
                            {badgeCount > 0 && (
                                <button
                                    onClick={markAllRead}
                                    className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
                                >
                                    全部已读
                                </button>
                            )}
                        </div>
                    </div>
                    {list.length === 0 ? (
                        <div className="py-12 text-center">
                            <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                            </svg>
                            <p className="text-gray-500">暂无通知</p>
                        </div>
                    ) : (
                        list.map(item => (
                            <div
                                key={item.id}
                                onClick={() => markRead(item.id)}
                                className={`p-4 border-b border-gray-50 cursor-pointer transition-all duration-200 hover:bg-gray-50 ${item.isUnread ? 'bg-primary-50' : ''}`}
                            >
                                <div className="flex justify-between items-start">
                                    <h4 className="font-semibold text-gray-800">{item.title}</h4>
                                    {item.isUnread && (
                                        <span className="px-2 py-0.5 bg-primary-500 text-white text-xs font-medium rounded-full">
                                            新
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-gray-600 mt-2 line-clamp-2">{item.content}</p>
                                <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                                    <span className="flex items-center gap-1">
                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                        {item.sender_name}
                                    </span>
                                    {item.group_id === null && (
                                        <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full">全局通知</span>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}