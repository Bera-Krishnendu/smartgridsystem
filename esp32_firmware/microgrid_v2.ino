#include <Wire.h>
#include <LiquidCrystal_I2C.h>
#include <WiFi.h>
#include <WebServer.h>
#include <ArduinoJson.h>   // Install via Library Manager: "ArduinoJson" by Benoit Blanchon

// ==========================================
// 1. NETWORK & IMAGE CONFIGURATION
// ==========================================
const char* ssid     = "SAPTAK2002";        // Replace with your Wi-Fi SSID
const char* password = "123456789";    // Replace with your Wi-Fi Password

// Paste your direct image link here (ends in .jpg or .png)
// Keep the backslashes (\") intact around the link URL string
const String imgSrc  = "https://imgur.com"; 

// Initialize Web Server on standard HTTP port 80
WebServer server(80);

// Initialize 16x2 LCD (Uses ESP32 default I2C pins: SDA=21, SCL=22)
LiquidCrystal_I2C lcd(0x27, 16, 2);

// ==========================================
// 2. PIN DEFINITIONS & GLOBALS
// ==========================================
#define SOLAR_V 34
#define WIND_V 35
#define BATT_V 32
#define SOLAR_I 33
#define LOAD_I 25
#define RELAY 26

// Global runtime variables accessible by the web server context
float solarV = 0.0, windV = 0.0, battV = 0.0, solarI = 0.0, loadI = 0.0;
String relayStatus = "ON";

// ==========================================
// 3. CORE SENSOR MATH OPERATIONS
// ==========================================
// Reverses external 5:1 physical hardware divider scales
float readVoltage(int pin) {
  float analogVal = analogRead(pin);
  return (analogVal * 3.3 / 4095.0) * 5.0; 
}

// Converts ACS712 voltage steps with 3.3V ADC attenuated midpoints
float readCurrent(int pin) {
  float value = analogRead(pin);
  float voltage = value * (3.3 / 4095.0);
  return (voltage - 1.65) / 0.066; // Sensitivity curve optimized for ACS712-20A
}

// ==========================================
// 4. CORS & JSON API FOR REACT DASHBOARD
// ==========================================
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

// ==========================================
// 5. HTML INTERFACE CODE GENERATOR
// ==========================================
void handleRoot() {
  addCorsHeaders();
  // Mobile-responsive styling block
  String html = "<!DOCTYPE html><html><head>";
  html += "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">";
  html += "<meta http-equiv=\"refresh\" content=\"2\">"; // Auto-refreshes browser page every 2 seconds
  html += "<title>DC Microgrid Control Panel</title>";
  html += "<style>body{font-family:'Segoe UI',Arial,sans-serif;background-color:#121214;color:#e1e1e6;text-align:center;padding:15px;margin:0;}";
  html += ".container{max-width:480px;margin:10px auto;background:#1a1a1e;padding:20px;border-radius:16px;box-shadow:0 6px 20px rgba(0,0,0,0.4);border:1px solid #2d2d34;}";
  html += "h1{color:#4caf50;font-size:22px;letter-spacing:1px;margin-bottom:5px;}";
  html += ".microgrid-pic{width:100%;max-width:440px;height:auto;border-radius:10px;margin:15px 0;box-shadow:0 4px 12px rgba(0,0,0,0.3);border:1px solid #3a3a42;}";
  html += ".metric-box{display:flex;justify-content:space-between;align-items:center;background:#24242b;padding:14px 20px;margin:10px 0;border-radius:10px;font-size:17px;border-left:4px solid #4caf50;}";
  html += ".value{font-weight:bold;color:#00e676;font-family:monospace;font-size:19px;}";
  html += ".relay-on{color:#00e676;font-weight:bold;} .relay-off{color:#ff5252;font-weight:bold;}</style>";
  html += "</head><body><div class=\"container\">";
  
  html += "<h1>⚡ DC MICROGRID DASHBOARD ⚡</h1>";
  
  // Renders the online-hosted component image dynamically
  html += "<img src=\"" + imgSrc + "\" class=\"microgrid-pic\" alt=\"System Status Visual\">";
  
  html += "<hr style='border:0;border-top:1px solid #2d2d34;margin:15px 0;'>";
  
  // Data Grid Presentation Layers
  html += "<div class=\"metric-box\"><span>Solar Voltage:</span><span class=\"value\">" + String(solarV, 1) + " V</span></div>";
  html += "<div class=\"metric-box\"><span>Solar Current:</span><span class=\"value\">" + String(solarI, 1) + " A</span></div>";
  html += "<div class=\"metric-box\"><span>Wind Voltage:</span><span class=\"value\">" + String(windV, 1) + " V</span></div>";
  html += "<div class=\"metric-box\"><span>Battery Voltage:</span><span class=\"value\">" + String(battV, 1) + " V</span></div>";
  html += "<div class=\"metric-box\"><span>Load Current:</span><span class=\"value\">" + String(loadI, 1) + " A</span></div>";
  
  String relayClass = (relayStatus == "ON") ? "relay-on" : "relay-off";
  html += "<div class=\"metric-box\" style='border-left-color:" + String((relayStatus == "ON") ? "#00e676" : "#ff5252") + ";'><span>System Relay Status:</span><span class=\"" + relayClass + "\">" + relayStatus + "</span></div>";
  
  html += "<p style='color:#62626e;font-size:12px;margin-top:15px;'>Live telemetry updating automatically. Consume JSON API at <a href=\"/api/data\" style=\"color:#22d3ee\">/api/data</a></p>";
  html += "</div></body></html>";
  
  server.send(200, "text/html", html);
}

