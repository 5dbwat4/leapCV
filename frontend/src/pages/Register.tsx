import { useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { register } from "@/api"
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
  username: z
    .string()
    .min(2, "用户名至少 2 个字符")
    .max(50, "用户名过长")
    .regex(/^[\w\u4e00-\u9fa5-]+$/, "仅支持中英文、数字、下划线和连字符"),
  password: z.string().min(6, "密码至少 6 位").max(72, "密码过长"),
  confirm: z.string(),
})

type FormValues = z.infer<typeof schema>

export default function RegisterPage() {
  const { onAuthed } = useAuth()
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(
      schema.refine((v) => v.password === v.confirm, {
        message: "两次输入的密码不一致",
        path: ["confirm"],
      }),
    ),
    defaultValues: { username: "", password: "", confirm: "" },
  })

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true)
    try {
      const auth = await register(values.username, values.password)
      onAuthed(auth.user)
      toast.success("注册成功，已自动登录")
      navigate("/", { replace: true })
    } catch (err) {
      toast.error(apiErrorMessage(err, "注册失败，请稍后重试"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      title="创建账号"
      subtitle="30 秒注册，开启简历优化之旅"
      footer={
        <>
          已有账号？{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            直接登录
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
                  <Input placeholder="2-50 个字符" autoComplete="username" {...field} />
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
                  <Input type="password" placeholder="至少 6 位" autoComplete="new-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirm"
            render={({ field }) => (
              <FormItem>
                <FormLabel>确认密码</FormLabel>
                <FormControl>
                  <Input type="password" placeholder="再次输入密码" autoComplete="new-password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting && <Loader2 className="size-4 animate-spin" />}
            注册并登录
          </Button>
          <p className="text-center text-xs leading-5 text-muted-foreground">
            注册即表示您已阅读并同意
            <Link to="/terms" target="_blank" className="mx-0.5 text-primary hover:underline">
              《服务条款》
            </Link>
            与
            <Link to="/privacy" target="_blank" className="mx-0.5 text-primary hover:underline">
              《隐私政策》
            </Link>
            ，并了解您的简历信息将在提供分析时交由所配置的大模型服务处理。
          </p>
        </form>
      </Form>
    </AuthLayout>
  )
}
