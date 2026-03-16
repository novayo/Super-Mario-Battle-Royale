import { describe, it, expect, vi, beforeEach } from 'vitest'
import NetworkService from './NetworkService'
import protobuf from 'protobufjs'

// Mock protobufjs
vi.mock('protobufjs', () => {
  const mockType = {
    create: vi.fn((update) => update),
    encode: vi.fn(() => ({ finish: vi.fn(() => new Uint8Array([1, 2, 3])) })),
    decode: vi.fn((_data) => ({})),
    toObject: vi.fn((_message, _options) => ({ players: [] })),
  }

  const mockRoot = {
    lookupType: vi.fn((name) => {
      if (name === 'game.PlayerUpdate' || name === 'game.GameState') {
        return mockType
      }
      return null
    }),
  }

  return {
    default: {
      load: vi.fn().mockResolvedValue(mockRoot),
    },
    load: vi.fn().mockResolvedValue(mockRoot),
  }
})

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSING = 2
  static CLOSED = 3

  url: string
  binaryType: string = 'blob'
  readyState: number = MockWebSocket.CONNECTING
  onopen: (() => void) | null = null
  onerror: ((err: any) => void) | null = null
  onmessage: ((event: any) => void) | null = null
  onclose: ((ev: any) => void) | null = null
  send = vi.fn()
  close = vi.fn()

  constructor(url: string) {
    this.url = url
    MockWebSocket.instance = this
    console.log('MockWebSocket created')
    // Simulate connection
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN
      console.log('MockWebSocket setTimeout running')
      if (this.onopen) {
        console.log('MockWebSocket calling onopen')
        this.onopen()
      } else {
        console.log('MockWebSocket onopen NOT SET')
      }
    }, 10)
  }

  static instance: MockWebSocket
}

// @ts-ignore
global.WebSocket = MockWebSocket

