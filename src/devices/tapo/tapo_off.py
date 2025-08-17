import asyncio
import sys; print(sys.executable)
from tapo import ApiClient

EMAIL = "jfbwall@gmail.com"
PASSWORD = "Mhtufcn7TP"
IP = "10.42.0.204" # plug IP

async def main():
 client = ApiClient(EMAIL, PASSWORD)
 device = await client.p100(IP) # use client.p110(IP) if your plug is P110/P115
 await device.off()
 print("Tapo: OFF")

if __name__ == "__main__":
	
 asyncio.run(main())
