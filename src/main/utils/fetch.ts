/**
 * 带超时的 fetch 封装。Node.js 的 fetch 默认无超时，在网络不可达时会无限挂起。
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit & { timeoutMs?: number } = {}
): Promise<Response> {
  const { timeoutMs = 10_000, ...fetchOptions } = options
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal
    })
    return response
  } finally {
    clearTimeout(timeoutId)
  }
}