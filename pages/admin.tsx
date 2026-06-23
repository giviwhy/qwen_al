import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { Group, User } from '../types';
import { useRouter } from 'next/router';
import NotifyBell from '../components/NotifyBell';

const AdminPanel: React.FC = () => {
    const [groups, setGroups] = useState<Group[]>([]);
    const [allUserList, setAllUserList] = useState<User[]>([]);
    const [currentGroupMembers, setCurrentGroupMembers] = useState<User[]>([]);
    const [allOccupiedUserIds, setAllOccupiedUserIds] = useState<string[]>([]);
    const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const { user, logout } = useAuth();
    const router = useRouter();

    const [toast, setToast] = useState<{ show: boolean; msg: string; type: 'success' | 'error' }>({
        show: false, msg: '', type: 'success',
    });

    const [showCreateGroup, setShowCreateGroup] = useState(false);
    const [newGroupForm, setNewGroupForm] = useState({ name: '', description: '' });
    const [editGroupId, setEditGroupId] = useState<string | null>(null);
    const [editGroupForm, setEditGroupForm] = useState({ name: '', description: '' });
    const [memberPanelId, setMemberPanelId] = useState<string | null>(null);

    const [showGlobalNotice, setShowGlobalNotice] = useState(false);
    const [globalNoticeForm, setGlobalNoticeForm] = useState({ title: '', content: '' });

    const [multiAddUserIds, setMultiAddUserIds] = useState<string[]>([]);
    const [targetLeaderId, setTargetLeaderId] = useState<string>('');

    const authFetch = async (url: string, options: RequestInit = {}) => {
        const token = localStorage.getItem('token');
        const res = await fetch(url, {
            ...options,
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
                ...options.headers
            }
        });
        if (res.status === 401) logout();
        return res;
    };

    useEffect(() => {
        if (!router.isReady) return;
        const init = async () => {
            setLoading(true);
            if (!user) {
                router.push('/login');
            } else if (user.role !== 'admin') {
                router.push('/dashboard');
            }
            await fetchAllData();
            setLoading(false);
        };
        init();
    }, [user, router.isReady]);

    // 监听选中小组变化，获取该小组的成员
    useEffect(() => {
        if (selectedGroup && memberPanelId) {
            fetchCurrentGroupMember(selectedGroup);
        }
    }, [selectedGroup, memberPanelId]);

    const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ show: true, msg, type });
        setTimeout(() => setToast(p => ({ ...p, show: false })), 3000);
    };

    // 使用综合API一次性获取所有数据
    const fetchAllData = useCallback(async () => {
        try {
            const res = await authFetch('/api/admin/dashboard-data');
            if (res.ok) {
                const json = await res.json();
                if (json.success) {
                    const { groups: fetchedGroups, users, occupiedUserIds } = json.data;
                    setGroups(fetchedGroups);
                    setAllUserList(users);
                    setAllOccupiedUserIds(occupiedUserIds);
                    // 如果没有选中小组且有小组数据，默认选中第一个
                    if (!selectedGroup && fetchedGroups.length > 0) {
                        setSelectedGroup(fetchedGroups[0].id);
                    }
                }
            }
        } catch (err) {
            showToast('数据加载失败', 'error');
        }
    }, [selectedGroup]);

    const fetchCurrentGroupMember = async (gid: string) => {
        const res = await authFetch(`/api/group-members?groupId=${gid}`);
        if (res.ok) {
            const json = await res.json();
            setCurrentGroupMembers(json.data || []);
        }
    };

    const getGlobalLeaderIds = () => {
        return groups.map(g => g.leader_id).filter(Boolean) as string[];
    };

    // 使用 useMemo 缓存计算值，避免不必要的重新渲染
    const availableAddUsers = useMemo(() => {
        return allUserList.filter(u => !allOccupiedUserIds.includes(u.id));
    }, [allUserList, allOccupiedUserIds]);

    const availableLeaderCandidates = useMemo(() => {
        const leaderIds = getGlobalLeaderIds();
        return currentGroupMembers.filter(u => !leaderIds.includes(u.id));
    }, [currentGroupMembers, groups]);

    const toggleMultiAddUser = (uid: string) => {
        if (multiAddUserIds.includes(uid)) {
            setMultiAddUserIds(multiAddUserIds.filter(id => id !== uid));
        } else {
            setMultiAddUserIds([...multiAddUserIds, uid]);
        }
    };

    // 批量添加组员 - 直接更新状态，不重新加载所有数据
    const batchAddMembers = async (groupId: string) => {
        if (multiAddUserIds.length === 0) return showToast('请至少选择一名用户', 'error');
        const res = await authFetch('/api/group/batch-add-member', {
            method: 'POST',
            body: JSON.stringify({ groupId, userIds: multiAddUserIds })
        });
        if (res.ok) {
            // 直接更新当前小组成员列表
            const addedUsers = allUserList.filter(u => multiAddUserIds.includes(u.id));
            setCurrentGroupMembers(prev => [...prev, ...addedUsers.map(u => ({ ...u, is_leader: false }))]);
            // 更新已占用用户ID列表
            setAllOccupiedUserIds(prev => [...prev, ...multiAddUserIds]);
            // 清空选中状态
            setMultiAddUserIds([]);
            showToast('批量添加组员成功');
        } else {
            showToast('添加失败，用户已存在或参数错误', 'error');
        }
    };

    // 移除单个组员 - 直接更新状态，不重新加载所有数据
    const removeSingleMember = async (groupId: string, uid: string) => {
        if (!confirm('确定将该用户移出小组？')) return;
        const res = await authFetch('/api/group/remove-member', {
            method: 'POST',
            body: JSON.stringify({ groupId, userId: uid })
        });
        if (res.ok) {
            // 直接更新当前小组成员列表
            setCurrentGroupMembers(prev => prev.filter(u => u.id !== uid));
            // 更新已占用用户ID列表
            setAllOccupiedUserIds(prev => prev.filter(id => id !== uid));
            showToast('组员已移出小组');
        } else {
            showToast('移除失败', 'error');
        }
    };

    // 设置组长 - 直接更新状态，不重新加载所有数据
    const setGroupLeader = async (groupId: string) => {
        if (!targetLeaderId) return showToast('请选择一名组员作为组长', 'error');
        try {
            const res = await authFetch('/api/group/set-leader', {
                method: 'PUT',
                body: JSON.stringify({ groupId, newLeaderId: targetLeaderId })
            });
            const json = await res.json();
            if (!json.success) return showToast(json.msg || '设置组长失败', 'error');

            // 获取被任命为组长的用户名
            const leaderUser = currentGroupMembers.find(u => u.id === targetLeaderId);

            // 直接更新小组列表中的组长信息
            setGroups(prev => prev.map(g =>
                g.id === groupId
                    ? { ...g, leader_id: targetLeaderId, leader_name: leaderUser?.username }
                    : g
            ));
            // 直接更新当前小组成员列表
            setCurrentGroupMembers(prev => prev.map(u =>
                u.id === targetLeaderId
                    ? { ...u, is_leader: true }
                    : { ...u, is_leader: false }
            ));
            setTargetLeaderId('');
            showToast('组长设置完成');
        } catch (err) {
            showToast('网络请求异常', 'error');
        }
    };

    // 创建小组 - 直接添加到列表，不重新加载所有数据
    const submitCreateGroup = async () => {
        const res = await authFetch('/api/create-group', {
            method: 'POST',
            body: JSON.stringify(newGroupForm)
        });
        if (res.ok) {
            const json = await res.json();
            if (json.success) {
                // 直接将新小组添加到列表
                const newGroup: Group = {
                    id: json.data.id,
                    name: newGroupForm.name,
                    description: newGroupForm.description,
                    leader_id: null,
                    leader_name: null,
                    admin_id: user?.id || '',
                    created_at: new Date().toISOString()
                };
                setGroups(prev => [newGroup, ...prev]);
                setSelectedGroup(json.data.id);
                setShowCreateGroup(false);
                setNewGroupForm({ name: '', description: '' });
                showToast('小组创建成功');
            } else {
                showToast(json.msg || '创建失败', 'error');
            }
        } else {
            showToast('创建失败', 'error');
        }
    };

    // 保存编辑小组 - 直接更新列表，不重新加载所有数据
    const saveEditGroup = async (gid: string) => {
        const res = await authFetch(`/api/group/${gid}`, {
            method: 'PUT',
            body: JSON.stringify(editGroupForm)
        });
        if (res.ok) {
            // 直接更新小组列表中的信息
            setGroups(prev => prev.map(g =>
                g.id === gid
                    ? { ...g, name: editGroupForm.name, description: editGroupForm.description }
                    : g
            ));
            setEditGroupId(null);
            showToast('小组信息更新成功');
        } else {
            showToast('更新失败', 'error');
        }
    };

    // 删除小组 - 直接从列表移除，不重新加载所有数据
    const deleteGroup = async (gid: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('确定删除该小组？小组内关联数据将清空')) return;

        const res = await authFetch(`/api/group/${gid}`, { method: 'DELETE' });
        if (res.ok) {
            // 从列表中移除该小组
            setGroups(prev => prev.filter(g => g.id !== gid));
            // 如果删除的是当前选中的小组，清空选中状态
            if (selectedGroup === gid) {
                setSelectedGroup(groups.length > 1 ? groups.find(g => g.id !== gid)?.id || null : null);
            }
            showToast('小组已删除');
        } else {
            showToast('删除失败', 'error');
        }
    };

    const sendGlobalNotice = async () => {
        const res = await authFetch('/api/admin/publish-notify', {
            method: 'POST',
            body: JSON.stringify(globalNoticeForm)
        });
        if (res.ok) {
            setShowGlobalNotice(false);
            setGlobalNoticeForm({ title: '', content: '' });
            showToast('全站公告发送成功');
        } else showToast('公告发送失败', 'error');
    };

    const clearAllData = async () => {
        if (!confirm('⚠️ 警告：此操作将清空所有数据（用户、小组、任务、通知等），且不可恢复！\n\n确定要继续吗？')) {
            return;
        }

        if (!confirm('⚠️ 再次确认：所有数据将被永久删除！\n\n确定要清空吗？')) {
            return;
        }

        try {
            const res = await authFetch('/api/admin/clear-data', { method: 'POST' });
            const json = await res.json();
            if (json.success) {
                showToast(`数据库已清空！\n\n管理员账号已自动重新创建：\n用户名：${json.admin.username}\n密码：${json.admin.password}\n\n请重新登录`, 'success');
                setTimeout(() => {
                    logout();
                    router.push('/login');
                }, 5000);
            } else {
                showToast(json.msg || '清空失败', 'error');
            }
        } catch (err) {
            showToast('网络请求异常', 'error');
        }
    };

    const handleGroupChange = (gid: string) => {
        // 只有当点击的不是当前memberPanel对应的卡片时才切换选中状态
        if (selectedGroup !== gid) {
            setSelectedGroup(gid);
        }
    };

    const openMemberPanel = (gid: string) => {
        setMemberPanelId(gid);
        if (selectedGroup !== gid) {
            setSelectedGroup(gid);
        }
    };

    if (loading || !router.isReady) return (
        <div className="min-h-screen bg-gradient-dashboard flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-lg text-gray-600 font-medium">管理员面板加载中...</p>
            </div>
        </div>
    );
    if (!user || user.role !== 'admin') return null;

    return (
        <div className="min-h-screen bg-gradient-dashboard">
            {toast.show && (
                <div className={`fixed top-6 right-6 px-6 py-3 rounded-xl font-medium shadow-lg z-50 animate-slide-up ${toast.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
                    }`}>
                    {toast.msg}
                </div>
            )}

            <header className="bg-gradient-to-r from-slate-800 to-slate-700 shadow-lg">
                <div className="max-w-7xl mx-auto px-6 py-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                </div>
                                <div>
                                    <h1 className="text-xl font-bold text-white">管理员后台管理面板</h1>
                                    <p className="text-sm text-white/70">统一管理全部小组、成员与全站公告</p>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <NotifyBell />
                            <button
                                onClick={clearAllData}
                                className="px-4 py-2 bg-orange-500/80 hover:bg-orange-500 text-white rounded-lg transition-all duration-200 text-sm font-medium"
                            >
                                清空数据
                            </button>
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
                <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                                <svg className="w-5 h-5 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                                </svg>
                                全站公告管理
                            </h2>
                            <p className="text-sm text-gray-500 mt-1">向平台所有用户推送全局通知</p>
                        </div>
                        <button
                            onClick={() => setShowGlobalNotice(true)}
                            className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-medium hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl"
                        >
                            发布全局公告
                        </button>
                    </div>
                </div>

                {showGlobalNotice && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
                            <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-6">
                                <h3 className="text-xl font-bold text-white">发布全站公告</h3>
                            </div>
                            <div className="p-6 space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-600 mb-2">公告标题</label>
                                    <input
                                        placeholder="请输入公告标题"
                                        value={globalNoticeForm.title}
                                        onChange={e => setGlobalNoticeForm(p => ({ ...p, title: e.target.value }))}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-600 mb-2">公告内容</label>
                                    <textarea
                                        rows={5}
                                        placeholder="请输入公告内容"
                                        value={globalNoticeForm.content}
                                        onChange={e => setGlobalNoticeForm(p => ({ ...p, content: e.target.value }))}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                                    />
                                </div>
                                <div className="flex gap-3 justify-end">
                                    <button
                                        onClick={() => setShowGlobalNotice(false)}
                                        className="px-5 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-medium transition-all duration-200"
                                    >取消</button>
                                    <button
                                        onClick={sendGlobalNotice}
                                        className="px-5 py-2.5 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl font-medium transition-all duration-200 shadow-lg"
                                    >确认发送</button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div>
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h2 className="text-xl font-bold text-gray-800">全部小组管理</h2>
                            <p className="text-sm text-gray-500 mt-1">创建、编辑、删除小组，批量增减组员、指定组长</p>
                        </div>
                        <button
                            onClick={() => setShowCreateGroup(true)}
                            className="px-5 py-2.5 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-medium hover:from-green-600 hover:to-green-700 transition-all duration-200 shadow-lg hover:shadow-xl"
                        >
                            <svg className="w-5 h-5 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                            </svg>
                            新建小组
                        </button>
                    </div>

                    {showCreateGroup && (
                        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6 animate-fade-in">
                            <h3 className="text-lg font-semibold text-gray-800 mb-4">创建新小组</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-600 mb-2">小组名称</label>
                                    <input
                                        placeholder="小组名称"
                                        value={newGroupForm.name}
                                        onChange={e => setNewGroupForm(p => ({ ...p, name: e.target.value }))}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-600 mb-2">小组描述（选填）</label>
                                    <textarea
                                        rows={3}
                                        placeholder="小组描述"
                                        value={newGroupForm.description}
                                        onChange={e => setNewGroupForm(p => ({ ...p, description: e.target.value }))}
                                        className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all resize-none"
                                    />
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={submitCreateGroup}
                                        className="px-5 py-2.5 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white rounded-xl font-medium transition-all duration-200 shadow-lg"
                                    >确认创建</button>
                                    <button
                                        onClick={() => setShowCreateGroup(false)}
                                        className="px-5 py-2.5 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-medium transition-all duration-200"
                                    >取消</button>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {groups?.map(group => (
                            <div
                                key={group.id}
                                className={`bg-white rounded-2xl shadow-lg p-6 border-2 transition-all duration-200 hover:shadow-xl hover:-translate-y-1 ${selectedGroup === group.id ? 'border-primary-500' : 'border-transparent'
                                    }`}
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <h3 className="text-lg font-semibold text-gray-800">{group.name}</h3>
                                    {group.leader_name && (
                                        <span className="px-2 py-1 bg-primary-100 text-primary-700 text-xs font-medium rounded-full">
                                            组长
                                        </span>
                                    )}
                                </div>
                                <p className="text-sm text-gray-500 mb-4 min-h-[40px]">{group.description || '暂无小组描述'}</p>
                                <p className="text-sm text-gray-600 mb-4">组长：<span className="text-primary-600 font-medium">{group?.leader_name ?? '未设置'}</span></p>

                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={() => {
                                            setEditGroupId(group.id);
                                            setEditGroupForm({ name: group.name, description: group.description || '' });
                                        }}
                                        className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium transition-all duration-200"
                                    >编辑小组</button>
                                    <button
                                        onClick={(e) => deleteGroup(group.id, e)}
                                        className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg text-sm font-medium transition-all duration-200"
                                    >删除小组</button>
                                    <button
                                        onClick={() => openMemberPanel(group.id)}
                                        className="px-4 py-2 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg text-sm font-medium transition-all duration-200"
                                    >组员管理</button>
                                </div>

                                {editGroupId === group.id && (
                                    <div className="mt-4 p-4 bg-gray-50 rounded-xl">
                                        <h4 className="font-semibold text-gray-700 mb-3">编辑小组信息</h4>
                                        <input
                                            value={editGroupForm.name}
                                            onChange={e => setEditGroupForm(p => ({ ...p, name: e.target.value }))}
                                            className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent mb-3"
                                        />
                                        <textarea
                                            rows={2}
                                            value={editGroupForm.description}
                                            onChange={e => setEditGroupForm(p => ({ ...p, description: e.target.value }))}
                                            className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent mb-4 resize-none"
                                        />
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => saveEditGroup(group.id)}
                                                className="px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium transition-all duration-200"
                                            >保存修改</button>
                                            <button
                                                onClick={() => setEditGroupId(null)}
                                                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-medium transition-all duration-200"
                                            >取消</button>
                                        </div>
                                    </div>
                                )}

                                {memberPanelId === group.id && (
                                    <div className="mt-4 p-4 bg-gray-50 rounded-xl space-y-4">
                                        <h4 className="font-semibold text-gray-700">组员权限管理</h4>

                                        <div>
                                            <p className="text-sm text-gray-600 mb-2">批量添加组员（仅未加入任何小组用户可选）</p>
                                            <div className="max-h-[120px] overflow-y-auto bg-white border border-gray-200 rounded-lg p-3">
                                                {availableAddUsers.length === 0
                                                    ? <p className="text-gray-400 text-sm text-center py-4">暂无可添加用户，所有用户已分配至小组</p>
                                                    : availableAddUsers.map(u => (
                                                        <label key={u.id} className="flex items-center gap-2 py-1 cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={multiAddUserIds.includes(u.id)}
                                                                onChange={() => toggleMultiAddUser(u.id)}
                                                            />
                                                            <span className="text-sm text-gray-700">{u.username}</span>
                                                        </label>
                                                    ))
                                                }
                                            </div>
                                            <button
                                                onClick={() => batchAddMembers(group.id)}
                                                className="w-full mt-3 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg text-sm font-medium transition-all duration-200"
                                            >确认批量添加选中用户</button>
                                        </div>

                                        <div>
                                            <p className="text-sm text-gray-600 mb-2">本小组现有成员（可移出）</p>
                                            <div className="max-h-[120px] overflow-y-auto bg-white border border-gray-200 rounded-lg p-3">
                                                {currentGroupMembers.length === 0
                                                    ? <p className="text-gray-400 text-sm text-center py-4">小组暂无成员</p>
                                                    : currentGroupMembers.map(u => (
                                                        <div key={u.id} className="flex items-center justify-between py-1">
                                                            <span className="text-sm text-gray-700">
                                                                {u.username}
                                                                {group.leader_id === u.id && <span className="ml-2 text-xs text-primary-600">(组长)</span>}
                                                            </span>
                                                            <button
                                                                onClick={() => removeSingleMember(group.id, u.id)}
                                                                className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-600 rounded text-xs font-medium transition-all duration-200"
                                                            >移出</button>
                                                        </div>
                                                    ))
                                                }
                                            </div>
                                        </div>

                                        <div>
                                            <p className="text-sm text-gray-600 mb-2">设置本组组长（已担任其他小组组长的用户不可选）</p>
                                            <select
                                                value={targetLeaderId}
                                                onChange={e => setTargetLeaderId(e.target.value)}
                                                className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent mb-3"
                                            >
                                                <option value="">-- 选择组员作为本组组长 --</option>
                                                {availableLeaderCandidates.map(u => (
                                                    <option key={u.id} value={u.id}>{u.username}</option>
                                                ))}
                                            </select>
                                            <button
                                                onClick={() => setGroupLeader(group.id)}
                                                className="w-full py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg text-sm font-medium transition-all duration-200"
                                            >确认设为本组组长</button>
                                        </div>

                                        <button
                                            onClick={() => setMemberPanelId(null)}
                                            className="w-full py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-lg text-sm font-medium transition-all duration-200"
                                        >关闭管理面板</button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {groups?.length === 0 && (
                        <div className="text-center py-12 text-gray-500">
                            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
                            </svg>
                            <p className="text-lg">暂无任何小组</p>
                            <p className="text-sm">点击上方「新建小组」创建第一个小组</p>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default AdminPanel;