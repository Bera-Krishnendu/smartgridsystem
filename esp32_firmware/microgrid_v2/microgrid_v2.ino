/*
 * ======================================================
 *  SMART DC MICROGRID OPERATION SYSTEM
 *  ESP32 + LCD + WEB DASHBOARD + SENSOR MONITORING
 * ======================================================
 *
 *  REQUIRED LIBRARIES (Install from Arduino Library Manager):
 *    1. ArduinoJson       by Benoit Blanchon
 *    2. LiquidCrystal I2C by Frank de Brabander
 *
 *  BOARD SELECTION:
 *    Tools > Board > ESP32 Arduino > ESP32 Dev Module
 *
 *  HOW IT WORKS:
 *    - Connects to your Wi-Fi network
 *    - Reads sensor data from analog pins
 *    - Serves a HTML dashboard at http://<ESP32_IP>/
 *    - Serves JSON sensor data at http://<ESP32_IP>/api/data
 *    - The React web app fetches /api/data every 2 seconds
 *
 * ======================================================
 */

#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>

/* ============================
   WIFI CONFIGURATION
   ============================ */
const char* ssid     = "SAPTAK2002";
const char* password = "123456789";

/* ============================
   IMAGE URL FOR HTML DASHBOARD
   ============================ */
const String imgSrc = "https://images.unsplash.com/photo-1509391366360-2e959784a276?q=80&w=1200";

/* ============================
   HARDWARE OBJECTS
   ============================ */
WebServer server(80);
LiquidCrystal_I2C lcd(0x27, 16, 2);

/* ============================
   PIN DEFINITIONS
   ============================ */
#define SOLAR_V_PIN 34
#define WIND_V_PIN  35
#define BATT_V_PIN  32
#define SOLAR_I_PIN 33
#define LOAD_I_PIN  25
#define RELAY_PIN   26

/* ============================
   GLOBAL SENSOR VARIABLES
   ============================ */
float solarV     = 0.0;
float windV      = 0.0;
float battV      = 0.0;
float solarI     = 0.0;
float loadI      = 0.0;
float solarPower = 0.0;
float loadPower  = 0.0;
String relayStatus = "ON";


/* ======================================================
   SENSOR READING FUNCTIONS
   ====================================================== */

float readVoltage(int pin) {
  int analogVal = analogRead(pin);
  float voltage = (analogVal * 3.3 / 4095.0);
  voltage = voltage * 5.0;  // 5:1 hardware voltage divider
  return voltage;
}

float readCurrent(int pin) {
  int value = analogRead(pin);
  float voltage = value * (3.3 / 4095.0);
  float current = (voltage - 1.65) / 0.066;  // ACS712-20A sensitivity
  return current;
}


/* ======================================================
   CORS HEADERS  (Required for React dashboard access)
   ====================================================== */

