export interface User {
    id: string;
    username: string;
    email: string;
    role: 'admin' | 'leader' | 'member';
}

export interface Group {
    id: string;
    name: string;
    description?: string;
    admin_id: string;
    leader_id?: string;
    admin_name?: string;
    leader_name?: string;
    created_at: string;
}

export interface Task {
    id: string;
    title: string;
    description?: string;
    status: 'todo' | 'in-progress' | 'review' | 'done';
    priority: 'low' | 'medium' | 'high';
    assigned_to?: string;
    assignee_name?: string;
    group_id: string;
    creator_id: string;
    creator_name?: string;
    due_date?: string;
    created_at: string;
    updated_at: string;
}

export interface Notification {
    id: string;
    title: string;
    content: string;
    type: 'info' | 'warning' | 'error' | 'task' | 'notification';
    group_id: string;
    sender_id: string;
    sender_name?: string;
    recipient_id: string;
    is_read: boolean;
    created_at: string;
}

export interface AuthContextType {
    user: User | null;
    login: (username: string, password: string) => Promise<boolean>;
    logout: () => void;
    register: (username: string, email: string, password: string) => Promise<boolean>;
}