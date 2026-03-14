import protobuf from 'protobufjs'

/**
 * NetworkService handles WebSocket communication and Protobuf serialization.
 * It is a singleton used to synchronize game state with the server.
 */
class NetworkService {
  private static instance: NetworkService
  private socket: WebSocket | null = null
  private root: protobuf.Root | null = null
  private PlayerUpdate: protobuf.Type | null = null
  private GameState: protobuf.Type | null = null
  private listeners: ((state: any) => void)[] = []
  private disposed: boolean = false
  private reconnectTimeout: NodeJS.Timeout | null = null
  private _initPromise: Promise<void> | null = null

  private constructor() {}

  public static getInstance(): NetworkService {
    if (!NetworkService.instance) {
      NetworkService.instance = new NetworkService()
    }
    return NetworkService.instance
  }

  /**
   * Initializes the service by loading the Protobuf schema and establishing
   * the WebSocket connection.
   */
  public init(): Promise<void> {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      return Promise.resolve()
    }
    if (this._initPromise) {
      return this._initPromise
    }
    this.disposed = false // Reset on explicit init

    this._initPromise = (async (): Promise<void> => {
      try {
        if (!this.root) {
          const base = import.meta.env.BASE_URL || '/'
          const protoPath = base.endsWith('/')
            ? `${base}proto/game/player.proto`
            : `${base}/proto/game/player.proto`
          this.root = await protobuf.load(protoPath)
          this.PlayerUpdate = this.root.lookupType('game.PlayerUpdate')
          this.GameState = this.root.lookupType('game.GameState')
        }

        if (this.socket) {
          console.info('Cleaning up existing WebSocket before reconnecting...')
          this.socket.onopen = null
          this.socket.onerror = null
          this.socket.onmessage = null
          this.socket.onclose = null
          if (this.socket.readyState !== WebSocket.CLOSED) {
            this.socket.close()
          }
          this.socket = null
        }

        if (this.disposed) {
          console.log('NetworkService disposed during protobuf load, aborting')
          throw new Error('NetworkService disposed')
        }

        return new Promise<void>((resolve, reject) => {
          const protocol =
            window.location.protocol === 'https:' ? 'wss:' : 'ws:'
          const host = import.meta.env.VITE_API_HOST || 'localhost:8080'
          const url = `${protocol}//${host}`
          this.socket = new WebSocket(url)
          this.socket.binaryType = 'arraybuffer'

          this.socket.onopen = () => {
            if (this.disposed) {
              console.log('NetworkService disposed on open, closing socket')
              this.socket?.close()
              this.socket = null
              reject(new Error('NetworkService disposed'))
              return
            }
            console.info('Connected to Super Mario Battle Royale Server')
            resolve()
          }

          this.socket.onerror = (err) => {
            if (this.disposed) {
              console.log('NetworkService disposed on error, closing socket')
              this.socket?.close()
              this.socket = null
              reject(new Error('NetworkService disposed'))
              return
            }
            console.error('WebSocket connection failed:', err)
            reject(err)
          }

          this.socket.onmessage = (event) => {
            if (this.disposed) {
              console.log('NetworkService disposed on message, closing socket')
              this.socket?.close()
              this.socket = null
              return
            }
            if (this.GameState) {
              try {
                const uint8Array = new Uint8Array(event.data)
                const message = this.GameState.decode(uint8Array)
                const state = this.GameState.toObject(message, {
                  defaults: true,
                  arrays: true,
                  objects: true,
                })
                this.listeners.forEach((callback) => callback(state))
              } catch (e) {
                console.error('Failed to decode GameState:', e)
              }
            }
          }

          this.socket.onclose = (ev) => {
            console.info('WebSocket connection closed:', ev)
            this.socket = null
            if (this.disposed) {
              console.log('NetworkService disposed, skipping auto-reconnect')
              return
            }
            // Automatically reconnect after 2 seconds
            this.reconnectTimeout = setTimeout(() => {
              console.log('Attempting to reconnect...')
              this.init().catch((err) =>
                console.error('Reconnection failed:', err),
              )
            }, 2000)
          }
        })
      } finally {
        this._initPromise = null
      }
    })()

    return this._initPromise
  }

  dispose() {
    this.disposed = true
    this._initPromise = null
    this.listeners = []
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout)
      this.reconnectTimeout = null
    }
    if (this.socket) {
      console.log('NetworkService disposing socket')
      this.socket.close()
      this.socket = null
    }
  }

  /**
   * Encodes and sends a player movement update to the server.
   */
  public sendUpdate(update: {
    playerId: string
    x: number
    y: number
    flipX: boolean
    animation: string
  }): void {
    if (this.socket?.readyState === WebSocket.OPEN && this.PlayerUpdate) {
      const message = this.PlayerUpdate.create(update)
      const buffer = this.PlayerUpdate.encode(message).finish()
      this.socket.send(buffer)
    }
  }

  /**
   * Registers a callback for receiving the full world state.
   */
  public onGameState(callback: (state: any) => void) {
    this.listeners.push(callback)
    return () => {
      this.listeners = this.listeners.filter((l) => l !== callback)
    }
  }
}

export default NetworkService
