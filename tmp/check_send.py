import asyncio
import websockets
import inspect

async def main():
    print(f"websockets.WebSocketCommonProtocol.send is coroutine function: {inspect.iscoroutinefunction(websockets.WebSocketCommonProtocol.send)}")
    
if __name__ == "__main__":
    asyncio.run(main())
