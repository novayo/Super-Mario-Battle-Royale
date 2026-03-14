import logging
import inspect
import asyncio

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


async def handle_message(message, send_func):
    """
    Core game server logic (to be expanded).
    For now, it just echoes back the message.
    """
    logger.info(f"Processing message: {message}")
    result = send_func(f"ACK: {message}")
    if inspect.isawaitable(result):
        await result


def start_server():
    try:
        # Try to use the standard websockets library if available (optional)
        # [COVERAGE] Standard implementation is intended for production use;
        # development environment uses the local zero-dependency fallback.
        import websockets  # pragma: no cover

        async def websockets_handler(websocket):  # pragma: no cover
            async for message in websocket:
                await handle_message(message, websocket.send)

        async def main():  # pragma: no cover
            logger.info("Using standard 'websockets' library")
            origins = ["http://localhost:3000", "http://127.0.0.1:3000", None]
            async with websockets.serve(
                websockets_handler, "localhost", 8080, origins=origins
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

        server = WebSocketFallbackServer(port=8080)
        server.start(handle_message)


# [COVERAGE] Excluded as this is the script entry point for manual execution
if __name__ == "__main__":  # pragma: no cover
    logger.info("Starting Super Mario Battle Royale Server...")
    start_server()
