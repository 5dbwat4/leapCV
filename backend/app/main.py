import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import BASE_DIR, CV_DIR, DATA_DIR, THUMB_DIR
from .database import Base, engine, ensure_schema_upgrades
from .routers import auth_router, history_router, optimize_router, resume_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI):
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    CV_DIR.mkdir(parents=True, exist_ok=True)
    THUMB_DIR.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)
    ensure_schema_upgrades()
    yield


app = FastAPI(title="LeapCV API（简跃）", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router.router, prefix="/api")
app.include_router(resume_router.router, prefix="/api")
app.include_router(optimize_router.router, prefix="/api")
app.include_router(history_router.router, prefix="/api")


@app.get("/api/health")
def health():
    return {"status": "ok"}


# 生产模式：若前端已构建（frontend/dist），由后端直接托管
# 使用 SPA 回退：/terms、/history 等前端路由刷新时返回 index.html，静态文件按原路径命中
_frontend_dist = BASE_DIR.parent / "frontend" / "dist"
if _frontend_dist.exists():
    from pathlib import Path

    from fastapi.responses import FileResponse

    _assets_dir = _frontend_dist / "assets"
    if _assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(_assets_dir)), name="assets")

    _dist_root = _frontend_dist.resolve()

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa_fallback(full_path: str):
        candidate = Path(_dist_root / full_path).resolve()
        if full_path and candidate.is_file() and _dist_root in candidate.parents:
            return FileResponse(candidate)
        return FileResponse(_dist_root / "index.html")
