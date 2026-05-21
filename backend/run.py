"""Dev server launcher with automatic port selection."""

from __future__ import annotations

import socket
import sys

import uvicorn

DEFAULT_PORT = 8000
MAX_ATTEMPTS = 20


def find_free_port(start: int = DEFAULT_PORT, attempts: int = MAX_ATTEMPTS) -> int:
    for port in range(start, start + attempts):
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            try:
                s.bind(("", port))
                return port
            except OSError:
                continue
    print(f"No free port found in range {start}-{start + attempts - 1}", file=sys.stderr)
    sys.exit(1)


def main() -> None:
    preferred = int(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_PORT
    port = find_free_port(preferred)

    if port != preferred:
        print(f"Port {preferred} in use, using {port}")

    uvicorn.run("app.main:app", host="0.0.0.0", port=port, reload=True)


if __name__ == "__main__":
    main()
