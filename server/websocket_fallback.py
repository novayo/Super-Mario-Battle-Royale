import socket
import hashlib
import base64
import struct
import logging
import asyncio
import threading
import inspect

# Configure logging
logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


class WebSocketFallbackServer:
    """
    A minimal, zero-dependency WebSocket server (RFC 6455)
    using only Python's built-in modules.
    """

    def __init__(self, host="localhost", port=8080, allowed_origins=None):
        self.host = host
        self.port = port
        if allowed_origins is None:
            self.allowed_origins = [
                "http://localhost:3000",
                "http://127.0.0.1:3000",
            ]
        else:
            self.allowed_origins = allowed_origins
        self.GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"

    def _get_handshake_response(self, key, origin=None):
        if origin and origin not in self.allowed_origins:
            logger.warning(f"Handshake rejected: origin '{origin}' not allowed")
            return (
                "HTTP/1.1 403 Forbidden\r\n"
                "Content-Type: text/plain\r\n"
                "Connection: close\r\n"
                "\r\n"
                "Forbidden: Origin not allowed"
            )

        accept_key = base64.b64encode(
            hashlib.sha1((key + self.GUID).encode()).digest()
        ).decode()
        response = (
            "HTTP/1.1 101 Switching Protocols\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            "Sec-WebSocket-Accept: " + accept_key + "\r\n"
        )
        if origin:
            response += f"Access-Control-Allow-Origin: {origin}\r\n"
        response += "\r\n"
        return response

    def _decode_frame(self, data):
        if not data or len(data) < 2:
            return None, 0

        # Parse minimal frame headers
        second_byte = data[1]

        # RFC 6455: Client-to-server frames must be masked
        if (second_byte & 0x80) == 0:
            return None, 0

        payload_len = second_byte & 127

        mask_start = 2
        if payload_len == 126:
            if len(data) < 4:
                return None, 0
            payload_len = struct.unpack("!H", data[2:4])[0]
            mask_start = 4
        elif payload_len == 127:
            if len(data) < 10:
                return None, 0
            payload_len = struct.unpack("!Q", data[2:10])[0]
            mask_start = 10

        # Basic masking handling for client-to-server frames
        if len(data) < mask_start + 4:
            return None, 0

        mask_key = data[mask_start : mask_start + 4]
        payload_start = mask_start + 4

        if len(data) < payload_start + payload_len:
            return None, 0

        payload = data[payload_start : payload_start + payload_len]
        total_len = payload_start + payload_len

        decoded = bytearray(len(payload))
        for i in range(len(payload)):
            decoded[i] = payload[i] ^ mask_key[i % 4]

        try:
            return decoded.decode("utf-8"), total_len
        except UnicodeDecodeError:
            return None, total_len

    def _encode_frame(self, message):
        message_bytes = message.encode("utf-8")
        header = bytearray([0x81])  # Fin=1, Opcode=1 (text)

        length = len(message_bytes)
        if length <= 125:
            header.append(length)
        elif length <= 65535:
            header.append(126)
            header.extend(struct.pack("!H", length))
        else:
            header.append(127)
            header.extend(struct.pack("!Q", length))

        return header + message_bytes

    def _handle_client(self, client, addr, handler):
        logger.info(f"Connection from {addr}")
        client.settimeout(10.0)
        buffer = b""
        try:
            # Phase 1: Wait for full HTTP handshake
            while b"\r\n\r\n" not in buffer:
                data = client.recv(2048)
                if not data:
                    return
                buffer += data

            header_end = buffer.find(b"\r\n\r\n") + 4
            request_bytes = buffer[:header_end]
            buffer = buffer[
                header_end:
            ]  # Keep remaining data for WebSocket frames

            try:
                request_text = request_bytes.decode("utf-8")
            except UnicodeDecodeError:
                return

            lines = request_text.split("\r\n")

            request_line = lines[0].split(" ")
            if len(request_line) < 2:
                return

            method, path = request_line[0], request_line[1]
            headers = {}
            for line in lines[1:]:
                if ":" in line:
                    k, v = line.split(":", 1)
                    headers[k.strip().lower()] = v.strip()

            if method == "GET" and path == "/ws":
                key = headers.get("sec-websocket-key")
                origin = headers.get("origin")

                if not key:
                    logger.warning(
                        f"Handshake rejected from {addr}: missing key"
                    )
                    return

                handshake = self._get_handshake_response(key, origin)
                client.sendall(handshake.encode())

                if "101 Switching Protocols" not in handshake:
                    logger.warning(f"Handshake failed for origin: {origin}")
                    return

                logger.info(f"Handshake successful for /ws from {origin}")
                # Reliable connection established; disable handshake timeout
                client.settimeout(None)

                # Phase 2: Handle WebSocket frames with buffering
                while True:
                    # Parse all possible frames from current buffer
                    while True:
                        message, consumed = self._decode_frame(buffer)
                        if consumed == 0:
                            break

                        buffer = buffer[consumed:]

                        if message is not None:

                            def send_func(msg):
                                client.sendall(self._encode_frame(msg))

                            res = handler(message, send_func)
                            if inspect.isawaitable(res):
                                asyncio.run(res)

                    # Read more data if buffer doesn't have a full frame
                    data = client.recv(2048)
                    if not data:
                        break
                    buffer += data
            else:
                response = (
                    "HTTP/1.1 200 OK\r\n"
                    "Content-Type: text/plain\r\n"
                    "Content-Length: 17\r\n"
                    "Connection: close\r\n"
                    "\r\n"
                    "Server is running"
                )
                client.sendall(response.encode())
        except (Exception, socket.timeout) as e:
            logger.error(f"Client error from {addr}: {e}")
        finally:
            client.close()
            logger.info(f"Connection closed for {addr}")

    def start(self, handler):
        """Starts the server and spawns _handle_client threads."""
        server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        server.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        server.bind((self.host, self.port))
        server.listen(5)
        logger.info(f"FALLBACK: Server running on ws://{self.host}:{self.port}")

        while True:
            client, addr = server.accept()
            # Spawn a thread for each client to handle it concurrently
            thread = threading.Thread(
                target=self._handle_client,
                args=(client, addr, handler),
                daemon=True,
            )
            thread.start()
