// scraper/src/contacts/steps/smtp-verify.ts
import * as net from 'node:net'
import * as dns from 'node:dns/promises'

export async function lookupMxHost(domain: string): Promise<string | null> {
  try {
    const records = await dns.resolveMx(domain)
    if (!records.length) return null
    return records.sort((a, b) => a.priority - b.priority)[0].exchange
  } catch {
    return null
  }
}

function tryConnect(
  mxHost: string,
  port: number,
  email: string,
  timeoutMs: number
): Promise<boolean> {
  return new Promise<boolean>(resolve => {
    let settled = false
    function settle(result: boolean) {
      if (settled) return
      settled = true
      resolve(result)
    }

    const timer = setTimeout(() => {
      socket.destroy()
      settle(false)
    }, timeoutMs)

    const socket = net.createConnection({ host: mxHost, port })
    let step = 0
    let rcptAccepted = false
    let buf = ''

    const lines = [
      `EHLO bdmprospector.app\r\n`,
      `MAIL FROM:<verify@bdmprospector.app>\r\n`,
      `RCPT TO:<${email}>\r\n`,
      `QUIT\r\n`,
    ]

    socket.on('error', () => {
      clearTimeout(timer)
      settle(false)
    })

    socket.on('data', (data: Buffer) => {
      buf += data.toString()
      let crlfIdx: number
      // Process all complete lines (terminated by \r\n)
      while ((crlfIdx = buf.indexOf('\r\n')) !== -1) {
        const line = buf.slice(0, crlfIdx)
        buf = buf.slice(crlfIdx + 2)

        // Skip continuation lines (e.g. "250-EHLO")
        if (line.length < 3) continue
        // Only act on the final line of a multi-line response (code followed by space)
        if (line[3] === '-') continue

        const code = parseInt(line.slice(0, 3), 10)
        if (step === 3) {
          rcptAccepted = code >= 200 && code < 300
        }
        if (step < lines.length) {
          socket.write(lines[step])
          step++
        } else {
          clearTimeout(timer)
          socket.end()
          settle(rcptAccepted)
        }
      }
    })

    socket.on('close', () => {
      clearTimeout(timer)
      settle(rcptAccepted)
    })
  })
}

export async function verifySMTP(email: string, timeoutMs = 8_000): Promise<boolean> {
  const [, domain] = email.split('@')
  if (!domain) return false

  const mxHost = await lookupMxHost(domain)
  if (!mxHost) return false

  // Try port 587 first (not blocked by most cloud providers), fall back to port 25
  const result587 = await tryConnect(mxHost, 587, email, timeoutMs)
  if (result587) return true

  return tryConnect(mxHost, 25, email, timeoutMs)
}
