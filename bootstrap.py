#!/usr/bin/env python3
"""Inicializa la app Ferreteria Multi-Tienda desde cero.

Solo requiere Python instalado. Detecta o instala uv, crea el entorno,
aplica migraciones y carga los datos de seed.

Uso:
    python bootstrap.py              # dependencias + migraciones + seed
    python bootstrap.py --fresh      # ademas borra la SQLite local (arranque de cero)
    python bootstrap.py --no-seed    # ademas salta la carga de productos/ventas
    python bootstrap.py --test       # ademas ejecuta la suite de pruebas
    python bootstrap.py --run        # ademas arranca la API (--host / --port)
    python bootstrap.py --web        # ademas instala las dependencias del frontend
"""

from __future__ import annotations

import argparse
import os
import shutil
import site
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent
DB_DIR = REPO_ROOT / "backend" / "data"
MIN_PY = (3, 13)


def step(message: str) -> None:
    print(f"\n==> {message}", flush=True)


def info(message: str) -> None:
    print(f"    {message}", flush=True)


def run(cmd: list[str]) -> None:
    info("> " + " ".join(cmd))
    subprocess.run(cmd, cwd=str(REPO_ROOT), check=True)


def user_scripts_dir() -> Path | None:
    """Directorio de binarios de 'pip install --user' para el Python actual."""
    if sys.platform == "win32":
        appdata = os.environ.get("APPDATA")
        if not appdata:
            return None
        v = f"Python{sys.version_info.major}{sys.version_info.minor}"
        return Path(appdata) / "Python" / v / "Scripts"
    return Path.home() / ".local" / "bin"


def uv_candidates() -> list[list[str]]:
    candidates: list[list[str]] = []
    on_path = shutil.which("uv")
    if on_path:
        candidates.append([on_path])
    candidates.append([sys.executable, "-m", "uv"])
    user_base = Path(site.USER_BASE)
    v = f"Python{sys.version_info.major}{sys.version_info.minor}"
    for directory in (
        user_base / v / "Scripts",  # Windows: pip install --user
        user_base / "bin",  # Unix: pip install --user
        Path.home() / ".local" / "bin",
        Path.home() / ".cargo" / "bin",
    ):
        exe = directory / ("uv.exe" if sys.platform == "win32" else "uv")
        if exe.is_file():
            candidates.append([str(exe)])
    return candidates


def find_uv() -> list[str] | None:
    seen: set[str] = set()
    for cmd in uv_candidates():
        key = " ".join(cmd)
        if key in seen:
            continue
        seen.add(key)
        try:
            result = subprocess.run(cmd + ["--version"], capture_output=True, timeout=30)
        except (OSError, subprocess.TimeoutExpired):
            continue
        if result.returncode == 0:
            version = result.stdout.decode(errors="replace").strip()
            info(f"uv encontrado: {key} ({version})")
            return cmd
    return None


def install_uv() -> list[str] | None:
    step("uv no encontrado - instalando con pip")
    try:
        pip = subprocess.run([sys.executable, "-m", "pip", "--version"], capture_output=True)
    except OSError:
        pip = None
    if pip is None or pip.returncode != 0:
        info("pip no disponible; intentando ensurepip")
        subprocess.run([sys.executable, "-m", "ensurepip", "--user"], check=True)
    subprocess.run(
        [sys.executable, "-m", "pip", "install", "--user", "--upgrade", "uv"], check=True
    )
    return find_uv()


def add_user_scripts_to_path() -> None:
    """Agrega el directorio de scripts del usuario al PATH del usuario."""
    directory = user_scripts_dir()
    if directory is None or not directory.is_dir():
        return
    if str(directory).lower() in os.environ.get("PATH", "").lower():
        return
    if sys.platform == "win32":
        _add_to_user_path_windows(str(directory))
    else:
        info(f"Agrega manualmente al PATH: {directory}")


