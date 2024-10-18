## lightweight python script to test the sensor

## installing python and bme280 support:
# sudo apt update
# sudo apt install python3-pip
# pip install smbus2 RPi.bme280
# python test_bme280.py

import smbus2
import bme280

# I2C settings
I2C_PORT = 1  # Default I2C port for Raspberry Pi
BME280_ADDRESS = 0x76  # Default I2C address for BME280

# Create I2C bus
bus = smbus2.SMBus(I2C_PORT)

# Calibration parameters from the sensor
calibration_params = bme280.load_calibration_params(bus, BME280_ADDRESS)

# Read sensor data
data = bme280.sample(bus, BME280_ADDRESS, calibration_params)

# Print temperature, pressure, and humidity
print(f"Temperature: {data.temperature:.2f} °C")
print(f"Pressure: {data.pressure:.2f} hPa")
print(f"Humidity: {data.humidity:.2f} %")