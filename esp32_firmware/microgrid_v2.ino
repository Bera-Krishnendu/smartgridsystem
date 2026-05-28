/*
 * ============================================================
 *  DC MICROGRID ESP32 FIRMWARE  –  v2.0  (Web Dashboard Ready)
 *  Added: /api/data JSON endpoint with CORS for React dashboard
 * ============================================================
 */

#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>   // Install via Library Manager: "ArduinoJson" by Benoit Blanchon

// ──────────────────────────────────────────────────────────
// 1. NETWORK CONFIGURATION
// ──────────────────────────────────────────────────────────
const char* ssid     = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

WebServer server(80);
LiquidCrystal_I2C lcd(0x27, 16, 2);

// ──────────────────────────────────────────────────────────
// 2. PIN DEFINITIONS
// ──────────────────────────────────────────────────────────
#define SOLAR_V_PIN  34
#define WIND_V_PIN   35
#define BATT_V_PIN   32
#define SOLAR_I_PIN  33
#define LOAD_I_PIN   25
#define RELAY_PIN    26

// ──────────────────────────────────────────────────────────
// 3. GLOBAL SENSOR VALUES
// ──────────────────────────────────────────────────────────
float   solarV = 0, windV = 0, battV = 0;
float   solarI = 0, loadI = 0;
String  relayStatus = "ON";

// ──────────────────────────────────────────────────────────
// 4. SENSOR MATH
// ──────────────────────────────────────────────────────────
float readVoltage(int pin) {
  float raw = analogRead(pin);
  return (raw * 3.3f / 4095.0f) * 5.0f;   // 5:1 hardware divider
}

float readCurrent(int pin) {
  float raw  = analogRead(pin);
  float volts = raw * (3.3f / 4095.0f);
  return (volts - 1.65f) / 0.066f;         // ACS712-20A sensitivity
}

// ──────────────────────────────────────────────────────────
// 5. CORS HELPER  ← Required so the React dashboard can fetch
// ──────────────────────────────────────────────────────────
void addCorsHeaders() {
  server.sendHeader("Access-Control-Allow-Origin",  "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
}

// ──────────────────────────────────────────────────────────
// 6. /api/data  – JSON endpoint consumed by React dashboard
// ──────────────────────────────────────────────────────────
void handleApiData() {
  addCorsHeaders();

  StaticJsonDocument<256> doc;
  doc["solarV"]      = round(solarV * 10) / 10.0;
  doc["windV"]       = round(windV  * 10) / 10.0;
  doc["battV"]       = round(battV  * 10) / 10.0;
  doc["solarI"]      = round(solarI * 10) / 10.0;
  doc["loadI"]       = round(loadI  * 10) / 10.0;
  doc["relayStatus"] = relayStatus;

  String payload;
  serializeJson(doc, payload);
  server.send(200, "application/json", payload);
}

// ──────────────────────────────────────────────────────────
// 7. / – Minimal root handler (dashboard lives on Netlify)
// ──────────────────────────────────────────────────────────
void handleRoot() {
  addCorsHeaders();
  String html = "<html><body style='font-family:monospace;background:#0d1117;color:#22d3ee;padding:30px'>";
  html += "<h2>⚡ DC Microgrid ESP32</h2>";
  html += "<p>JSON API endpoint: <a href='/api/data' style='color:#4ade80'>/api/data</a></p>";
  html += "<p>Use the React dashboard on Netlify and enter this IP: <strong>" + WiFi.localIP().toString() + "</strong></p>";
  html += "</body></html>";
  server.send(200, "text/html", html);
}

// Handle OPTIONS pre-flight (browser CORS check)
void handleOptions() {
  addCorsHeaders();
  server.send(204);
}

// ──────────────────────────────────────────────────────────
// 8. SETUP
// ──────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);

  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, HIGH);   // Relay ON at boot

  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0); lcd.print("BOOT: MICROGRID");
  lcd.setCursor(0, 1); lcd.print("WIFI CONNECTING");

  WiFi.begin(ssid, password);
  Serial.print("Connecting");
  while (WiFi.status() != WL_CONNECTED) { delay(500); Serial.print("."); }
  Serial.println("\nWiFi connected. IP: " + WiFi.localIP().toString());

  // Register routes
  server.on("/",         HTTP_GET,     handleRoot);
  server.on("/api/data", HTTP_GET,     handleApiData);
  server.on("/api/data", HTTP_OPTIONS, handleOptions);
  server.begin();

  lcd.clear();
  lcd.setCursor(0, 0); lcd.print("WIFI OK!");
  lcd.setCursor(0, 1); lcd.print(WiFi.localIP());
  delay(4000);
}

// ──────────────────────────────────────────────────────────
// 9. MAIN LOOP
// ──────────────────────────────────────────────────────────
void loop() {
  server.handleClient();

  // Sample sensors
  solarV = readVoltage(SOLAR_V_PIN);
  windV  = readVoltage(WIND_V_PIN);
  battV  = readVoltage(BATT_V_PIN);
  solarI = readCurrent(SOLAR_I_PIN);
  loadI  = readCurrent(LOAD_I_PIN);

  // LCD update
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("S:"); lcd.print(solarV, 1); lcd.print("V W:"); lcd.print(windV, 1); lcd.print("V");
  lcd.setCursor(0, 1);
  lcd.print("B:"); lcd.print(battV, 1); lcd.print("V I:"); lcd.print(loadI, 1); lcd.print("A");

  // Battery hysteresis protection
  if (battV < 11.0f) {
    digitalWrite(RELAY_PIN, LOW);
    relayStatus = "OFF (LOW BATTERY)";
  } else if (battV > 12.0f) {
    digitalWrite(RELAY_PIN, HIGH);
    relayStatus = "ON";
  }

  delay(200);
}
