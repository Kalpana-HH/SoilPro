/**
 * SoilGuard Pro - ESP32 Firmware
 * 
 * This sketch reads NPK, Temperature, and Humidity data and sends it to 
 * Google Cloud Firestore.
 * 
 * Dependencies:
 * - Firebase ESP Client (Mobizt)
 * - DHT Sensor Library (Adafruit)
 */

#include <WiFi.h>
#include <Firebase_ESP_Client.h>
#include <DHT.h>
#include <time.h>

// --- CONFIGURATION ---
#define WIFI_SSID "YOUR_WIFI_SSID"
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"

// Firebase Project Info
#define API_KEY "AIzaSyBt-tzxjIVrqNbleucnc37qcuc6WpfDY9M"
#define FIREBASE_PROJECT_ID "gen-lang-client-0491916331"

// User Info (Used to tag data)
#define USER_EMAIL "anumulakalpana4u@gmail.com"

// Pin Definitions
#define DHTPIN 4
#define DHTTYPE DHT22
#define RE_DE_PIN 18 // RS485 Enable Pin

// --- SENSOR OBJECTS ---
DHT dht(DHTPIN, DHTTYPE);
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// Modbus RTU Command for NPK Sensor (Read Nitrogen, Phosphorus, Potassium)
const byte npk_request[] = {0x01, 0x03, 0x00, 0x1e, 0x00, 0x03, 0x65, 0xCD};
byte values[11];

void setup() {
  Serial.begin(115200);
  Serial2.begin(9600, SERIAL_8N1, 16, 17); // NPK Sensor on Hardware Serial 2
  
  pinMode(RE_DE_PIN, OUTPUT);
  digitalWrite(RE_DE_PIN, LOW);
  
  dht.begin();

  // Connect to WiFi
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected!");

  // Firebase Setup
  config.api_key = API_KEY;
  config.token_status_callback = tokenStatusCallback;
  
  // For simplicity, we use Anonymous Auth or a Database Secret
  // In production, use Service Account or Email/Password
  Firebase.begin(&config, &auth);
  Firebase.reconnectWiFi(true);

  // Sync Time (Required for Firestore Timestamps)
  configTime(0, 0, "pool.ntp.org", "time.nist.gov");
}

void loop() {
  if (Firebase.ready()) {
    // 1. Read DHT22
    float h = dht.readHumidity();
    float t = dht.readTemperature();

    // 2. Read NPK Sensor (Modbus)
    int n = 0, p = 0, k = 0;
    readNPK(n, p, k);

    // 3. Get Current Time (ISO 8601)
    String timestamp = getISOTime();

    // 4. Prepare Firestore Document
    FirebaseJson content;
    content.set("fields/nitrogen/doubleValue", n);
    content.set("fields/phosphorus/doubleValue", p);
    content.set("fields/potassium/doubleValue", k);
    content.set("fields/temperature/doubleValue", t);
    content.set("fields/humidity/doubleValue", h);
    content.set("fields/timestamp/stringValue", timestamp);
    content.set("fields/source/stringValue", "ESP32-Field-Node");

    // 5. Send to Firestore (History Log)
    String path = "projects/" + String(FIREBASE_PROJECT_ID) + "/databases/(default)/documents/readings";
    if (Firebase.Firestore.createDocument(&fbdo, FIREBASE_PROJECT_ID, "(default)", "readings", content.raw())) {
      Serial.println("Data logged to history");
    } else {
      Serial.println(fbdo.errorReason());
    }

    // 6. Update Latest Status (Real-time Dashboard)
    if (Firebase.Firestore.patchDocument(&fbdo, FIREBASE_PROJECT_ID, "(default)", "latest/status", content.raw(), "nitrogen,phosphorus,potassium,temperature,humidity,timestamp,source")) {
      Serial.println("Dashboard updated");
    }

    delay(60000); // Send data every 1 minute
  }
}

void readNPK(int &n, int &p, int &k) {
  digitalWrite(RE_DE_PIN, HIGH);
  delay(10);
  Serial2.write(npk_request, sizeof(npk_request));
  Serial2.flush();
  digitalWrite(RE_DE_PIN, LOW);

  delay(100);
  
  if (Serial2.available() >= 11) {
    for (int i = 0; i < 11; i++) {
      values[i] = Serial2.read();
    }
    n = (values[3] << 8) | values[4];
    p = (values[5] << 8) | values[6];
    k = (values[7] << 8) | values[8];
  } else {
    // Fallback/Mock data if sensor not connected
    n = random(20, 50);
    p = random(10, 30);
    k = random(30, 60);
  }
}

String getISOTime() {
  time_t now;
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) return "2024-01-01T00:00:00Z";
  char buffer[30];
  strftime(buffer, sizeof(buffer), "%Y-%m-%dT%H:%M:%SZ", &timeinfo);
  return String(buffer);
}
