from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
import json

app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/", response_class=HTMLResponse)
async def index():
    with open("static/index.html", encoding="utf-8") as f:
        return f.read()


@app.post("/collect")
async def collect(request: Request):
    data = await request.json()

    # 🔥 LẤY IP THẬT (Vercel / Proxy / CDN)
    ip = (
        request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        or request.client.host
    )

    user_agent = request.headers.get("user-agent")

    log = {
        "type": "request",
        "ip": ip,
        "user_agent": user_agent,
        "fingerprint": data
    }

    print("========== NEW FINGERPRINT ==========")
    print(json.dumps(log, indent=2, ensure_ascii=False))
    print("====================================")

    return {"status": "ok"}
