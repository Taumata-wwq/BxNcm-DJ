/**
 * 将 Date 对象格式化为 HH:MM 字符串。
 * align with blivechat-dev utils/index.js getTimeTextHourMin
 */
export function getTimeTextHourMin(date: Date): string {
  const hour = String(date.getHours()).padStart(2, '0')
  const min = String(date.getMinutes()).padStart(2, '0')
  return `${hour}:${min}`
}