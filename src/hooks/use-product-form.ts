import { useState } from 'react'

interface ProductFormState {
  name: string
  unit: string
  flow: 'pickup' | 'dropoff'
  price: string
}

const INITIAL_STATE: ProductFormState = {
  name: '',
  unit: '',
  flow: 'dropoff',
  price: '',
}

export function useProductForm() {
  const [formState, setFormState] = useState<ProductFormState>(INITIAL_STATE)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const reset = () => {
    setFormState(INITIAL_STATE)
    setError('')
    setSuccess('')
  }

  const update = (updates: Partial<ProductFormState>) => {
    setFormState((prev) => ({ ...prev, ...updates }))
  }

  const setMessage = (message: string, type: 'error' | 'success') => {
    if (type === 'error') {
      setError(message)
      setSuccess('')
    } else {
      setSuccess(message)
      setError('')
    }
  }

  return {
    formState,
    error,
    success,
    reset,
    update,
    setMessage,
  }
}