def _add_to_user_path_windows(directory: str) -> None:
    """Edita HKCU\\Environment\\Path via winreg y notifica a Explorer."""
    import ctypes
    import winreg

    path_key = winreg.OpenKey(
        winreg.HKEY_CURRENT_USER, "Environment", 0, winreg.KEY_READ | winreg.KEY_SET_VALUE
    )
    try:
        try:
            current, _ = winreg.QueryValueEx(path_key, "Path")
        except FileNotFoundError:
            current = ""
        if directory.lower() in current.lower():
            return
        new_path = (current.rstrip(";") + ";" + directory) if current else directory
        winreg.SetValueEx(path_key, "Path", 0, winreg.REG_EXPAND_SZ, new_path)
    finally:
        winreg.CloseKey(path_key)

    os.environ["PATH"] = os.environ.get("PATH", "") + os.pathsep + directory
    ctypes.windll.user32.SendMessageTimeoutW(
        0xFFFF,
        0x001A,
        0,
        "Environment",
        0,
        1000,
        None,  # HWND_BROADCAST, WM_SETTINGCHANGE
    )
    info(f"Agregado al PATH del usuario: {directory}")
    info("Abre una terminal nueva para poder usar 'uv' directamente.")


def install_frontend() -> None:
    """Instala las dependencias del frontend (requiere Node.js >= 18)."""
    step("Instalando dependencias del frontend (npm install)")
    npm = shutil.which("npm")
    if npm is None:
        info("Node.js/npm no encontrado: instala Node 18+ y vuelve a ejecutar --web")
        info("El backend ya quedo listo; el frontend se puede instalar luego con:")
        info("    cd frontend && npm install")
        return
    info(f"npm encontrado: {npm}")
    subprocess.run([npm, "install"], cwd=str(REPO_ROOT / "frontend"), check=True)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--fresh", action="store_true", help="borra la SQLite local antes de migrar"
    )
    parser.add_argument(
        "--no-seed",
        action="store_true",
        help="aplica migraciones sin cargar products.csv/sales.csv",
    )
    parser.add_argument("--test", action="store_true", help="ejecuta pytest despues de inicializar")
    parser.add_argument("--run", action="store_true", help="arranca la API al terminar")
    parser.add_argument(
        "--web", action="store_true", help="instala las dependencias del frontend (npm install)"
    )
    parser.add_argument("--host", default="127.0.0.1", help="host para --run (default 127.0.0.1)")
    parser.add_argument("--port", default="8000", help="puerto para --run (default 8000)")
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    step("Verificando Python")
    info(f"Python {sys.version.split()[0]} en {sys.executable}")
    if sys.version_info[:2] < MIN_PY:
        info(
            f"Se recomienda Python >= {'.'.join(map(str, MIN_PY))}; "
            "uv puede descargar uno adecuado automaticamente."
        )

    uv = find_uv()
    if uv is None:
        uv = install_uv()
    if uv is None:
        print("ERROR: no se pudo instalar uv. Revisa la salida anterior.", file=sys.stderr)
        return 1

    # Si 'uv' no esta en el PATH, agregar el directorio de scripts del usuario
    # para que terminales futuras puedan usarlo directamente.
    if shutil.which("uv") is None:
        add_user_scripts_to_path()

    step("Instalando dependencias (uv sync)")
    run(uv + ["sync"])

    if args.fresh:
        step("Borrando base de datos local (--fresh)")
        removed = False
        for pattern in ("*.db", "*.db-shm", "*.db-wal"):
            for db_file in DB_DIR.glob(pattern):
                db_file.unlink()
                info(f"eliminado: {db_file.relative_to(REPO_ROOT)}")
                removed = True
        if not removed:
            info("no habia base de datos local")

    step("Aplicando migraciones (aerich upgrade)")
    run(uv + ["run", "aerich", "upgrade"])

    if args.no_seed:
        info("Seed omitido (--no-seed): la base queda vacia; usa import_data o seed luego")
    else:
        step("Cargando datos de seed (products.csv, sales.csv)")
        run(uv + ["run", "python", "-m", "backend.app.scripts.seed"])

    if args.test:
        step("Ejecutando pruebas (pytest)")
        run(uv + ["run", "pytest"])

    if args.web:
        install_frontend()

    if args.run:
        step(f"Arrancando la API en http://{args.host}:{args.port} (Ctrl+C para detener)")
        run(
            uv
            + ["run", "uvicorn", "backend.app.main:app", "--host", args.host, "--port", args.port]
        )

    print("\nInicializacion completa.")
    print("  API:       uv run uvicorn backend.app.main:app --reload  (docs en /docs)")
    print("  Frontend:  cd frontend && npm run dev                  (http://localhost:5173)")
    print("  Pruebas:   uv run pytest")
    if shutil.which("uv") is None and sys.platform == "win32":
        print("\nNota: abre una terminal nueva para que el comando 'uv' quede disponible.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
