import unittest
import socket
import threading
import time
import struct
import main
from websocket_fallback import WebSocketFallbackServer
import player_pb2


class TestIntegration(unittest.TestCase):

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

    def _wait_for(self, predicate, timeout=5.0, interval=0.05):
        start_time = time.time()
        while time.time() - start_time < timeout:
            if predicate():
                return True
            time.sleep(interval)
        self.fail("Timeout waiting for predicate")

    def setUp(self):
        main.PLAYERS.clear()
        main.CONNECTIONS.clear()
        main.CONNECTION_TO_PLAYER.clear()
        main.SEND_LOCKS.clear()
        main.ASYNC_SEND_LOCKS.clear()

    def tearDown(self):
        if hasattr(self, "server"):
            self.server.stop()
        if hasattr(self, "server_thread"):
            self.server_thread.join(timeout=1.0)

    def test_player_removed_on_disconnect(self):
        self.server = WebSocketFallbackServer(port=0)

        self.server_thread = threading.Thread(
            target=self.server.start,
            args=(main.handle_message, main.on_disconnect),
            daemon=True,
        )
        self.server_thread.start()

        # Wait for server to bind and set port
        def port_ready():
            return self.server.port != 0

        self._wait_for(port_ready)

        port = self.server.port

        # Wait until accepting
        self.assertTrue(self._wait_until_accepting(port))

        # Connect client
        client = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        client.connect(("localhost", port))

        # Handshake
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

        # Send player update
        update = player_pb2.ClientPlayerUpdate()
        update.x = 10
        update.y = 20
        payload = update.SerializeToString()

        mask = b"\x00\x00\x00\x00"
        masked_payload = payload

        length = len(payload)
        if length <= 125:
            header = bytearray([0x82, 0x80 | length])
        elif length <= 65535:
            header = bytearray([0x82, 0x80 | 126]) + struct.pack("!H", length)
        else:
            header = bytearray([0x82, 0x80 | 127]) + struct.pack("!Q", length)

        frame = header + mask + masked_payload
        client.sendall(frame)

        # Wait for message to be processed
        self._wait_for(lambda: len(main.PLAYERS) == 1)
        player_id = list(main.PLAYERS.keys())[0]
        self.assertEqual(main.PLAYERS[player_id].x, 10)
        self.assertEqual(main.PLAYERS[player_id].y, 20)

        # Disconnect client
        client.close()

        # Wait for disconnect to be processed
        self._wait_for(lambda: player_id not in main.PLAYERS)


if __name__ == "__main__":
    unittest.main()
