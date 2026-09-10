import { headers } from 'next/headers'

export function authRequestDiagnosticsEnabled(): boolean {
  return process.env.AUTH_REQUEST_DIAGNOSTICS === '1'
}

export async function logPageAuthRequest(
  page: string,
  authenticated: boolean,
): Promise<void> {
  if (!authRequestDiagnosticsEnabled()) return

  const requestHeaders = await headers()
  console.info('[auth-request-debug]', {
    kind: 'page',
    timestamp: new Date().toISOString(),
    requestId: requestHeaders.get('x-foodkit-request-id'),
    page,
    authenticated,
    authGetUser: true,
    databaseReached: authenticated,
  })
}
