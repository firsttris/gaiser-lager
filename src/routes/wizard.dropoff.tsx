import { createFileRoute } from '@tanstack/react-router'
import { WizardFlow } from '../components/wizard-flow'

export const Route = createFileRoute('/wizard/dropoff')({ component: () => <WizardFlow flowType="dropoff" /> })
