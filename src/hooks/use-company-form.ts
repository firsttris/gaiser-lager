import { useState } from 'react'

interface CompanyFormState {
  name: string
  customerNumber: string
  street: string
  postalCode: string
  city: string
  pin: string
  email: string
}

const INITIAL_STATE: CompanyFormState = {
  name: '',
  customerNumber: '',
  street: '',
  postalCode: '',
  city: '',
  pin: '',
  email: '',
}

export function useCompanyForm() {
  const [formState, setFormState] = useState<CompanyFormState>(INITIAL_STATE)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const reset = () => {
    setFormState(INITIAL_STATE)
    setError('')
    setSuccess('')
  }

  const update = (updates: Partial<CompanyFormState>) => {
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
