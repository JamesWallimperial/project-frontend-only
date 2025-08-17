import sys
sys.path.append('/home/jwall/project-root/src')  # For importing backend modules

import lvgl as lv
import display_driver  # From LVGL bindings for unix framebuffer

# Import example backend functions (adjust based on your actual modules)
from devices.tapo.tapo_toggle import toggle_tapo_device  # E.g., for Tapo plug control
from voice.intent_router import route_intent  # E.g., for voice command handling
from common.config import load_config  # Load any needed config

# Basic init
lv.init()

# Display driver setup (match your circular screen resolution)
disp_drv = lv.disp_drv_t()
disp_drv.init()
disp_drv.flush_cb = display_driver.flush
disp_drv.hor_res = 480  # Adjust if your display differs
disp_drv.ver_res = 480
disp_drv.register()

# Optional: Touch input if your display supports it
indev_drv = lv.indev_drv_t()
indev_drv.init()
indev_drv.type = lv.INDEV_TYPE.POINTER  # For touchscreen
indev_drv.read_cb = display_driver.touch_read  # Assumes bindings handle this
indev_drv.register()

# Create main screen
scr = lv.obj()

# Centered label for status (basic data display)
label = lv.label(scr)
label.set_text("Smart Device Status: Ready")
label.align(lv.ALIGN.CENTER, 0, -50)  # Position near center for circular fit

# Radial arc for visual feedback (e.g., progress or status indicator)
arc = lv.arc(scr)
arc.set_size(200, 200)  # Fits within circular bounds
arc.set_angles(0, 360)  # Full circle
arc.align(lv.ALIGN.CENTER, 0, 0)  # Perfect for radial layout
arc.set_value(50)  # Example value; update from backend

# Button for backend integration (e.g., toggle Tapo device)
btn = lv.btn(scr)
btn.set_size(150, 50)
btn.align(lv.ALIGN.BOTTOM_MID, 0, -20)
btn_label = lv.label(btn)
btn_label.set_text("Toggle Light")

def btn_event_cb(event):
    if event.code == lv.EVENT.CLICKED:
        result = toggle_tapo_device('light1')  # Call your backend function
        label.set_text("Status: " + result)  # Update UI with backend response
        arc.set_value(100 if 'on' in result else 0)  # Visual feedback

btn.set_event_cb(btn_event_cb)

# Load config and initial data (rapid integration)
config = load_config()  # From your common/config.py
label.set_text("Status: " + route_intent("init"))  # Example voice intent call

lv.scr_load(scr)

# Event loop
while True:
    lv.tick_inc(5)
    lv.task_handler()
