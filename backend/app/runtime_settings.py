from __future__ import annotations

import os


def dev_mode_enabled() -> bool:
    return os.getenv("DEV_MODE", "false").strip().lower() == "true"
