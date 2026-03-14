import unittest
from unittest.mock import MagicMock, patch
import main
import player_pb2
import asyncio


class TestMainLogic(unittest.TestCase):
    def setUp(self):
        main.PLAYERS.clear()
        main.CONNECTIONS.clear()
        main.CONNECTION_TO_PLAYER.clear()
        main.SEND_LOCKS.clear()
        main.ASYNC_SEND_LOCKS.clear()

    def test_handle_protobuf_message(self):
        send_mock = MagicMock()
        update = player_pb2.PlayerUpdate(
            player_id="p1", x=100.0, y=200.0, flip_x=False, animation="idle"
        )
        payload = update.SerializeToString()

        # Reset global state for testing - now handled by setUp

        asyncio.run(main.handle_message(payload, send_mock))

        # Verify player was added to state
        self.assertIn("p1", main.PLAYERS)
        self.assertEqual(main.PLAYERS["p1"].x, 100.0)

        # Verify broadcast was attempted
        self.assertGreaterEqual(send_mock.call_count, 1)

        # Check the last call payload
        last_payload = send_mock.call_args[0][0]
        state = player_pb2.GameState()
        state.ParseFromString(last_payload)
        self.assertEqual(len(state.players), 1)
        self.assertEqual(state.players[0].player_id, "p1")

    def test_handle_invalid_protobuf(self):
        send_mock = MagicMock()
        with patch("main.logger") as mock_logger:
            asyncio.run(main.handle_message(b"invalid data", send_mock))
            # Should log an error but not crash
            mock_logger.error.assert_called()

    def test_handle_message_invalid_payload_type(self):
        mock_send = MagicMock()
        original_warning = main.logger.warning
        main.logger.warning = MagicMock()
        try:
            asyncio.run(main.handle_message("not bytes", mock_send))
            main.logger.warning.assert_called_with(
                "Received non-binary payload: <class 'str'>"
            )
        finally:
            main.logger.warning = original_warning

    def test_broadcast_async_sender(self):
        # Mock a connection that returns a coroutine
        async def mock_async_send(data):
            return "async res"

        # Clear existing connections and add mock
        main.CONNECTIONS.clear()
        main.CONNECTIONS.add(mock_async_send)
        # Reset ASYNC_SEND_LOCKS
        main.ASYNC_SEND_LOCKS.clear()

        # Run broadcast
        asyncio.run(main.broadcast(b"data"))
        # Run broadcast AGAIN to cover line 76
        asyncio.run(main.broadcast(b"data"))

        # Verify that ASYNC_SEND_LOCKS has the sender
        has_sender = any(
            isinstance(k, tuple) and k[0] == mock_async_send
            for k in main.ASYNC_SEND_LOCKS
        )
        self.assertTrue(has_sender)
        # Verify it created an asyncio.Lock
        # get the lock from the tuple key
        lock = next(
            v
            for k, v in main.ASYNC_SEND_LOCKS.items()
            if isinstance(k, tuple) and k[0] == mock_async_send
        )
        self.assertIsInstance(lock, asyncio.Lock)

    def test_broadcast_hybrid_sender(self):
        # Mock a connection that is sync but returns a coroutine
        def mock_hybrid_send(data):
            async def inner():
                return "hybrid res"

            return inner()

        # Clear existing connections and add mock
        main.CONNECTIONS.clear()
        main.CONNECTIONS.add(mock_hybrid_send)
        # Reset ASYNC_SEND_LOCKS
        main.ASYNC_SEND_LOCKS.clear()

        # Run broadcast
        asyncio.run(main.broadcast(b"data"))
        # Run broadcast AGAIN to cover line 75 (added to lock)
        asyncio.run(main.broadcast(b"data"))

        # Verify that ASYNC_SEND_LOCKS has the sender
        has_sender = any(
            isinstance(k, tuple) and k[0] == mock_hybrid_send
            for k in main.ASYNC_SEND_LOCKS
        )
        self.assertTrue(has_sender)
        # Verify it created an asyncio.Lock
        # get the lock from the tuple key
        lock = next(
            v
            for k, v in main.ASYNC_SEND_LOCKS.items()
            if isinstance(k, tuple) and k[0] == mock_hybrid_send
        )
        self.assertIsInstance(lock, asyncio.Lock)

    def test_broadcast_async_failing_sender(self):
        # Mock an async connection that fails
        async def mock_async_failing_send(data):
            raise Exception("async fail")

        main.CONNECTIONS.clear()
        main.CONNECTIONS.add(mock_async_failing_send)
        main.ASYNC_SEND_LOCKS.clear()

        # Run broadcast (should handle exception)
        asyncio.run(main.broadcast(b"data"))

    def test_broadcast_hybrid_failing_sender(self):
        # Mock a connection that is sync but returns a failing coroutine
        def mock_hybrid_failing_send(data):
            async def inner():
                raise Exception("hybrid fail")

            return inner()

        main.CONNECTIONS.clear()
        main.CONNECTIONS.add(mock_hybrid_failing_send)
        main.ASYNC_SEND_LOCKS.clear()

        # Run broadcast (should handle exception)
        asyncio.run(main.broadcast(b"data"))

    def test_broadcast_error_handling(self):
        # Mock a connection that fails
        def failing_send(data):
            raise Exception("Disconnected")

        main.CONNECTIONS = {failing_send}
        asyncio.run(main.broadcast(b"data"))

        # Connection should be removed from the set
        self.assertEqual(len(main.CONNECTIONS), 0)

    def test_start_server_fallback(self):
        # Patch the class in the module it's defined in
        with patch(
            "websocket_fallback.WebSocketFallbackServer"
        ) as mock_fallback_class:
            mock_server_instance = mock_fallback_class.return_value
            # Mock logger in main
            with patch("main.logger") as mock_logger:
                # Simulate websockets not being available
                with patch.dict("sys.modules", {"websockets": None}):
                    # Call start_server
                    main.start_server()
                    # Verify fallback was used
                    mock_logger.warning.assert_any_call(
                        "'websockets' library not found. "
                        "Falling back to custom zero-dependency implementation."
                    )
                    mock_fallback_class.assert_called_once_with(
                        port=8080, allowed_origins=main.ALLOWED_ORIGINS
                    )
                    mock_server_instance.start.assert_called_once_with(
                        main.handle_message, main.on_disconnect
                    )


# [COVERAGE] Excluded as this is the standard test entry point
if __name__ == "__main__":  # pragma: no cover
    unittest.main()
