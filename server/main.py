import logging
import inspect
import asyncio
import player_pb2
import threading

# Synchronization locks
state_lock = threading.RLock()
SEND_LOCKS = {}
ASYNC_SEND_LOCKS = {}

ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    None,
]

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


# In-memory storage for game state
PLAYERS = {}
CONNECTIONS = set()
CONNECTION_TO_PLAYER = {}


async def handle_message(payload, send_func):
    """
    Decodes a binary PlayerUpdate Protobuf message, updates global
    state, and broadcasts the current GameState to all clients.
    """
    if not isinstance(payload, bytes):
        logger.warning(f"Received non-binary payload: {type(payload)}")
        return

    try:
        update = player_pb2.PlayerUpdate()
        update.ParseFromString(payload)

        # Update global state for this player
        with state_lock:
            PLAYERS[update.player_id] = update
            CONNECTIONS.add(send_func)
            CONNECTION_TO_PLAYER[send_func] = update.player_id
            if send_func not in SEND_LOCKS:
                SEND_LOCKS[send_func] = threading.Lock()

            # Create a consistent snapshot of players inside the lock
            players_snapshot = list(PLAYERS.values())

        logger.info(f"Updated player {update.player_id}")

        # Broadcast the aggregated GameState to all connected clients
        game_state = player_pb2.GameState()
        game_state.players.extend(players_snapshot)
        await broadcast(game_state.SerializeToString())

    except Exception as e:
        logger.error(f"Protobuf communication error: {e}")


async def broadcast(data, allow_rebroadcast=True):
    """Sends binary data to all active connections."""
    with state_lock:
        connections = list(CONNECTIONS)
    for send in connections:
        # Check if async
        use_async_lock = False
        async_lock = None
        threading_lock = None

        with state_lock:
            try:
                current_loop = asyncio.get_running_loop()
                lock_key = (send, current_loop)
                if lock_key in ASYNC_SEND_LOCKS:
                    use_async_lock = True
                    async_lock = ASYNC_SEND_LOCKS[lock_key]
                elif inspect.iscoroutinefunction(send):
                    use_async_lock = True
                    async_lock = asyncio.Lock()
                    ASYNC_SEND_LOCKS[lock_key] = async_lock
                else:
                    threading_lock = SEND_LOCKS.setdefault(
                        send, threading.Lock()
                    )
            except RuntimeError:
                # No running event loop, must be a threading context
                threading_lock = SEND_LOCKS.setdefault(send, threading.Lock())

        failed = False

        if use_async_lock:
            async with async_lock:
                try:
                    res = send(data)
                    if inspect.isawaitable(res):
                        await res
                except Exception:
                    failed = True
        else:  # Must be a threading lock
            # Acquire the threading lock
            with threading_lock:
                try:
                    res = send(data)
                    if inspect.isawaitable(res):
                        # We guessed wrong! It IS async!
                        # This path should ideally not be taken if
                        # inspect.iscoroutinefunction(send) is accurate.
                        # However, if a non-async function returns an
                        # awaitable, we handle it.
                        with state_lock:
                            try:
                                current_loop = asyncio.get_running_loop()
                                lock_key = (send, current_loop)
                                async_lock = ASYNC_SEND_LOCKS.setdefault(
                                    lock_key, asyncio.Lock()
                                )
                            except RuntimeError:
                                # If we're in a threading context and it
                                # returns an awaitable, we can't await it
                                # directly without an event loop.
                                # This scenario indicates a potential
                                # mismatch in how `send` is expected to
                                # behave.
                                logger.error(
                                    f"Threading send function {send} returned "
                                    "an awaitable but no event loop is running."
                                )
                                failed = True
                                # Ensure async_lock is not used if no loop
                                async_lock = None
                        if async_lock:
                            async with async_lock:
                                try:
                                    await res
                                except Exception:
                                    failed = True
                        else:
                            # If async_lock couldn't be obtained
                            # (e.g., no event loop), mark as failed
                            failed = True
                except Exception:
                    failed = True

        if failed and allow_rebroadcast:
            # Call on_disconnect to clean up player and rebroadcast
            # Released lock before calling this
            await on_disconnect(send)


async def on_disconnect(send_func):
    """
    Handles client disconnection by removing the player from global state.
    """
    logger.info(f"on_disconnect called for {send_func}")
    players_snapshot = None
    with state_lock:
        CONNECTIONS.discard(send_func)
        player_id = CONNECTION_TO_PLAYER.pop(send_func, None)
        SEND_LOCKS.pop(send_func, None)  # Pop old style just in case
        # Clean up all locks for this send function across all loops
        keys_to_remove = [
            k
            for k in ASYNC_SEND_LOCKS
            if isinstance(k, tuple) and k[0] == send_func
        ]
        for k in keys_to_remove:
            ASYNC_SEND_LOCKS.pop(k, None)
        if player_id:
            logger.info(f"Found player_id {player_id} for send_func")
            if player_id in PLAYERS:
                del PLAYERS[player_id]
                logger.info(f"Removed player {player_id} from PLAYERS")
                # Create a consistent snapshot of players inside the lock
                players_snapshot = list(PLAYERS.values())
            else:
                logger.warning(f"Player {player_id} not found in PLAYERS")
        else:
            logger.warning("send_func NOT found in CONNECTION_TO_PLAYER")

    # Broadcast new state outside the lock
    if players_snapshot is not None:
        game_state = player_pb2.GameState()
        game_state.players.extend(players_snapshot)
        await broadcast(game_state.SerializeToString(), allow_rebroadcast=False)


def start_server():
    try:
        # Try to use the standard websockets library if available (optional)
        # [COVERAGE] Standard implementation is intended for production use;
        # development environment uses the local zero-dependency fallback.
        import websockets  # pragma: no cover

        async def websockets_handler(websocket):  # pragma: no cover
            with state_lock:
                CONNECTIONS.add(websocket.send)
            try:
                async for message in websocket:
                    await handle_message(message, websocket.send)
            finally:
                await on_disconnect(websocket.send)

        async def main():  # pragma: no cover
            logger.info("Using standard 'websockets' library")
            async with websockets.serve(
                websockets_handler, "localhost", 8080, origins=ALLOWED_ORIGINS
            ):
                await asyncio.Future()  # run forever

        asyncio.run(main())  # pragma: no cover

    except ImportError:
        # Fallback to custom zero-dependency implementation
        logger.warning(
            "'websockets' library not found. "
            "Falling back to custom zero-dependency implementation."
        )
        from websocket_fallback import WebSocketFallbackServer

        server = WebSocketFallbackServer(
            port=8080, allowed_origins=ALLOWED_ORIGINS
        )
        server.start(handle_message, on_disconnect)


# [COVERAGE] Excluded as this is the script entry point for manual execution
if __name__ == "__main__":  # pragma: no cover
    logger.info("Starting Super Mario Battle Royale Server...")
    start_server()
