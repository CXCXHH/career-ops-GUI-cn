export function showToast(onToast, message, type = 'info') {
  if (typeof onToast === 'function') {
    onToast(message, type)
  }
}