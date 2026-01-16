import json
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse

app = FastAPI()

# Serve static files
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/", response_class=HTMLResponse)
async def index():
    with open("static/index.html", encoding="utf-8") as f:
        return f.read()

@app.post("/collect")
async def collect(request: Request):
    data = await request.json()

    ip = (
        request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        or request.headers.get("x-real-ip")
        or (request.client.host if request.client else None)
    )

    source_port = request.client.port if request.client else None
    user_agent = request.headers.get("user-agent")

    log = {
        "type": "request",
        "timestamp": data.get("timestamp"),
        "ip": ip,
        "source_port": source_port,
        "user_agent_header": user_agent,
        "user_agent_js": data.get("navigator", {}).get("userAgent"),
        "url": str(request.url),
        "method": request.method,
        "fingerprint": data
    }

    print("========== NEW FINGERPRINT ==========")
    print(json.dumps(log, indent=2))
    print("====================================")

    return {"status": "ok"}
 
