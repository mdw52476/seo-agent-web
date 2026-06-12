import { AppProvider } from './AppContext'
import AppShell from './components/AppShell'

export default function Page() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  )
}
