import { createFileRoute } from '@tanstack/react-router'
import { WizardFlow } from '../components/wizard-flow'

export const Route = createFileRoute('/wizard/pickup')({ component: () => <WizardFlow flowType="pickup" /> })
