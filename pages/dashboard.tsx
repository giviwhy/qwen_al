import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { useRouter } from 'next/router'

export default function Dashboard() {
    const { user } = useAuth()
    const router = useRouter()
    const [initReady, setInitReady] = useState(false)

    // 等待用户状态初始化完成再跳转
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
        if (user.role === 'admin') {
            router.push('/admin')
        } else if (user.role === 'leader') {
            router.push('/group-leader')
        } else {
            router.push('/member-dashboard')
        }
    }, [user, router, initReady])

    return (
        <div className="p-10 text-center text-lg text-gray-600">
            正在根据你的身份跳转对应工作台...
        </div>
    )
}