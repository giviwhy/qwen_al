import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Group, User } from '../types';
import { useRouter } from 'next/router';

const AdminPanel: React.FC = () => {
    const [groups, setGroups] = useState<Group[]>([]);
    const [allUserList, setAllUserList] = useState<User[]>([]);
    const [currentGroupMembers, setCurrentGroupMembers] = useState<User[]>([]);
    const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const { user, logout } = useAuth();
    const router = useRouter();

    // Toast 提示弹窗
    const [toast, setToast] = useState<{ show: boolean; msg: string; type: 'success' | 'error' }>({
        show: false, msg: '', type: 'success',
    });

    // 小组操作弹窗状态
    const [showCreateGroup, setShowCreateGroup] = useState(false);
    const [newGroupForm, setNewGroupForm] = useState({ name: '', description: '' });
    const [editGroupId, setEditGroupId] = useState<string | null>(null);
    const [editGroupForm, setEditGroupForm] = useState({ name: '', description: '' });
    const [memberPanelId, setMemberPanelId] = useState<string | null>(null);

    // 全站公告弹窗
    const [showGlobalNotice, setShowGlobalNotice] = useState(false);
    const [globalNoticeForm, setGlobalNoticeForm] = useState({ title: '', content: '' });

    // 带Token请求封装
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

    // 权限校验：非管理员强制跳转
    useEffect(() => {
        if (!router.isReady) return;
        setLoading(true);
        if (!user) {
            router.push('/login');
        } else if (user.role !== 'admin') {
            router.push('/dashboard');
        } else {
            fetchAllData();
        }
        setLoading(false);
    }, [user, router.isReady]);

    // 切换小组自动加载组员
    useEffect(() => {
        if (selectedGroup) fetchCurrentGroupMember(selectedGroup);
        else setCurrentGroupMembers([]);
    }, [selectedGroup]);

    // 消息提示
    const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
        setToast({ show: true, msg, type });
        setTimeout(() => setToast(p => ({ ...p, show: false })), 3000);
    };

    // 加载全部小组、全部系统用户
    const fetchAllData = async () => {
        try {
            const groupRes = await authFetch('/api/groups');
            if (groupRes.ok) {
                const json = await groupRes.json();
                const list = json.data || [];
                setGroups(list);
                if (!selectedGroup && list.length > 0) setSelectedGroup(list[0].id);
            }
            const userRes = await authFetch('/api/users');
            if (userRes.ok) {
                const json = await userRes.json();
                setAllUserList(json.data || []);
            }
        } catch (err) {
            showToast('数据加载失败', 'error');
        }
    };

    // 获取选中小组内成员
    const fetchCurrentGroupMember = async (gid: string) => {
        const res = await authFetch(`/api/group-members?groupId=${gid}`);
        if (res.ok) {
            const json = await res.json();
            setCurrentGroupMembers(json.data || []);
        }
    };

    // 新建小组
    const submitCreateGroup = async () => {
        const res = await authFetch('/api/create-group', {
            method: 'POST',
            body: JSON.stringify(newGroupForm)
        });
        if (res.ok) {
            fetchAllData();
            setShowCreateGroup(false);
            setNewGroupForm({ name: '', description: '' });
            showToast('小组创建成功');
        } else showToast('创建失败', 'error');
    };

    // 保存编辑小组
    const saveEditGroup = async (gid: string) => {
        const res = await authFetch(`/api/group/${gid}`, {
            method: 'PUT',
            body: JSON.stringify(editGroupForm)
        });
        if (res.ok) {
            fetchAllData();
            setEditGroupId(null);
            showToast('小组信息更新成功');
        } else showToast('更新失败', 'error');
    };

    // 删除小组
    const deleteGroup = async (gid: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!confirm('确定删除该小组？小组内关联数据将清空')) return;
        const res = await authFetch(`/api/group/${gid}`, { method: 'DELETE' });
        if (res.ok) {
            if (selectedGroup === gid) setSelectedGroup(null);
            fetchAllData();
            showToast('小组已删除');
        } else showToast('删除失败', 'error');
    };

    // 向小组添加用户
    const addGroupMember = async (groupId: string, uid: string) => {
        const res = await authFetch('/api/group/add-member', {
            method: 'POST',
            body: JSON.stringify({ groupId, userId: uid })
        });
        if (res.ok) {
            await fetchCurrentGroupMember(groupId);
            await fetchAllData();
            showToast('成员添加成功');
        } else showToast('添加失败，该用户已在小组内', 'error');
    };

    // 更换小组组长
    const changeGroupLeader = async (groupId: string, uid: string) => {
        try {
            const res = await authFetch('/api/group/set-leader', {
                method: 'PUT',
                body: JSON.stringify({ groupId, newLeaderId: uid })
            });
            const json = await res.json();
            if (!json.success) return showToast(json.msg || '操作失败', 'error');
            await fetchAllData();
            await fetchCurrentGroupMember(groupId);
            showToast('组长更换完成');
        } catch () {
            showToast('网络请求异常', 'error');
        }
    };

    // 发送全站公告
    const sendGlobalNotice = async () => {
        const res = await authFetch('/api/admin/send-all-notice', {
            method: 'POST',
            body: JSON.stringify(globalNoticeForm)
        });
        if (res.ok) {
            setShowGlobalNotice(false);
            setGlobalNoticeForm({ title: '', content: '' });
            showToast('全站公告发送成功');
        } else showToast('公告发送失败', 'error');
    };

    // 切换选中小组
    const handleGroupChange = (gid: string) => {
        setSelectedGroup(gid);
        setMemberPanelId(null);
        setCurrentGroupMembers([]);
    };

    if (loading || !router.isReady) return (
        <div style={{
            minHeight: '100vh',
            background: '#f7f8fa',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '16px',
            color: '#666'
        }}>管理员管理面板加载中...</div>
    );
    if (!user || user.role !== 'admin') return null;

    return (
        <div style={{
            minHeight: '100vh',
            background: '#f7f8fa',
            padding: '24px',
            fontFamily: 'system-ui, -apple-system, sans-serif'
        }}>
            {/* 全局消息提示 */}
            {toast.show && (
                <div style={{
                    position: 'fixed',
                    top: '24px',
                    right: '24px',
                    padding: '12px 24px',
                    borderRadius: '10px',
                    color: '#fff',
                    boxShadow: '0 6px 16px rgba(0,0,0,0.12)',
                    zIndex: 9999,
                    background: toast.type === 'success' ? '#00b42a' : '#f53f3f'
                }}>
                    {toast.msg}
                </div>
            )}

            {/* 页面头部导航栏 */}
            <header style={{
                maxWidth: '1280px',
                margin: '0 auto 32px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <div>
                    <h1 style={{ margin: 0, fontSize: '24px', color: '#1d2129' }}>管理员后台管理面板</h1>
                    <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#86909c' }}>统一管理全部小组、成员与全站公告</p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button onClick={() => router.push('/dashboard')} style={{
                        padding: '8px 16px',
                        border: '1px solid #dcdfe6',
                        borderRadius: '8px',
                        background: '#fff',
                        cursor: 'pointer',
                        fontSize: '14px'
                    }}>返回任务看板</button>
                    <button onClick={logout} style={{
                        padding: '8px 16px',
                        border: 'none',
                        borderRadius: '8px',
                        background: '#f53f3f',
                        color: '#fff',
                        cursor: 'pointer',
                        fontSize: '14px'
                    }}>退出登录</button>
                </div>
            </header>

            <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
                {/* 全站公告模块 */}
                <div style={{
                    padding: '20px',
                    background: '#fff',
                    borderRadius: '12px',
                    boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                    marginBottom: '24px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                }}>
                    <div>
                        <h3 style={{ margin: 0, fontSize: '18px', color: '#1d2129' }}>全站公告管理</h3>
                        <p style={{ margin: '6px 0 0', fontSize: '14px', color: '#86909c' }}>向平台所有用户推送全局通知</p>
                    </div>
                    <button onClick={() => setShowGlobalNotice(true)} style={{
                        padding: '9px 18px',
                        border: 'none',
                        borderRadius: '8px',
                        background: '#1677ff',
                        color: '#fff',
                        cursor: 'pointer',
                        fontSize: '14px'
                    }}>发布全局公告</button>
                </div>

                {/* 公告弹窗 */}
                {showGlobalNotice && (
                    <div style={{
                        position: 'fixed',
                        inset: 0,
                        background: 'rgba(0,0,0,0.45)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        zIndex: 999
                    }}>
                        <div style={{
                            width: '480px',
                            background: '#fff',
                            borderRadius: '12px',
                            padding: '24px',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.15)'
                        }}>
                            <h3 style={{ margin: '0 0 16px', fontSize: '18px' }}>发布全站公告</h3>
                            <input
                                placeholder="请输入公告标题"
                                value={globalNoticeForm.title}
                                onChange={e => setGlobalNoticeForm(p => ({ ...p, title: e.target.value }))}
                                style={{
                                    width: '100%',
                                    boxSizing: 'border-box',
                                    padding: '10px 12px',
                                    border: '1px solid #dcdfe6',
                                    borderRadius: '8px',
                                    marginBottom: '12px',
                                    fontSize: '14px'
                                }}
                            />
                            <textarea
                                rows={5}
                                placeholder="请输入公告内容"
                                value={globalNoticeForm.content}
                                onChange={e => setGlobalNoticeForm(p => ({ ...p, content: e.target.value }))}
                                style={{
                                    width: '100%',
                                    boxSizing: 'border-box',
                                    padding: '10px 12px',
                                    border: '1px solid #dcdfe6',
                                    borderRadius: '8px',
                                    marginBottom: '20px',
                                    fontSize: '14px',
                                    resize: 'none'
                                }}
                            />
                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                <button onClick={() => setShowGlobalNotice(false)} style={{
                                    padding: '8px 16px',
                                    border: '1px solid #dcdfe6',
                                    borderRadius: '8px',
                                    background: '#fff',
                                    cursor: 'pointer'
                                }}>取消</button>
                                <button onClick={sendGlobalNotice} style={{
                                    padding: '8px 16px',
                                    border: 'none',
                                    borderRadius: '8px',
                                    background: '#1677ff',
                                    color: '#fff',
                                    cursor: 'pointer'
                                }}>确认发送</button>
                            </div>
                        </div>
                    </div>
                )}

                {/* 小组管理区域 */}
                <div>
                    <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '16px'
                    }}>
                        <div>
                            <h2 style={{ margin: 0, fontSize: '20px', color: '#1d2129' }}>全部小组管理</h2>
                            <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#86909c' }}>创建、编辑、删除小组，分配组员与组长权限</p>
                        </div>
                        <button onClick={() => setShowCreateGroup(true)} style={{
                            padding: '9px 18px',
                            border: 'none',
                            borderRadius: '8px',
                            background: '#00b42a',
                            color: '#fff',
                            cursor: 'pointer',
                            fontSize: '14px'
                        }}>+ 新建小组</button>
                    </div>

                    {/* 新建小组弹窗 */}
                    {showCreateGroup && (
                        <div style={{
                            background: '#fff',
                            padding: '20px',
                            borderRadius: '12px',
                            boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                            marginBottom: '20px'
                        }}>
                            <h4 style={{ margin: '0 0 16px', fontSize: '16px' }}>创建新小组</h4>
                            <input
                                placeholder="小组名称"
                                value={newGroupForm.name}
                                onChange={e => setNewGroupForm(p => ({ ...p, name: e.target.value }))}
                                style={{
                                    width: '100%',
                                    boxSizing: 'border-box',
                                    padding: '10px 12px',
                                    border: '1px solid #dcdfe6',
                                    borderRadius: '8px',
                                    marginBottom: '12px',
                                    fontSize: '14px'
                                }}
                            />
                            <textarea
                                rows={3}
                                placeholder="小组描述（选填）"
                                value={newGroupForm.description}
                                onChange={e => setNewGroupForm(p => ({ ...p, description: e.target.value }))}
                                style={{
                                    width: '100%',
                                    boxSizing: 'border-box',
                                    padding: '10px 12px',
                                    border: '1px solid #dcdfe6',
                                    borderRadius: '8px',
                                    marginBottom: '16px',
                                    fontSize: '14px',
                                    resize: 'none'
                                }}
                            />
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button onClick={submitCreateGroup} style={{
                                    padding: '8px 16px',
                                    border: 'none',
                                    borderRadius: '8px',
                                    background: '#00b42a',
                                    color: '#fff',
                                    cursor: 'pointer'
                                }}>确认创建</button>
                                <button onClick={() => setShowCreateGroup(false)} style={{
                                    padding: '8px 16px',
                                    border: '1px solid #dcdfe6',
                                    borderRadius: '8px',
                                    background: '#fff',
                                    cursor: 'pointer'
                                }}>取消</button>
                            </div>
                        </div>
                    )}

                    {/* 小组卡片网格 */}
                    <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                        gap: '20px'
                    }}>
                        {groups?.map(group => (
                            <div key={group.id} onClick={() => handleGroupChange(group.id)} style={{
                                background: '#fff',
                                padding: '20px',
                                borderRadius: '12px',
                                boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                                border: selectedGroup === group.id ? '1px solid #1677ff' : '1px solid transparent',
                                cursor: 'pointer',
                                transition: 'transform 0.2s ease',
                            }}
                                onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-4px)')}
                                onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                            >
                                <h3 style={{ margin: '0 0 8px', fontSize: '17px', color: '#1d2129' }}>{group.name}</h3>
                                <p style={{
                                    margin: '0 0 10px',
                                    fontSize: '14px',
                                    color: '#86909c',
                                    minHeight: '40px'
                                }}>{group.description || '暂无小组描述'}</p>
                                <p style={{ margin: '0 0 16px', fontSize: '14px' }}>组长：<span style={{ color: '#1677ff' }}>{group?.leader_name ?? '未设置'}</span></p>

                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    <button onClick={(e) => {
                                        e.stopPropagation();
                                        setEditGroupId(group.id);
                                        setEditGroupForm({ name: group.name, description: group.description || '' });
                                    }} style={{
                                        fontSize: '13px',
                                        padding: '6px 12px',
                                        border: '1px solid #dcdfe6',
                                        borderRadius: '6px',
                                        background: '#fff',
                                        cursor: 'pointer'
                                    }}>编辑小组</button>
                                    <button onClick={(e) => deleteGroup(group.id, e)} style={{
                                        fontSize: '13px',
                                        padding: '6px 12px',
                                        border: 'none',
                                        borderRadius: '6px',
                                        background: '#f53f3f',
                                        color: '#fff',
                                        cursor: 'pointer'
                                    }}>删除小组</button>
                                    <button onClick={(e) => {
                                        e.stopPropagation();
                                        setMemberPanelId(group.id);
                                        fetchCurrentGroupMember(group.id);
                                    }} style={{
                                        fontSize: '13px',
                                        padding: '6px 12px',
                                        border: 'none',
                                        borderRadius: '6px',
                                        background: '#00b42a',
                                        color: '#fff',
                                        cursor: 'pointer'
                                    }}>组员管理</button>
                                </div>

                                {/* 编辑小组面板 */}
                                {editGroupId === group.id && (
                                    <div onClick={e => e.stopPropagation()} style={{
                                        marginTop: '16px',
                                        padding: '16px',
                                        background: '#f7f8fa',
                                        borderRadius: '10px'
                                    }}>
                                        <h5 style={{ margin: '0 0 12px', fontSize: '15px' }}>编辑小组信息</h5>
                                        <input
                                            value={editGroupForm.name}
                                            onChange={e => setEditGroupForm(p => ({ ...p, name: e.target.value }))}
                                            style={{
                                                width: '100%',
                                                boxSizing: 'border-box',
                                                padding: '8px 10px',
                                                border: '1px solid #dcdfe6',
                                                borderRadius: '6px',
                                                marginBottom: '10px',
                                                fontSize: '14px'
                                            }}
                                        />
                                        <textarea
                                            rows={2}
                                            value={editGroupForm.description}
                                            onChange={e => setEditGroupForm(p => ({ ...p, description: e.target.value }))}
                                            style={{
                                                width: '100%',
                                                boxSizing: 'border-box',
                                                padding: '8px 10px',
                                                border: '1px solid #dcdfe6',
                                                borderRadius: '6px',
                                                marginBottom: '14px',
                                                fontSize: '14px',
                                                resize: 'none'
                                            }}
                                        />
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button onClick={() => saveEditGroup(group.id)} style={{
                                                padding: '6px 14px',
                                                border: 'none',
                                                borderRadius: '6px',
                                                background: '#1677ff',
                                                color: '#fff',
                                                cursor: 'pointer',
                                                fontSize: '13px'
                                            }}>保存修改</button>
                                            <button onClick={() => setEditGroupId(null)} style={{
                                                padding: '6px 14px',
                                                border: '1px solid #dcdfe6',
                                                borderRadius: '6px',
                                                background: '#fff',
                                                cursor: 'pointer',
                                                fontSize: '13px'
                                            }}>取消</button>
                                        </div>
                                    </div>
                                )}

                                {/* 组员管理面板 */}
                                {memberPanelId === group.id && (
                                    <div onClick={e => e.stopPropagation()} style={{
                                        marginTop: '16px',
                                        padding: '16px',
                                        background: '#f7f8fa',
                                        borderRadius: '10px'
                                    }}>
                                        <h5 style={{ margin: '0 0 12px', fontSize: '15px' }}>组员权限管理</h5>
                                        <p style={{ margin: '0 0 6px', fontSize: '13px', color: '#666' }}>添加系统用户至本小组</p>
                                        <select style={{
                                            width: '100%',
                                            padding: '8px 10px',
                                            border: '1px solid #dcdfe6',
                                            borderRadius: '6px',
                                            marginBottom: '12px',
                                            fontSize: '14px'
                                        }}
                                            onChange={ev => {
                                                const uid = ev.target.value;
                                                if (uid) addGroupMember(group.id, uid);
                                            }}>
                                            <option value="">-- 选择用户 --</option>
                                            {allUserList?.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                                        </select>

                                        <p style={{ margin: '0 0 6px', fontSize: '13px', color: '#666' }}>更换小组组长（仅本组成员）</p>
                                        <select style={{
                                            width: '100%',
                                            padding: '8px 10px',
                                            border: '1px solid #dcdfe6',
                                            borderRadius: '6px',
                                            marginBottom: '14px',
                                            fontSize: '14px'
                                        }}
                                            onChange={ev => {
                                                const uid = ev.target.value;
                                                if (uid) changeGroupLeader(group.id, uid);
                                            }}>
                                            <option value="">-- 选择组员作为组长 --</option>
                                            {currentGroupMembers?.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                                        </select>
                                        <button onClick={() => setMemberPanelId(null)} style={{
                                            width: '100%',
                                            padding: '7px',
                                            border: '1px solid #dcdfe6',
                                            borderRadius: '6px',
                                            background: '#fff',
                                            cursor: 'pointer',
                                            fontSize: '13px'
                                        }}>关闭管理面板</button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {groups?.length === 0 && (
                        <div style={{
                            padding: '60px 0',
                            textAlign: 'center',
                            color: '#86909c',
                            fontSize: '15px'
                        }}>暂无任何小组，点击上方「新建小组」创建第一个小组</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminPanel;