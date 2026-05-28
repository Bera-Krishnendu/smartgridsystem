#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>   // Install via Library Manager: "ArduinoJson" by Benoit Blanchon

// ======================================================
// SMART DC MICROGRID OPERATION SYSTEM
// ESP32 + LCD + WEB DASHBOARD + SENSOR MONITORING
// ======================================================

// ============================
// WIFI CONFIGURATION
// ============================
const char* ssid     = "SAPTAK2002";
const char* password = "123456789";

// ============================
// IMAGE URL FOR WEB DASHBOARD
// ============================
const String imgSrc = "https://images.unsplash.com/photo-1509391366360-2e959784a276?q=80&w=1200";

// ============================
// WEB SERVER
// ============================
WebServer server(80);

// ============================
// LCD CONFIGURATION
// ============================
LiquidCrystal_I2C lcd(0x27, 16, 2);

// ============================
// PIN DEFINITIONS
// ============================
#define SOLAR_V 34
#define WIND_V 35
#define BATT_V 32
#define SOLAR_I 33
#define LOAD_I 25
#define RELAY 26

// ============================
// GLOBAL VARIABLES
// ============================
float solarV = 0.0;
float windV  = 0.0;
float battV  = 0.0;

float solarI = 0.0;
float loadI  = 0.0;

float solarPower = 0.0;
float loadPower  = 0.0;

String relayStatus = "ON";

// ======================================================
// SENSOR READING FUNCTIONS
// ======================================================

// Voltage Sensor Function
float readVoltage(int pin) {
  int analogVal = analogRead(pin);
  float voltage = (analogVal * 3.3 / 4095.0);
  // Voltage Divider Scaling
  voltage = voltage * 5.0;
  return voltage;
}

// ACS712 Current Sensor Function
float readCurrent(int pin) {
  int value = analogRead(pin);
  float voltage = value * (3.3 / 4095.0);
  // ACS712 20A
  float current = (voltage - 1.65) / 0.066;
  return current;
}

// ======================================================
// CORS & JSON API FOR REACT DASHBOARD
// ======================================================
void addCorsHeaders() {
  server.sendHeader("Access-Control-Allow-Origin",  "*");
  server.sendHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  server.sendHeader("Access-Control-Allow-Headers", "Content-Type");
}

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

void handleOptions() {
  addCorsHeaders();
  server.send(204);
}

// ======================================================
// WEBPAGE GENERATOR
// ======================================================
void handleRoot() {
  addCorsHeaders();
  String html = "";

  html += "<!DOCTYPE html>";
  html += "<html>";
  html += "<head>";

  html += "<meta charset='UTF-8'>";
  html += "<meta name='viewport' content='width=device-width, initial-scale=1.0'>";
  html += "<meta http-equiv='refresh' content='2'>";

  html += "<title>Smart DC Microgrid</title>";

  // ============================
  // CSS STYLING
  // ============================
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
  html += "</style>";

  html += "</head>";
  html += "<body>";
  html += "<div class='container'>";

  // ============================
  // HEADER
  // ============================
  html += "<div class='header'>";
  html += "<h1>⚡ SMART DC MICROGRID ⚡</h1>";
  html += "<p>Renewable Energy Monitoring & Control System</p>";
  html += "</div>";

  // ============================
  // IMAGE
  // ============================
  html += "<img src='" + imgSrc + "' class='banner'>";

  // ============================
  // SENSOR CARDS
  // ============================
  html += "<div class='grid'>";

  html += "<div class='card'>";
  html += "<h2>☀ Solar Voltage</h2>";
  html += "<div class='value'>" + String(solarV,1) + " V</div>";
  html += "</div>";

  html += "<div class='card'>";
  html += "<h2>☀ Solar Current</h2>";
  html += "<div class='value'>" + String(solarI,1) + " A</div>";
  html += "</div>";

  html += "<div class='card'>";
  html += "<h2>🌬 Wind Voltage</h2>";
  html += "<div class='value'>" + String(windV,1) + " V</div>";
  html += "</div>";

  html += "<div class='card'>";
  html += "<h2>🔋 Battery Voltage</h2>";
  html += "<div class='value'>" + String(battV,1) + " V</div>";
  html += "</div>";

  html += "<div class='card'>";
  html += "<h2>⚡ Solar Power</h2>";
  html += "<div class='value'>" + String(solarPower,1) + " W</div>";
  html += "</div>";

  html += "<div class='card'>";
  html += "<h2>🏠 Load Power</h2>";
  html += "<div class='value'>" + String(loadPower,1) + " W</div>";
  html += "</div>";

  html += "</div>";

  // ============================
  // STATUS SECTION
  // ============================
  html += "<div class='status'>";
  html += "<h2>System Status</h2>";

  html += "<div class='status-row'>";
  html += "<span>WiFi Network</span>";
  html += "<span class='on'>CONNECTED</span>";
  html += "</div>";

  html += "<div class='status-row'>";
  html += "<span>Relay Status</span>";
  if(relayStatus == "ON"){
    html += "<span class='on'>ON</span>";
  }
  else{
    html += "<span class='off'>OFF</span>";
  }
  html += "</div>";

  html += "<div class='status-row'>";
  html += "<span>ESP32 IP Address</span>";
  html += "<span>";
  html += WiFi.localIP().toString();
  html += "</span>";
  html += "</div>";

  html += "<div class='status-row'>";
  html += "<span>JSON API Endpoint</span>";
  html += "<span><a href='/api/data' style='color:#22d3ee;text-decoration:none;'>/api/data</a></span>";
  html += "</div>";

  html += "</div>";

  // ============================
  // FOOTER
  // ============================
  html += "<div class='footer'>";
  html += "ESP32 Smart Microgrid Dashboard";
  html += "</div>";

  html += "</div>";
  html += "</body>";
  html += "</html>";

  server.send(200, "text/html", html);
}

// ======================================================
// SETUP FUNCTION
// ======================================================
void setup() {
  Serial.begin(115200);

  // ============================
  // RELAY SETUP
  // ============================
  pinMode(RELAY, OUTPUT);
  digitalWrite(RELAY, HIGH);

  // ============================
  // LCD SETUP
  // ============================
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0,0);
  lcd.print("SMART MICROGRID");
  lcd.setCursor(0,1);
  lcd.print("CONNECTING...");

  // ============================
  // WIFI CONNECTION
  // ============================
  WiFi.begin(ssid, password);
  Serial.print("Connecting WiFi");
  while(WiFi.status() != WL_CONNECTED){
    delay(500);
    Serial.print(".");
  }
  Serial.println();
  Serial.println("WiFi Connected");
  Serial.print("IP Address: ");
  Serial.println(WiFi.localIP());

  // ============================
  // WEB SERVER
  // ============================
  server.on("/",         HTTP_GET,     handleRoot);
  server.on("/api/data", HTTP_GET,     handleApiData);
  server.on("/api/data", HTTP_OPTIONS, handleOptions);
  server.begin();
  Serial.println("Web Server Started");

  // ============================
  // LCD DISPLAY IP
  // ============================
  lcd.clear();
  lcd.setCursor(0,0);
  lcd.print("WIFI CONNECTED");
  lcd.setCursor(0,1);
  lcd.print(WiFi.localIP());
  delay(3000);
}

// ======================================================
// MAIN LOOP
// ======================================================
void loop() {
  // Handle Web Clients
  server.handleClient();

  // ============================
  // SENSOR READINGS
  // ============================
  solarV = readVoltage(SOLAR_V);
  windV = readVoltage(WIND_V);
  battV = readVoltage(BATT_V);
  solarI = readCurrent(SOLAR_I);
  loadI = readCurrent(LOAD_I);

  // ============================
  // POWER CALCULATIONS
  // ============================
  solarPower = solarV * solarI;
  loadPower = battV * loadI;

  // ============================
  // BATTERY PROTECTION
  // ============================
  if(battV < 11.0){
    digitalWrite(RELAY, LOW);
    relayStatus = "OFF";
  }
  else if(battV > 12.0){
    digitalWrite(RELAY, HIGH);
    relayStatus = "ON";
  }

  // ============================
  // SERIAL MONITOR OUTPUT
  // ============================
  Serial.println("====================================");
  Serial.print("Solar Voltage  : ");
  Serial.print(solarV,1);
  Serial.println(" V");
  Serial.print("Solar Current  : ");
  Serial.print(solarI,1);
  Serial.println(" A");
  Serial.print("Wind Voltage   : ");
  Serial.print(windV,1);
  Serial.println(" V");
  Serial.print("Battery Voltage: ");
  Serial.print(battV,1);
  Serial.println(" V");
  Serial.print("Load Current   : ");
  Serial.print(loadI,1);
  Serial.println(" A");
  Serial.print("Solar Power    : ");
  Serial.print(solarPower,1);
  Serial.println(" W");
  Serial.print("Load Power     : ");
  Serial.print(loadPower,1);
  Serial.println(" W");
  Serial.print("Relay Status   : ");
  Serial.println(relayStatus);
  Serial.print("ESP32 IP       : ");
  Serial.println(WiFi.localIP());
  Serial.println("====================================");

  // ============================
  // LCD DISPLAY
  // ============================
  lcd.clear();
  lcd.setCursor(0,0);
  lcd.print("S:");
  lcd.print(solarV,1);
  lcd.print(" B:");
  lcd.print(battV,1);

  lcd.setCursor(0,1);
  lcd.print("W:");
  lcd.print(windV,1);
  lcd.print(" I:");
  lcd.print(loadI,1);

  // ============================
  // LOOP DELAY
  // ============================
  delay(2000);
}