describe('NetworkService', () => {
  let service: NetworkService

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset global.WebSocket to MockWebSocket
    // @ts-ignore
    global.WebSocket = MockWebSocket
    // Reset singleton instance
    // @ts-ignore
    NetworkService.instance = undefined
    service = NetworkService.getInstance()
  })

  it('should initialize and connect', async () => {
    await service.init()
    expect(MockWebSocket.instance).toBeTruthy()
    expect(MockWebSocket.instance.url).toBe('ws://localhost:8080')
    expect(MockWebSocket.instance.binaryType).toBe('arraybuffer')
  })

  it('should be idempotent', async () => {
    await service.init()
    const socket1 = (service as any).socket
    expect(socket1).toBeTruthy()

    // Call init again
    await service.init()
    const socket2 = (service as any).socket
    // Should reuse the same socket
    expect(socket1).toBe(socket2)
  })

  it('should send update when socket is open', async () => {
    await service.init()
    // Wait for mock connection to be established (setTimeout in constructor)
    await new Promise((resolve) => setTimeout(resolve, 20))

    // Verify readyState is OPEN
    expect(MockWebSocket.instance.readyState).toBe(MockWebSocket.OPEN)

    service.sendUpdate({
      playerId: 'test',
      x: 10,
      y: 20,
      flipX: false,
      animation: 'idle',
    })

    expect(MockWebSocket.instance.send).toHaveBeenCalled()
  })

  it('should handle incoming messages', async () => {
    await service.init()
    await new Promise((resolve) => setTimeout(resolve, 20))

    const mockCallback = vi.fn()
    service.onGameState(mockCallback)

    // Simulate message from server
    const mockMessage = { data: new ArrayBuffer(3) }
    MockWebSocket.instance.onmessage!(mockMessage)

    expect(mockCallback).toHaveBeenCalledWith({ players: [] })
  })

  it('should handle connection error', async () => {
    // Override MockWebSocket to simulate error
    class MockWebSocketError extends MockWebSocket {
      constructor(url: string) {
        super(url)
        // Simulate error immediately or after a short delay
        setTimeout(() => {
          if (this.onerror) this.onerror(new Error('Connection failed'))
          // Reject the init promise if it's still pending
          // But init() has its own promise.
          // In NetworkService.ts:
          // this.socket.onerror = (err) => { reject(err) }
          // So triggering onerror should reject the promise.
        }, 5)
      }
    }
    // @ts-ignore
    global.WebSocket = MockWebSocketError

    // Reset instance to use new mock
    // @ts-ignore
    NetworkService.instance = undefined
    const errorService = NetworkService.getInstance()

    await expect(errorService.init()).rejects.toThrow('Connection failed')
  })

  it('should handle decode error', async () => {
    await service.init()
    await new Promise((resolve) => setTimeout(resolve, 20))

    const mockCallback = vi.fn()
    service.onGameState(mockCallback)

    // Mock decode to throw
    const mockType = (await protobuf.load('')).lookupType('game.GameState')
    ;(mockType.decode as any).mockImplementationOnce(() => {
      throw new Error('Decode failed')
    })

    // Simulate message from server
    const mockMessage = { data: new ArrayBuffer(3) }
    MockWebSocket.instance.onmessage!(mockMessage)

    // Callback should NOT have been called
    expect(mockCallback).not.toHaveBeenCalled()
  })

  it('should utilize context computed WebSocket URL with secure protocol', async () => {
    const originalLocation = window.location
    Object.defineProperty(window, 'location', {
      value: new URL('https://localhost'),
      writable: true,
      configurable: true,
    })

    await service.init()
    expect(MockWebSocket.instance.url).toBe('wss://localhost:8080')

    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
      configurable: true,
    })
  })

  it('should utilize env computed WebSocket URL', async () => {
    vi.stubEnv('VITE_API_HOST', 'localhost:9000')

    await service.init()
    expect(MockWebSocket.instance.url).toBe('ws://localhost:9000')

    vi.unstubAllEnvs()
  })

  it('should handle onclose and reconnect', async () => {
    vi.useFakeTimers()

    // Start init
    const initPromise = service.init()

    // Let microtasks run (protobuf.load, then handler)
    await Promise.resolve()
    await Promise.resolve()

    vi.advanceTimersByTime(10)
    await initPromise

    const socket1 = (service as any).socket
    expect(socket1).toBeTruthy()

    // Simulate close
    if (socket1.onclose) {
      socket1.onclose({ reason: 'test' })
    }
    expect((service as any).socket).toBeNull()

    // Fast-forward time to trigger reconnect
    vi.advanceTimersByTime(2000)

    // Should have called init again
    const socket2 = (service as any).socket
    expect(socket2).toBeTruthy()
    expect(socket2).not.toBe(socket1)

    vi.useRealTimers()
  })

  it('should reuse promise for concurrent init calls', async () => {
    vi.useFakeTimers()

    // Start init
    const initPromise1 = service.init()
    const initPromise2 = service.init()

    expect(initPromise2).toBe(initPromise1)

    // Let microtasks run
    await Promise.resolve()
    await Promise.resolve()

    vi.advanceTimersByTime(10)
    await initPromise1
    await initPromise2

    vi.useRealTimers()
  })

  it('should abort init if dispose is called during protobuf load', async () => {
    let resolveProto: (value: protobuf.Root) => void = () => {}
    const protoPromise = new Promise<protobuf.Root>((resolve) => {
      resolveProto = resolve
    })

    const mockRoot = {
      lookupType: vi.fn().mockReturnValue({
        create: vi.fn(),
        encode: vi.fn(),
        decode: vi.fn(),
        toObject: vi.fn(),
      }),
    }

    // Mock protobuf.load to return our promise
    vi.mocked(protobuf.load).mockImplementationOnce(() => protoPromise)

    const initPromise = service.init()

    // Dispose while protobuf.load is pending
    service.dispose()

    // Resolve protobuf.load
    resolveProto(mockRoot as any)

    // init() should reject
    await expect(initPromise).rejects.toThrow('NetworkService disposed')

    // Socket should be null
    expect((service as any).socket).toBeNull()
  })

  it('should abort init if dispose is called while waiting for onopen', async () => {
    const initPromise = service.init()

    // Wait a bit to ensure socket is created (but not yet open)
    await new Promise((resolve) => setTimeout(resolve, 1))

    expect((service as any).socket).not.toBeNull()

    // Dispose while waiting for onopen
    service.dispose()

    // initPromise should reject
    await expect(initPromise).rejects.toThrow('NetworkService disposed')

    // Socket should be null
    expect((service as any).socket).toBeNull()
  })

  it('should allow init after dispose', async () => {
    await service.init()
    expect((service as any).socket).not.toBeNull()

    service.dispose()
    expect((service as any).socket).toBeNull()
    expect((service as any)._initPromise).toBeNull()

    // init should start a new connection
    const initPromise = service.init()
    await expect(initPromise).resolves.toBeUndefined()
    expect((service as any).socket).not.toBeNull()
  })
})
