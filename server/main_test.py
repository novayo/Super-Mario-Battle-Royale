import unittest
from unittest.mock import MagicMock, patch
import main


class TestMainLogic(unittest.TestCase):
    def test_handle_message(self):
        send_mock = MagicMock()
        import asyncio

        asyncio.run(main.handle_message("Test Message", send_mock))
        send_mock.assert_called_once_with("ACK: Test Message")

    def test_handle_message_async(self):
        import asyncio

        send_mock = MagicMock()

        async def async_send(msg):
            send_mock(msg)

        asyncio.run(main.handle_message("Test Message", async_send))
        send_mock.assert_called_once_with("ACK: Test Message")

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
                    mock_fallback_class.assert_called_once_with(port=8080)
                    mock_server_instance.start.assert_called_once_with(
                        main.handle_message
                    )


# [COVERAGE] Excluded as this is the standard test entry point
if __name__ == "__main__":  # pragma: no cover
    unittest.main()
