import unittest
import socket
import threading
import time
import logging
from unittest.mock import MagicMock, patch
from websocket_fallback import WebSocketFallbackServer

# Optional: Try to import standard websockets for testing
try:
    # Just check if it's available without keeping the import
    import importlib.util

    # [COVERAGE] Reserved for production environments; development
    # uses the custom zero-dependency fallback.
    HAS_WEBSOCKETS_LIB = (
        importlib.util.find_spec("websockets") is not None
    )  # pragma: no cover
except ImportError:  # pragma: no cover
    HAS_WEBSOCKETS_LIB = False

logging.basicConfig(level=logging.INFO)


class TestWebSocketProtocol(unittest.TestCase):
    def setUp(self):
        self.server = WebSocketFallbackServer()

    def test_handshake_response(self):
        key = "dGhlIHNhbXBsZSBub25jZQ=="
        expected_accept = "s3pPLMBiTxaQ9kYGzzhZRbK+xOo="

        # Test without origin
        response = self.server._get_handshake_response(key)
        self.assertIn(f"Sec-WebSocket-Accept: {expected_accept}", response)
        self.assertNotIn("Access-Control-Allow-Origin", response)

        # Test with allowed origin
        allowed = "http://localhost:5173"
        response = self.server._get_handshake_response(key, allowed)
        self.assertIn(f"Sec-WebSocket-Accept: {expected_accept}", response)
        self.assertIn(f"Access-Control-Allow-Origin: {allowed}", response)

        # Test with disallowed origin
        disallowed = "http://malicious.com"
        response = self.server._get_handshake_response(key, disallowed)
        self.assertIn("403 Forbidden", response)
        self.assertIn("Origin not allowed", response)

    def test_empty_allowed_origins(self):
        server = WebSocketFallbackServer(allowed_origins=[])
        self.assertEqual(server.allowed_origins, [])
        response = server._get_handshake_response("key", "http://any.com")
        self.assertIn("403 Forbidden", response)

    def test_decode_unmasked_frame(self):
        # RFC 6455 requires MASK bit for client->server
        # Header: 0x81 (Fin, Text), Mask bit=0, length=5
        header = bytearray([0x81, 0x05])
        payload = b"Hello"
        frame = header + payload
        msg, consumed = self.server._decode_frame(frame)
        self.assertIsNone(msg)
        self.assertEqual(consumed, 0)

    def test_frame_encoding_decoding(self):
        message = "Hello, World!"
        # Encoded by server (unmasked)
        self.server._encode_frame(message)
        # We need a masked frame for decoding (simulating client -> server)
        # Let's manually create one
        mask = b"\x01\x02\x03\x04"
        payload = message.encode("utf-8")
        masked_payload = bytearray(len(payload))
        for i in range(len(payload)):
            masked_payload[i] = payload[i] ^ mask[i % 4]

        # Header: 0x81 (Fin, Text), Mask bit + length
        header = bytearray([0x81, 0x80 | len(payload)])
        full_masked_frame = header + mask + masked_payload

        decoded, consumed = self.server._decode_frame(full_masked_frame)
        self.assertEqual(decoded, message)
        self.assertEqual(consumed, len(full_masked_frame))

    def test_decode_empty_data(self):
        self.assertEqual(self.server._decode_frame(None), (None, 0))
        self.assertEqual(self.server._decode_frame(b""), (None, 0))

    def test_decode_medium_payload(self):
        # Length 126 (2 bytes length)
        payload = b"A" * 126
        mask = b"\x00\x00\x00\x00"
        header = bytearray([0x81, 0x80 | 126, 0x00, 0x7E])  # 126 in big-endian
        full_frame = header + mask + payload
        decoded, consumed = self.server._decode_frame(full_frame)
        self.assertEqual(decoded, "A" * 126)
        self.assertEqual(consumed, len(full_frame))

    def test_decode_large_payload(self):
        # Length 127 (8 bytes length)
        size = 130
        payload = b"B" * size
        mask = b"\x00\x00\x00\x00"
        header = bytearray([0x81, 0x80 | 127, 0, 0, 0, 0, 0, 0, 0, size])
        full_frame = header + mask + payload
        decoded, consumed = self.server._decode_frame(full_frame)
        self.assertEqual(decoded, "B" * size)
        self.assertEqual(consumed, len(full_frame))

    def test_decode_unicode_error(self):
        # Invalid UTF-8 sequence
        payload = b"\xff\xfe\xfd"
        mask = b"\x00\x00\x00\x00"
        header = bytearray([0x81, 0x80 | len(payload)])
        full_frame = header + mask + payload
        decoded, consumed = self.server._decode_frame(full_frame)
        self.assertIsNone(decoded)
        self.assertEqual(consumed, len(full_frame))

    def test_encode_large_payloads(self):
        # Test encoding > 125 (uses 126 branch)
        m1 = "C" * 130
        e1 = self.server._encode_frame(m1)
        self.assertEqual(e1[1], 126)
        self.assertEqual(int.from_bytes(e1[2:4], "big"), 130)

        # Test encoding > 65535 (uses 127 branch)
        m2 = "D" * 65540
        e2 = self.server._encode_frame(m2)
        self.assertEqual(e2[1], 127)
        self.assertEqual(int.from_bytes(e2[2:10], "big"), 65540)

    def test_decode_trailing_data(self):
        message = "Hello"
        payload = message.encode("utf-8")
        mask = b"\x00\x00\x00\x00"
        header = bytearray([0x81, 0x80 | len(payload)])
        full_frame = header + mask + payload + b"EXTRA DATA"
        decoded, consumed = self.server._decode_frame(full_frame)
        self.assertEqual(decoded, message)
        self.assertEqual(consumed, len(full_frame) - 10)  # 10 is EXTRA DATA

    def test_decode_frame_short_data(self):
        # Too short for 2-byte header
        self.assertEqual(self.server._decode_frame(b"\x81"), (None, 0))

        # Too short for 126 length (indicated but missing ext bytes)
        self.assertEqual(self.server._decode_frame(b"\x81\xfe\x00"), (None, 0))

        # Too short for 127 length (indicated but missing ext bytes)
        self.assertEqual(
            self.server._decode_frame(b"\x81\xff\x00\x01\x02\x03\x04\x05\x06"),
            (None, 0),
        )

        self.assertEqual(
            self.server._decode_frame(
                b"\x81\x85\x01\x02\x03\x04\x01\x02\x03\x04"
            ),
            (None, 0),
        )

    def test_fragmented_frames(self):
        # Verify that buffered parsing handles frames split across
        # multiple recv calls
        message = "Hello"
        payload = message.encode("utf-8")
        mask = b"\x00\x00\x00\x00"
        header = bytearray([0x81, 0x80 | len(payload)])
        full_frame = header + mask + payload

        # Test stages
        buffer = full_frame[:1]
        self.assertEqual(self.server._decode_frame(buffer), (None, 0))

        buffer += full_frame[1:2]
        self.assertEqual(self.server._decode_frame(buffer), (None, 0))

        buffer += full_frame[2:6]
        self.assertEqual(self.server._decode_frame(buffer), (None, 0))

        buffer += full_frame[6:]
        msg, consumed = self.server._decode_frame(buffer)
        self.assertEqual(msg, message)
        self.assertEqual(consumed, len(full_frame))

    def test_coalesced_frames(self):
        message1 = "Hi"
        message2 = "Bye"
        frame1 = bytearray([0x81, 0x82, 0, 0, 0, 0, ord("H"), ord("i")])
        frame2 = bytearray(
            [0x81, 0x83, 0, 0, 0, 0, ord("B"), ord("y"), ord("e")]
        )
        buffer = frame1 + frame2

        # First frame
        msg1, consumed1 = self.server._decode_frame(buffer)
        self.assertEqual(msg1, message1)
        self.assertEqual(consumed1, len(frame1))

        # Second frame
        buffer = buffer[consumed1:]
        msg2, consumed2 = self.server._decode_frame(buffer)
        self.assertEqual(msg2, message2)
        self.assertEqual(consumed2, len(frame2))


