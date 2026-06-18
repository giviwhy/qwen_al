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

export default function GroupLeaderPage() {
    const { user, logout } = useAuth();
    const router = useRouter();
    const [myGroups, setMyGroups] = useState<GroupItem[]>([]);
    const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
    const [members, setMembers] = useState<MemberItem[]>([]);

    // 权限校验：未登录 / 超级管理员直接进admin / 普通组员拦截
    useEffect(() => {
        if (!user) {
            router.push('/login');
            return;
        }
        // 全局超级管理员跳转完整后台
        if (user.role === 'admin') {
            router.push('/admin');
        }
    }, [user, router]);

    // 加载当前用户作为组长的所有小组
    useEffect(() => {
        if (!user) return;
        const fetchLeaderGroups = async () => {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/user-leader-groups`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) setMyGroups(data.data);
        };
        fetchLeaderGroups();
    }, [user]);

    // 切换小组，加载组员
    useEffect(() => {
        if (!activeGroupId || !user) return;
        const fetchMembers = async () => {
            const token = localStorage.getItem('token');
            const res = await fetch(`/api/group-members?groupId=${activeGroupId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.success) setMembers(data.data);
        };
        fetchMembers();
    }, [activeGroupId, user]);

    if (!user || user.role === 'admin') return <div>跳转中...</div>;

    return (
        <div className="max-w-7xl mx-auto p-6">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-2xl font-bold">组长管理后台</h1>
                <div className="flex gap-4">
                    <button onClick={() => router.push('/dashboard')} className="px-4 py-2 bg-gray-200 rounded">返回工作台</button>
                    <button onClick={logout} className="px-4 py-2 bg-red-500 text-white rounded">退出登录</button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* 我的小组列表 */}
                <div className="border rounded p-4">
                    <h2 className="text-lg font-semibold mb-4">我负责的小组</h2>
                    {myGroups.length === 0 ? (
                        <p className="text-gray-500">暂无管理的小组</p>
                    ) : (
                        myGroups.map(g => (
                            <div
                                key={g.id}
                                onClick={() => setActiveGroupId(g.id)}
                                className={`p-3 mb-2 rounded cursor-pointer ${activeGroupId === g.id ? 'bg-blue-100 border-blue-400' : 'bg-gray-50'}`}
                            >
                                <div className="font-medium">{g.name}</div>
                                <div className="text-sm text-gray-500">{g.description || '无描述'}</div>
                            </div>
                        ))
                    )}
                </div>

                {/* 小组成员管理 */}
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
        </div>
    );
}