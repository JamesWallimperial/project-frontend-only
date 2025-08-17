import asyncio
import sys; print(sys.executable)
from tapo import ApiClient

EMAIL = "jfbwall@gmail.com"
PASSWORD = "Mhtufcn7TP"
IP = "10.42.0.204" # plug IP

async def main():
 client = ApiClient(EMAIL, PASSWORD)
 device = await client.p100(IP)
 info = await device.get_device_info()
 is_on = info.device_on
 if is_on:
  await device.off()
  print("Tapo: toggled OFF") 
 else:
  await device.on()
  print("Tapo: toggled ON")

if __name__ == "__main__":
	
 asyncio.run(main())