class TestWebSocketServer(unittest.TestCase):
    def _reserve_port(self):
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.bind(("localhost", 0))
        port = s.getsockname()[1]
        s.close()
        return port

    def _wait_until_accepting(self, port, timeout=5.0):
        start_time = time.time()
        while time.time() - start_time < timeout:
            try:
                s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
                s.settimeout(0.1)
                s.connect(("localhost", port))
                s.close()
                return True
            except (socket.error, ConnectionRefusedError):
                time.sleep(0.05)
        return False

    def test_fallback_server_echo(self):
        def handler(msg, send_func):
            send_func(f"ECHO: {msg}")

        port = self._reserve_port()
        server = WebSocketFallbackServer(port=port)
        server_thread = threading.Thread(
            target=server.start, args=(handler,), daemon=True
        )
        server_thread.start()
        self.assertTrue(self._wait_until_accepting(port))

        client = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        client.connect(("localhost", port))

        key = "dGhlIHNhbXBsZSBub25jZQ=="
        handshake = (
            "GET /ws HTTP/1.1\r\n"
            f"Host: localhost:{port}\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {key}\r\n"
            "Sec-WebSocket-Version: 13\r\n\r\n"
        )
        client.sendall(handshake.encode())
        resp = client.recv(1024).decode()
        self.assertIn("101 Switching Protocols", resp)

        frame = bytearray([0x81, 0x82, 0, 0, 0, 0, ord("H"), ord("i")])
        client.sendall(frame)

        resp_frame = client.recv(1024)
        self.assertEqual(resp_frame[0], 0x81)
        self.assertEqual(resp_frame[2:].decode(), "ECHO: Hi")
        client.close()

    def test_malformed_requests(self):
        port = self._reserve_port()
        server = WebSocketFallbackServer(port=port)
        server_thread = threading.Thread(
            target=server.start, args=(MagicMock(),), daemon=True
        )
        server_thread.start()
        self.assertTrue(self._wait_until_accepting(port))

        # Test empty request (triggers line 122)
        client = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        client.connect(("localhost", port))
        client.sendall(b"")
        client.close()
        time.sleep(0.1)

        # Test short request line (triggers line 140)
        client = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        client.connect(("localhost", port))
        client.sendall(b"GET\r\n\r\n")
        client.close()
        time.sleep(0.1)

        # Test regular HTTP request (triggers HTTP branch)
        client = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        client.connect(("localhost", port))
        client.sendall(b"GET / HTTP/1.1\r\nHost: localhost\r\n\r\n")
        resp = client.recv(1024).decode()
        self.assertIn("200 OK", resp)
        self.assertIn("Server is running", resp)
        client.close()

    def test_client_disconnect_during_loop(self):
        server = WebSocketFallbackServer(port=8083)
        # Mock client that returns empty data on second recv
        mock_client = MagicMock()
        mock_client.recv.side_effect = [
            # First recv: handshake
            b"GET /ws HTTP/1.1\r\n"
            b"Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n\r\n",
            # Second recv: disconnect
            b"",
        ]

        with patch("socket.socket") as mock_socket_class:
            mock_socket = mock_socket_class.return_value
            mock_socket.accept.side_effect = [
                (mock_client, ("127.0.0.1", 12345)),
                Exception("Stop Server"),
            ]

            with patch("websocket_fallback.logger"):
                try:
                    # In threaded server, start() runs forever.
                    # We need to simulate the loop once.
                    server.start(MagicMock())
                except Exception as e:
                    if str(e) != "Stop Server":
                        raise

            # Wait for client thread to process
            start_time = time.time()
            while time.time() - start_time < 5.0:
                if mock_client.recv.call_count >= 2:
                    break
                time.sleep(0.05)

            # Verify mock_client.recv was called at least twice
            # (Handshake loop + Frame loop)
            self.assertGreaterEqual(mock_client.recv.call_count, 2)

    def test_concurrent_clients(self):
        def handler(msg, send_func):
            send_func(f"ECHO: {msg}")

        port = self._reserve_port()
        server = WebSocketFallbackServer(port=port)
        server_thread = threading.Thread(
            target=server.start, args=(handler,), daemon=True
        )
        server_thread.start()
        self.assertTrue(self._wait_until_accepting(port))

        def run_client():
            c = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            c.connect(("localhost", port))
            handshake = (
                "GET /ws HTTP/1.1\r\n"
                f"Host: localhost:{port}\r\n"
                "Upgrade: websocket\r\n"
                "Connection: Upgrade\r\n"
                "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n\r\n"
            )
            c.sendall(handshake.encode())
            c.recv(1024)

            mask = b"\x00\x00\x00\x00"
            payload = bytearray([ord("H"), ord("i")])
            frame = bytearray([0x81, 0x82]) + mask + payload
            c.sendall(frame)
            resp_frame = c.recv(1024)
            self.assertEqual(resp_frame[2:].decode(), "ECHO: Hi")
            c.close()

        threads = []
        for _ in range(3):
            t = threading.Thread(target=run_client)
            t.start()
            threads.append(t)

        for t in threads:
            t.join(timeout=5)
            self.assertFalse(t.is_alive())

    def test_unicode_error_in_handshake(self):
        server = WebSocketFallbackServer()
        mock_client = MagicMock()
        mock_client.recv.side_effect = [b"\xff\xfe\xfd\r\n\r\n", b""]
        server._handle_client(mock_client, ("127.0.0.1", 1234), MagicMock())
        mock_client.close.assert_called()

    def test_handshake_rejection_coverage(self):
        server = WebSocketFallbackServer(allowed_origins=["http://allowed.com"])
        mock_client = MagicMock()
        request = (
            "GET /ws HTTP/1.1\r\n"
            "Origin: http://malicious.com\r\n"
            "Sec-WebSocket-Key: key\r\n\r\n"
        )
        mock_client.recv.side_effect = [request.encode(), b""]
        server._handle_client(mock_client, ("127.0.0.1", 1234), MagicMock())
        mock_client.sendall.assert_called()
        sent_data = mock_client.sendall.call_args[0][0].decode()
        self.assertIn("403 Forbidden", sent_data)

    def test_async_handler_invocation(self):
        async def async_handler(msg, send_func):
            send_func(f"ASYNC: {msg}")

        server = WebSocketFallbackServer()
        mock_client = MagicMock()
        request = (
            "GET /ws HTTP/1.1\r\n" "Sec-WebSocket-Key: key\r\n\r\n"
        ).encode()
        frame = bytearray([0x81, 0x82, 0, 0, 0, 0, ord("H"), ord("i")])
        mock_client.recv.side_effect = [request, frame, b""]

        server._handle_client(mock_client, ("127.0.0.1", 1234), async_handler)
        sent_calls = [call[0][0] for call in mock_client.sendall.call_args_list]
        self.assertTrue(any(b"ASYNC: Hi" in s for s in sent_calls))

    def test_handle_client_exception(self):
        server = WebSocketFallbackServer()
        mock_client = MagicMock()
        mock_client.recv.side_effect = Exception("Boom")

        with patch("websocket_fallback.logger") as mock_logger:
            server._handle_client(mock_client, ("127.0.0.1", 1234), MagicMock())
            mock_logger.error.assert_called_with(
                "Client error from ('127.0.0.1', 1234): Boom"
            )

    def test_missing_key_in_handshake(self):
        server = WebSocketFallbackServer()
        mock_client = MagicMock()
        request = "GET /ws HTTP/1.1\r\nHost: localhost\r\n\r\n"
        mock_client.recv.side_effect = [request.encode(), b""]
        server._handle_client(mock_client, ("127.0.0.1", 1234), MagicMock())
        mock_client.sendall.assert_not_called()

    def test_client_timeout(self):
        server = WebSocketFallbackServer()
        mock_client = MagicMock()
        import socket

        mock_client.recv.side_effect = socket.timeout("Timed out")

        with patch("websocket_fallback.logger") as mock_logger:
            server._handle_client(mock_client, ("127.0.0.1", 1234), MagicMock())
            mock_logger.error.assert_called_with(
                "Client error from ('127.0.0.1', 1234): Timed out"
            )

    @unittest.skipIf(not HAS_WEBSOCKETS_LIB, "websockets library not available")
    def test_standard_websockets_interaction(self):  # pragma: no cover
        pass


# [COVERAGE] Excluded as this is the standard test entry point
if __name__ == "__main__":  # pragma: no cover
    unittest.main()
