import * as React from "react"
import toast from "react-hot-toast"

export interface ToastProps {
  title?: string
  description?: string
  variant?: "default" | "destructive"
}

export function useToast() {
  const showToast = React.useCallback(
    ({ title, description, variant = "default" }: ToastProps) => {
      const message = title || description || ""
      
      if (variant === "destructive") {
        toast.error(message)
      } else {
        toast.success(message)
      }
    },
    []
  )

  return {
    toast: showToast,
  }
}
