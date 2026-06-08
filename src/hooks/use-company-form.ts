import { useState } from 'react'
import { type PriceCategory } from '../state/app-state'

interface CompanyFormState {
  shortCode: string
  name: string
  pin: string
  priceCategory: PriceCategory
}

const INITIAL_STATE: CompanyFormState = {
  shortCode: '',
  name: '',
  pin: '',
  priceCategory: 'business',
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
