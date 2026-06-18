import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Group, Task, Notification } from '../types';
import { useRouter } from 'next/router';
const Dashboard: React.FC = () => {
    const [groups, setGroups] = useState<Group[]>([]);
    const [tasks, setTasks] = useState<Task[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const { user, logout } = useAuth();
    const router = useRouter();
    useEffect(() => {
        if (!user) {
            router.push('/login');
        }
    }, [user, router]);
    useEffect(() => {
        if (user) {
            fetchData();
        }
    }, [user, selectedGroup]);
    const fetchData = async () => {
        if (!user) return;

        try {
            setLoading(true);

            // 获取用户所在的所有小组
            const groupsResponse = await fetch('/api?endpoint=groups', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            if (groupsResponse.ok) {
                const groupsData = await groupsResponse.json();
                setGroups(groupsData);

                // 如果还没有选中组，则选中第一个
                if (!selectedGroup && groupsData.length > 0) {
                    setSelectedGroup(groupsData[0].id);
                }
            }

            // 获取通知
            const notificationsResponse = await fetch('/api?endpoint=notifications', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            if (notificationsResponse.ok) {
                const notificationsData = await notificationsResponse.json();
                setNotifications(notificationsData);
            }
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleGroupChange = (groupId: string) => {
        setSelectedGroup(groupId);
    };

    return (
        <div className="dashboard">
            <header>
                <h1>Team Collaboration Board</h1>
                <div className="user-info">
                    <span>Welcome, {user.username} ({user.role})</span>
                    <button onClick={logout}>Logout</button>
                </div>
            </header>

            <main>
                <aside>
                    <h2>Your Groups</h2>
                    <div className="groups-list">
                        {groups.map(group => (
                            <div
                                key={group.id}
                                className={`group-item ${selectedGroup === group.id ? 'active' : ''}`}
                                onClick={() => handleGroupChange(group.id)}
                            >
                                <h3>{group.name}</h3>
                                <p>{group.description}</p>
                                {group.leader_name && <small>Leader: {group.leader_name}</small>}
                            </div>
                        ))}
                    </div>
                </aside>

                <section className="main-content">
                    {selectedGroup ? (
                        <GroupView groupId={selectedGroup} />
                    ) : (
                        <div>Select a group to view details</div>
                    )}
                </section>

                <aside className="notifications-panel">
                    <h2>Notifications</h2>
                    <div className="notifications-list">
                        {notifications.length > 0 ? (
                            notifications.map(notification => (
                                <div
                                    key={notification.id}
                                    className={`notification ${notification.is_read ? 'read' : 'unread'}`}
                                >
                                    <h4>{notification.title}</h4>
                                    <p>{notification.content}</p>
                                    <small>From: {notification.sender_name} | {new Date(notification.created_at).toLocaleString()}</small>
                                </div>
                            ))
                        ) : (
                            <p>No notifications</p>
                        )}
                    </div>
                </aside>
            </main>
        </div>
    );
};

interface GroupViewProps {
    groupId: string;
}

const GroupView: React.FC<GroupViewProps> = ({ groupId }) => {
    const { user } = useAuth();
    const [tasks, setTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);
    const [newTask, setNewTask] = useState({ title: '', description: '', assignedTo: '', dueDate: '', priority: 'medium' });

    useEffect(() => {
        fetchTasks();
    }, [groupId]);

    const fetchTasks = async () => {
        try {
            setLoading(true);
            const response = await fetch(`/api?endpoint=tasks&groupId=${groupId}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });

            if (response.ok) {
                const tasksData = await response.json();
                setTasks(tasksData);
            }
        } catch (error) {
            console.error('Error fetching tasks:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateTask = async (e: React.FormEvent) => {
        e.preventDefault();

        const response = await fetch('/api?endpoint=tasks', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
                title: newTask.title,
                description: newTask.description,
                groupId: groupId,
                assignedTo: newTask.assignedTo || null,
                dueDate: newTask.dueDate || null,
                priority: newTask.priority
            })
        });

        if (response.ok) {
            const createdTask = await response.json();
            setTasks([createdTask, ...tasks]);
            setNewTask({ title: '', description: '', assignedTo: '', dueDate: '', priority: 'medium' });
        } else {
            alert('Failed to create task');
        }
    };

    if (loading) return <div>Loading...</div>;

    return (
        <div className="group-view">
            <h2>Tasks</h2>

            {(user?.role === 'leader' || user?.role === 'admin') && (
                <form onSubmit={handleCreateTask} className="create-task-form">
                    <h3>Create New Task</h3>
                    <input
                        type="text"
                        placeholder="Task title"
                        value={newTask.title}
                        onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                        required
                    />
                    <textarea
                        placeholder="Task description"
                        value={newTask.description}
                        onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                    />
                    <select
                        value={newTask.assignedTo}
                        onChange={(e) => setNewTask({ ...newTask, assignedTo: e.target.value })}
                    >
                        <option value="">Assign to...</option>
                        {/* 在实际应用中，这里应该从API获取小组成员列表 */}
                        <option value="">Unassigned</option>
                    </select>
                    <input
                        type="date"
                        value={newTask.dueDate}
                        onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                    />
                    <select
                        value={newTask.priority}
                        onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                    >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                    </select>
                    <button type="submit">Create Task</button>
                </form>
            )}

            <div className="tasks-board">
                <div className="task-column">
                    <h3>To Do</h3>
                    {tasks.filter(t => t.status === 'todo').map(task => (
                        <TaskCard key={task.id} task={task} />
                    ))}
                </div>
                <div className="task-column">
                    <h3>In Progress</h3>
                    {tasks.filter(t => t.status === 'in-progress').map(task => (
                        <TaskCard key={task.id} task={task} />
                    ))}
                </div>
                <div className="task-column">
                    <h3>Review</h3>
                    {tasks.filter(t => t.status === 'review').map(task => (
                        <TaskCard key={task.id} task={task} />
                    ))}
                </div>
                <div className="task-column">
                    <h3>Done</h3>
                    {tasks.filter(t => t.status === 'done').map(task => (
                        <TaskCard key={task.id} task={task} />
                    ))}
                </div>
            </div>
        </div>
    );
};

interface TaskCardProps {
    task: Task;
}

const TaskCard: React.FC<TaskCardProps> = ({ task }) => {
    const [showDetails, setShowDetails] = useState(false);

    return (
        <div className="task-card">
            <div className="task-header" onClick={() => setShowDetails(!showDetails)}>
                <h4>{task.title}</h4>
                <span className={`priority ${task.priority}`}>{task.priority}</span>
            </div>
            {showDetails && (
                <div className="task-details">
                    <p><strong>Description:</strong> {task.description}</p>
                    <p><strong>Assigned to:</strong> {task.assignee_name || 'Unassigned'}</p>
                    <p><strong>Created by:</strong> {task.creator_name}</p>
                    <p><strong>Status:</strong> {task.status}</p>
                    {task.due_date && <p><strong>Due:</strong> {new Date(task.due_date).toLocaleDateString()}</p>}
                </div>
            )}
        </div>
    );
};

export default Dashboard;