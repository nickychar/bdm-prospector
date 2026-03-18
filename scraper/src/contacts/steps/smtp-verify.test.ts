// scraper/src/contacts/steps/smtp-verify.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('node:net', () => ({ createConnection: vi.fn() }))
vi.mock('node:dns/promises', () => ({ resolveMx: vi.fn() }))

import { verifySMTP, lookupMxHost } from './smtp-verify.js'
import * as net from 'node:net'
import * as dns from 'node:dns/promises'

describe('lookupMxHost', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns highest-priority MX host', async () => {
    vi.mocked(dns.resolveMx).mockResolvedValue([
      { priority: 20, exchange: 'mail2.example.com' },
      { priority: 10, exchange: 'mail1.example.com' },
    ])
    expect(await lookupMxHost('example.com')).toBe('mail1.example.com')
  })

  it('returns null when no MX records', async () => {
    vi.mocked(dns.resolveMx).mockResolvedValue([])
    expect(await lookupMxHost('example.com')).toBeNull()
  })

  it('returns null on DNS error', async () => {
    vi.mocked(dns.resolveMx).mockRejectedValue(new Error('ENOTFOUND'))
    expect(await lookupMxHost('example.com')).toBeNull()
  })
})

describe('verifySMTP', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns false when MX lookup fails', async () => {
    vi.mocked(dns.resolveMx).mockResolvedValue([])
    expect(await verifySMTP('john@example.com')).toBe(false)
  })

  it('returns false on connection error', async () => {
    vi.mocked(dns.resolveMx).mockResolvedValue([
      { priority: 10, exchange: 'mail.example.com' },
    ])
    const mockSocket = {
      on: vi.fn(),
      write: vi.fn(),
      end: vi.fn(),
      destroy: vi.fn(),
    }
    vi.mocked(net.createConnection).mockReturnValue(mockSocket as any)
    // Simulate error event on both port 587 and port 25
    mockSocket.on.mockImplementation((event: string, cb: Function) => {
      if (event === 'error') setTimeout(() => cb(new Error('ECONNREFUSED')), 0)
    })
    expect(await verifySMTP('john@example.com', 500)).toBe(false)
  })

  it('handles fragmented TCP responses by buffering until \\r\\n', async () => {
    vi.mocked(dns.resolveMx).mockResolvedValue([
      { priority: 10, exchange: 'mail.example.com' },
    ])

    // We'll track data handlers per socket so we can send fragments
    const dataHandlers: Array<(data: Buffer) => void> = []
    const closeHandlers: Array<() => void> = []
    const mockSockets: Array<ReturnType<typeof makeMockSocket>> = []

    function makeMockSocket() {
      const handlers: Record<string, Function[]> = {}
      const socket = {
        on: vi.fn((event: string, cb: Function) => {
          handlers[event] = handlers[event] ?? []
          handlers[event].push(cb)
        }),
        write: vi.fn(),
        end: vi.fn(),
        destroy: vi.fn(),
        emit(event: string, ...args: unknown[]) {
          for (const cb of handlers[event] ?? []) cb(...args)
        },
      }
      return socket
    }

    // First socket (port 587) — simulate fragmented SMTP greeting then RCPT accepted
    const socket587 = makeMockSocket()
    // Second socket (port 25) would only be needed if 587 fails — not needed here
    vi.mocked(net.createConnection)
      .mockReturnValueOnce(socket587 as any)

    // Schedule SMTP conversation after socket is created
    setTimeout(() => {
      // Fragment 1: partial greeting
      socket587.emit('data', Buffer.from('22'))
      // Fragment 2: rest of greeting (220 = service ready)
      socket587.emit('data', Buffer.from('0 mail.example.com ESMTP\r\n'))
      // EHLO response (250 OK)
      socket587.emit('data', Buffer.from('250 OK\r\n'))
      // MAIL FROM response
      socket587.emit('data', Buffer.from('250 OK\r\n'))
      // RCPT TO response — accepted (250)
      socket587.emit('data', Buffer.from('250 OK\r\n'))
      // QUIT response (221 = bye)
      socket587.emit('data', Buffer.from('221 Bye\r\n'))
    }, 0)

    const result = await verifySMTP('john@example.com', 2000)
    expect(result).toBe(true)
  })

  it('handles multi-line SMTP responses (250-... continuation lines)', async () => {
    vi.mocked(dns.resolveMx).mockResolvedValue([
      { priority: 10, exchange: 'mail.example.com' },
    ])

    const handlers: Record<string, Function[]> = {}
    const socket = {
      on: vi.fn((event: string, cb: Function) => {
        handlers[event] = handlers[event] ?? []
        handlers[event].push(cb)
      }),
      write: vi.fn(),
      end: vi.fn(),
      destroy: vi.fn(),
      emit(event: string, ...args: unknown[]) {
        for (const cb of handlers[event] ?? []) cb(...args)
      },
    }
    vi.mocked(net.createConnection).mockReturnValueOnce(socket as any)

    setTimeout(() => {
      // Multi-line greeting (220 = service ready)
      socket.emit('data', Buffer.from('220 mail.example.com ESMTP\r\n'))
      // Multi-line EHLO response
      socket.emit('data', Buffer.from('250-mail.example.com Hello\r\n250-SIZE 52428800\r\n250 OK\r\n'))
      // MAIL FROM response
      socket.emit('data', Buffer.from('250 OK\r\n'))
      // RCPT TO accepted
      socket.emit('data', Buffer.from('250 OK\r\n'))
      // QUIT response (221 = bye)
      socket.emit('data', Buffer.from('221 Bye\r\n'))
    }, 0)

    const result = await verifySMTP('john@example.com', 2000)
    expect(result).toBe(true)
  })

  it('tries port 587 first, then falls back to port 25', async () => {
    vi.mocked(dns.resolveMx).mockResolvedValue([
      { priority: 10, exchange: 'mail.example.com' },
    ])

    const makeErrorSocket = () => {
      const handlers: Record<string, Function[]> = {}
      const socket = {
        on: vi.fn((event: string, cb: Function) => {
          handlers[event] = handlers[event] ?? []
          handlers[event].push(cb)
          if (event === 'error') setTimeout(() => cb(new Error('ECONNREFUSED')), 0)
        }),
        write: vi.fn(),
        end: vi.fn(),
        destroy: vi.fn(),
      }
      return socket
    }

    const socket587 = makeErrorSocket()
    const socket25 = makeErrorSocket()
    vi.mocked(net.createConnection)
      .mockReturnValueOnce(socket587 as any)
      .mockReturnValueOnce(socket25 as any)

    await verifySMTP('john@example.com', 500)

    expect(vi.mocked(net.createConnection)).toHaveBeenCalledTimes(2)
    expect(vi.mocked(net.createConnection).mock.calls[0][0]).toMatchObject({ port: 587 })
    expect(vi.mocked(net.createConnection).mock.calls[1][0]).toMatchObject({ port: 25 })
  })
})
