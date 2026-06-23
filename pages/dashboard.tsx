import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useRouter } from 'next/router'

export default function Dashboard() {
    const { user } = useAuth()
    const router = useRouter()
    const [initReady, setInitReady] = useState(false)
    const [showSelector, setShowSelector] = useState(false)

    useEffect(() => {
        const timer = setTimeout(() => setInitReady(true), 100)
        return () => clearTimeout(timer)
    }, [])

    useEffect(() => {
        if (!initReady || router.pathname !== '/dashboard') return

        if (!user) {
            router.push('/login')
            return
        }
        
        // 如果用户直接访问dashboard，显示角色选择界面
        setShowSelector(true)
    }, [user, router, initReady])

    const navigateToRolePage = (role: string) => {
        switch (role) {
            case 'admin':
                router.push('/admin')
                break
            case 'leader':
                router.push('/group-leader')
                break
            default:
                router.push('/member-dashboard')
        }
    }

    if (!initReady) {
        return (
            <div className="p-10 text-center text-lg text-gray-600">
                正在加载...
            </div>
        )
    }

    if (!user) {
        return (
            <div className="p-10 text-center text-lg text-gray-600">
                请先登录
            </div>
        )
    }

    if (showSelector) {
        return (
            <div className="min-h-screen bg-gradient-dashboard flex items-center justify-center">
                <div className="bg-white/95 backdrop-blur-lg rounded-2xl shadow-2xl p-8 w-full max-w-md animate-scale-in">
                    <h2 className="text-center text-2xl font-bold text-gray-800 mb-6">选择工作台</h2>
                    
                    <div className="space-y-4">
                        {user.role === 'admin' && (
                            <button
                                onClick={() => navigateToRolePage('admin')}
                                className="w-full py-4 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-semibold hover:from-red-600 hover:to-red-700 transition-all duration-200 shadow-lg hover:shadow-xl"
                            >
                                🔧 管理员面板
                            </button>
                        )}
                        
                        {(user.role === 'admin' || user.role === 'leader') && (
                            <button
                                onClick={() => navigateToRolePage('leader')}
                                className="w-full py-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-semibold hover:from-blue-600 hover:to-blue-700 transition-all duration-200 shadow-lg hover:shadow-xl"
                            >
                                📊 组长管理后台
                            </button>
                        )}
                        
                        <button
                            onClick={() => navigateToRolePage('member')}
                            className="w-full py-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-semibold hover:from-green-600 hover:to-green-700 transition-all duration-200 shadow-lg hover:shadow-xl"
                        >
                            ✅ 成员任务看板
                        </button>
                    </div>

                    <p className="mt-6 text-center text-sm text-gray-500">
                        当前用户: {user.username} | 角色: {user.role}
                    </p>
                </div>
            </div>
        )
    }

    return (
        <div className="p-10 text-center text-lg text-gray-600">
            正在根据你的身份跳转对应工作台...
        </div>
    )
}