// ==========================================
// 5. HARDWARE SETUP BOOT ROUTINES
// ==========================================
void setup() {
  Serial.begin(115200);
  
  // Initialize Safety Switch Gear State
  pinMode(RELAY, OUTPUT);
  digitalWrite(RELAY, HIGH); // Default path closed to activate load terminal at boot

  // Display initialization sequences on LCD
  lcd.init();
  lcd.backlight();
  lcd.setCursor(0, 0);
  lcd.print("BOOT: MICROGRID");
  lcd.setCursor(0, 1);
  lcd.print("CONNECTING WIFI");

  // Spin up local RF physical transceiver links
  WiFi.begin(ssid, password);
  Serial.print("Connecting to Network");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nWiFi Infrastructure Ready.");

  // Map active server context routes with CORS enabling
  server.on("/",         HTTP_GET,     handleRoot);
  server.on("/api/data", HTTP_GET,     handleApiData);
  server.on("/api/data", HTTP_OPTIONS, handleOptions);
  server.begin();

  // Print system access URL configuration directly to hardware display
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("WIFI SYSTEM OK!");
  lcd.setCursor(0, 1);
  lcd.print(WiFi.localIP()); // Navigate to this address on any local device browser
  delay(4000);
}

// ==========================================
// 6. CONTINUOUS MONITORING LOOP
// ==========================================
void loop() {
  // Listen for and serve incoming client dashboard browser payload requests
  server.handleClient();

  // Collect active voltage samples
  solarV = readVoltage(SOLAR_V);
  windV  = readVoltage(WIND_V);
  battV  = readVoltage(BATT_V);
  
  // Collect active inline series current trends
  solarI = readCurrent(SOLAR_I); 
  loadI  = readCurrent(LOAD_I);

  // Update localized physical instrumentation matrix
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("S:"); lcd.print(solarV, 1); lcd.print("V W:"); lcd.print(windV, 1); lcd.print("V");
  lcd.setCursor(0, 1);
  lcd.print("B:"); lcd.print(battV, 1); lcd.print("V I:"); lcd.print(loadI, 1); lcd.print("A");

  // Hysteresis calculation thresholds protecting lithium/lead core structures
  if (battV < 11.0) {
    digitalWrite(RELAY, LOW);   // Drop low side switches immediately
    relayStatus = "OFF (LOW BATTERY)";
  } 
  else if (battV > 12.0) {       
    digitalWrite(RELAY, HIGH);  // Restore output distribution trunks safely
    relayStatus = "ON";
  }

  delay(200); // Quick turnaround interval ensuring sub-second response times for network users
}
