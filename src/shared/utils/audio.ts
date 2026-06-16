/**
 * 将 UI 音量值 (0-100) 转换为音频元素的 volume 值 (0-1)。
 *
 * 人耳对响度的感知遵循幂律，线性映射会导致低音量段几乎听不到变化、
 * 高音量段又过于敏感。使用二次曲线使 slider 每个位置对应的感知响度
 * 变化更均匀。
 *
 * @param vol - UI slider 音量值，范围 0-100
 * @returns 音频振幅值，范围 0-1
 */
export function volumeToAmplitude(vol: number): number {
  if (vol <= 0) return 0
  if (vol >= 100) return 1
  return Math.pow(vol / 100, 2)
}