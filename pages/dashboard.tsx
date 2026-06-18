import { useEffect } from 'react'
import { useAuth } from '../context/AuthContext'
import { useRouter } from 'next/router'

export default function Dashboard() {
    const { user } = useAuth()
    const router = useRouter()

    useEffect(() => {
        // 单独封装异步跳转逻辑，不return promise
        const redirect = async () => {
            if (!user) {
                await router.push('/login')
                return
            }
            if (user.role === 'admin') {
                await router.push('/admin')
            } else if (user.role === 'leader') {
                await router.push('/group-leader')
            } else {
                await router.push('/member-dashboard')
            }
        }
        redirect()
    }, [user, router])

    return <div className="p-10 text-center">页面跳转中...</div>
}