void addCorsHeaders() {
  server.sendHeader("Access-Control-Allow-Origin",  "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
}


/* ======================================================
   ROUTE:  GET /api/data
   Returns sensor readings as JSON for the React dashboard
   ====================================================== */

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


/* ======================================================
   ROUTE:  OPTIONS /api/data
   Handles browser CORS pre-flight checks
   ====================================================== */

void handleOptions() {
  addCorsHeaders();
  server.send(204);
}


/* ======================================================
   ROUTE:  GET /
   Serves a standalone HTML dashboard (no React needed)
   ====================================================== */

void handleRoot() {
  addCorsHeaders();

  String html = "<!DOCTYPE html><html><head>";
  html += "<meta charset='UTF-8'>";
  html += "<meta name='viewport' content='width=device-width, initial-scale=1.0'>";
  html += "<meta http-equiv='refresh' content='2'>";
  html += "<title>Smart DC Microgrid</title>";

  html += "<style>";
  html += "*{margin:0;padding:0;box-sizing:border-box;}";
  html += "body{font-family:Segoe UI;background:#0f1117;color:white;padding:15px;}";
  html += ".container{max-width:1000px;margin:auto;}";
  html += ".header{background:linear-gradient(135deg,#1e3c72,#2a5298);padding:20px;border-radius:20px;text-align:center;box-shadow:0 4px 15px rgba(0,0,0,0.4);}";
  html += ".header h1{font-size:32px;}";
  html += ".header p{margin-top:8px;color:#ddd;}";
  html += ".banner{width:100%;margin-top:20px;border-radius:15px;}";
  html += ".grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:18px;margin-top:25px;}";
  html += ".card{background:#1a1d29;padding:20px;border-radius:18px;box-shadow:0 5px 15px rgba(0,0,0,0.3);border-left:5px solid #00e676;}";
  html += ".card h2{font-size:18px;margin-bottom:12px;color:#ccc;}";
  html += ".value{font-size:32px;font-weight:bold;color:#00e676;}";
  html += ".status{margin-top:25px;background:#1a1d29;padding:20px;border-radius:18px;}";
  html += ".status-row{display:flex;justify-content:space-between;padding:12px;background:#242938;border-radius:10px;margin-top:10px;}";
  html += ".on{color:#00e676;font-weight:bold;}";
  html += ".off{color:#ff5252;font-weight:bold;}";
  html += ".footer{text-align:center;margin-top:25px;font-size:13px;color:#888;}";
  html += "</style></head><body><div class='container'>";

  html += "<div class='header'>";
  html += "<h1>⚡ SMART DC MICROGRID ⚡</h1>";
  html += "<p>Renewable Energy Monitoring & Control System</p>";
  html += "</div>";

  html += "<img src='" + imgSrc + "' class='banner'>";

  html += "<div class='grid'>";

  html += "<div class='card'><h2>☀ Solar Voltage</h2>";
  html += "<div class='value'>" + String(solarV, 1) + " V</div></div>";

  html += "<div class='card'><h2>☀ Solar Current</h2>";
  html += "<div class='value'>" + String(solarI, 1) + " A</div></div>";

  html += "<div class='card'><h2>🌬 Wind Voltage</h2>";
  html += "<div class='value'>" + String(windV, 1) + " V</div></div>";

  html += "<div class='card'><h2>🔋 Battery Voltage</h2>";
  html += "<div class='value'>" + String(battV, 1) + " V</div></div>";

  html += "<div class='card'><h2>⚡ Solar Power</h2>";
  html += "<div class='value'>" + String(solarPower, 1) + " W</div></div>";

  html += "<div class='card'><h2>🏠 Load Power</h2>";
  html += "<div class='value'>" + String(loadPower, 1) + " W</div></div>";

  html += "</div>";

  html += "<div class='status'><h2>System Status</h2>";

  html += "<div class='status-row'><span>WiFi Network</span>";
  html += "<span class='on'>CONNECTED</span></div>";

  html += "<div class='status-row'><span>Relay Status</span>";
  if (relayStatus == "ON") {
    html += "<span class='on'>ON</span>";
  } else {
    html += "<span class='off'>OFF</span>";
  }
  html += "</div>";

  html += "<div class='status-row'><span>ESP32 IP Address</span><span>";
  html += WiFi.localIP().toString();
  html += "</span></div>";

  html += "<div class='status-row'><span>JSON API</span>";
  html += "<span><a href='/api/data' style='color:#22d3ee;text-decoration:none'>/api/data</a></span></div>";

  html += "</div>";

  html += "<div class='footer'>ESP32 Smart Microgrid Dashboard</div>";
  html += "</div></body></html>";

  server.send(200, "text/html", html);
}


/* ======================================================
   SETUP
   ====================================================== */

void setup() {
  Serial.begin(115200);

  // Relay
  pinMode(RELAY_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, HIGH);

  // LCD
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("SMART MICROGRID");
  lcd.setCursor(0, 1);
  lcd.print("CONNECTING...");

  // WiFi
  WiFi.begin(ssid, password);
  Serial.print("Connecting WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.println("WiFi Connected");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());

  // Register all web server routes
  server.on("/",         HTTP_GET,     handleRoot);       // HTML dashboard
  server.on("/api/data", HTTP_GET,     handleApiData);    // JSON API for React app
  server.on("/api/data", HTTP_OPTIONS, handleOptions);    // CORS pre-flight
  server.begin();
  Serial.println("Web Server Started");

  // Show IP on LCD
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("WIFI CONNECTED");
  lcd.setCursor(0, 1);
  lcd.print(WiFi.localIP());
  delay(3000);
}


/* ============================
   NON-BLOCKING TIMER
   ============================ */
unsigned long lastSensorUpdate = 0;
const unsigned long SENSOR_INTERVAL = 2000;  // Update sensors every 2 seconds


/* ======================================================
   MAIN LOOP  (Non-blocking — web server responds instantly)
   ====================================================== */

void loop() {
  // CRITICAL: This must run on EVERY loop iteration
  // so the web server can respond to dashboard requests instantly
  server.handleClient();

  // Only update sensors, LCD, and serial every 2 seconds
  // Using millis() instead of delay() keeps the web server responsive
  unsigned long now = millis();
  if (now - lastSensorUpdate < SENSOR_INTERVAL) {
    return;  // Skip sensor work, but web server still runs above
  }
  lastSensorUpdate = now;

  // Read sensors
  solarV = readVoltage(SOLAR_V_PIN);
  windV  = readVoltage(WIND_V_PIN);
  battV  = readVoltage(BATT_V_PIN);
  solarI = readCurrent(SOLAR_I_PIN);
  loadI  = readCurrent(LOAD_I_PIN);

  // Calculate power
  solarPower = solarV * solarI;
  loadPower  = battV * loadI;

  // Battery protection with hysteresis
  if (battV < 11.0) {
    digitalWrite(RELAY_PIN, LOW);
    relayStatus = "OFF";
  } else if (battV > 12.0) {
    digitalWrite(RELAY_PIN, HIGH);
    relayStatus = "ON";
  }

  // Serial monitor
  Serial.println("====================================");
  Serial.print("Solar Voltage  : "); Serial.print(solarV, 1);     Serial.println(" V");
  Serial.print("Solar Current  : "); Serial.print(solarI, 1);     Serial.println(" A");
  Serial.print("Wind Voltage   : "); Serial.print(windV, 1);      Serial.println(" V");
  Serial.print("Battery Voltage: "); Serial.print(battV, 1);      Serial.println(" V");
  Serial.print("Load Current   : "); Serial.print(loadI, 1);      Serial.println(" A");
  Serial.print("Solar Power    : "); Serial.print(solarPower, 1); Serial.println(" W");
  Serial.print("Load Power     : "); Serial.print(loadPower, 1);  Serial.println(" W");
  Serial.print("Relay Status   : "); Serial.println(relayStatus);
  Serial.print("ESP32 IP       : "); Serial.println(WiFi.localIP());
  Serial.println("====================================");

  // LCD display
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("S:"); lcd.print(solarV, 1);
  lcd.print(" B:");  lcd.print(battV, 1);
  lcd.setCursor(0, 1);
  lcd.print("W:"); lcd.print(windV, 1);
  lcd.print(" I:");  lcd.print(loadI, 1);
}

