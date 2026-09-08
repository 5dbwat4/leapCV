import axios from "axios"

export const TOKEN_KEY = "leapcv_token"

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY)
}

const api = axios.create({
  baseURL: "/api",
  timeout: 120000,
})

api.interceptors.request.use((config) => {
  const token = getToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      clearToken()
      // 避免登录页自身的 401 死循环刷新
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login"
      }
    }
    return Promise.reject(error)
  },
)

/** 从 axios 错误中提取后端 detail 文案 */
export function apiErrorMessage(error: unknown, fallback = "请求失败，请稍后重试"): string {
  if (axios.isAxiosError(error)) {
    const detail = error.response?.data?.detail
    if (typeof detail === "string") return detail
    if (error.message) return error.message
  }
  return fallback
}

export default api
