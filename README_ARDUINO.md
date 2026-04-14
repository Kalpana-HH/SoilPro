# SoilGuard Pro: ESP32 Firmware Setup

This guide will help you set up your ESP32 to send real-time soil data to your SoilGuard Pro dashboard.

## Hardware Requirements
- **Microcontroller**: ESP32 (DevKit V1 recommended)
- **NPK Sensor**: RS485 Soil NPK Sensor (7-in-1 or 3-in-1)
- **RS485 to TTL Adapter**: MAX485 or similar (to connect NPK sensor to ESP32)
- **Temp/Humidity**: DHT22 or DHT11 sensor

## Wiring Diagram
| Component | ESP32 Pin | Notes |
| :--- | :--- | :--- |
| **DHT22 Data** | GPIO 4 | Use a 10k pull-up resistor if not on a module |
| **RS485 RO** | GPIO 16 (RX2) | Receive Data |
| **RS485 DI** | GPIO 17 (TX2) | Transmit Data |
| **RS485 DE/RE** | GPIO 18 | Combined Data Enable / Receive Enable |
| **Power** | 3.3V / 5V | Check your sensor requirements |

## Software Setup
1. Open the Arduino IDE.
2. Go to **Sketch** -> **Include Library** -> **Manage Libraries**.
3. Install the following libraries:
   - `Firebase ESP Client` by Mobizt
   - `DHT sensor library` by Adafruit
   - `Adafruit Unified Sensor` by Adafruit
4. Copy the code from `soil_guard_firmware.ino` into a new Arduino sketch.
5. Update the `WIFI_SSID`, `WIFI_PASSWORD`, and `USER_EMAIL` constants in the code.

## Firebase Configuration
The code is pre-configured with your Project ID: `gen-lang-client-0491916331`.
You will need to create a **Service Account Key** in the Firebase Console to get the `FIREBASE_AUTH_TOKEN` (Database Secret or Service Account JSON).

> [!TIP]
> For testing, you can use the **Debug Tools** in the web app to simulate data before you finish your hardware build!
