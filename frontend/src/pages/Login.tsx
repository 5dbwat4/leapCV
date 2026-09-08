import { useState } from "react"
import { Link, useLocation, useNavigate } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { login } from "@/api"
import { apiErrorMessage } from "@/api/client"
import { useAuth } from "@/auth"
import AuthLayout from "@/components/AuthLayout"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"

const schema = z.object({
  username: z.string().min(2, "用户名至少 2 个字符"),
  password: z.string().min(6, "密码至少 6 位"),
})

type FormValues = z.infer<typeof schema>

export default function LoginPage() {
  const { onAuthed } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { username: "", password: "" },
  })

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true)
    try {
      const auth = await login(values.username, values.password)
      onAuthed(auth.user)
      toast.success(`欢迎回来，${auth.user.username}`)
      navigate((location.state as { from?: string })?.from ?? "/", { replace: true })
    } catch (err) {
      toast.error(apiErrorMessage(err, "登录失败，请检查用户名和密码"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="登录账号"
      subtitle="登录后开始优化你的简历"
      footer={
        <>
          还没有账号？{" "}
          <Link to="/register" className="font-medium text-primary hover:underline">
            立即注册
          </Link>
        </>
      }
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>用户名</FormLabel>
                <FormControl>
                  <Input placeholder="请输入用户名" autoComplete="username" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>密码</FormLabel>
                <FormControl>
                  <Input
                    type="password"
                    placeholder="请输入密码"
                    autoComplete="current-password"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting && <Loader2 className="size-4 animate-spin" />}
            登录
          </Button>
        </form>
      </Form>
    </AuthLayout>
  )
}
