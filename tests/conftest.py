"""Shared pytest fixtures + lightweight stubs for the Augurian AI Operations test suite.

Heavy third-party deps (click, structlog, dotenv, anthropic, google-api-*) are
installed in dev/prod but may NOT be present in CI. The functions under test in
``scripts/fireflies_walkthrough.py`` and ``scripts/ask.py`` are pure-Python regex,
JSON, and string logic; once those modules import successfully, the unit tests
don't need the real implementations.

We therefore stub the import-time deps in ``sys.modules`` BEFORE the modules
under test get imported. Module-level fixtures lazily import the targets after
the stubs are in place.
"""

from __future__ import annotations

import importlib.util
import sys
import types
from pathlib import Path
from typing import Any

import pytest


# --------------------------------------------------------------------------------------
# sys.modules stubs — installed at conftest import time so the lazy fixtures can
# import the production scripts without pulling click / structlog / dotenv.
# --------------------------------------------------------------------------------------


def _install_stubs() -> None:
    if "click" not in sys.modules:
        click_stub = types.ModuleType("click")

        class ClickException(Exception):
            def __init__(self, message: str = "") -> None:
                super().__init__(message)
                self.message = message

        def _passthrough_decorator(*dargs: Any, **dkwargs: Any) -> Any:
            """Decorator factory that ignores its args and returns the function unchanged."""

            # Two call shapes:
            #   @click.command            -> first arg is the function
            #   @click.command(...)       -> returns a decorator
            if len(dargs) == 1 and callable(dargs[0]) and not dkwargs:
                return dargs[0]

            def decorator(fn: Any) -> Any:
                return fn

            return decorator

        class _Group:
            def command(self, *a: Any, **k: Any) -> Any:
                return _passthrough_decorator

        def group(*a: Any, **k: Any) -> Any:
            # `@click.group()` shape — returns a decorator that returns a Group-ish object.
            def decorator(fn: Any) -> _Group:
                return _Group()

            return decorator

        class _Path:
            def __init__(self, *a: Any, **k: Any) -> None:
                pass

        click_stub.ClickException = ClickException
        click_stub.command = _passthrough_decorator
        click_stub.option = _passthrough_decorator
        click_stub.argument = _passthrough_decorator
        click_stub.group = group
        click_stub.Path = _Path
        click_stub.echo = lambda *a, **k: None
        click_stub.secho = lambda *a, **k: None
        sys.modules["click"] = click_stub

    if "structlog" not in sys.modules:
        structlog_stub = types.ModuleType("structlog")

        class _Logger:
            def info(self, *a: Any, **k: Any) -> None:
                return None

            def warning(self, *a: Any, **k: Any) -> None:
                return None

            def error(self, *a: Any, **k: Any) -> None:
                return None

            def debug(self, *a: Any, **k: Any) -> None:
                return None

        structlog_stub.get_logger = lambda *a, **k: _Logger()
        sys.modules["structlog"] = structlog_stub

    if "dotenv" not in sys.modules:
        dotenv_stub = types.ModuleType("dotenv")
        dotenv_stub.load_dotenv = lambda *a, **k: None
        sys.modules["dotenv"] = dotenv_stub


_install_stubs()


# --------------------------------------------------------------------------------------
# Module loaders — load the script modules from ``scripts/`` by file path. We use
# importlib instead of ``import scripts.fireflies_walkthrough`` because ``scripts/``
# isn't a package (no __init__.py).
# --------------------------------------------------------------------------------------


_REPO_ROOT = Path(__file__).resolve().parent.parent


def _load_module_from_path(name: str, path: Path) -> Any:
    if name in sys.modules:
        return sys.modules[name]
    spec = importlib.util.spec_from_file_location(name, str(path))
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not build import spec for {path}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


# --------------------------------------------------------------------------------------
# Fixtures
# --------------------------------------------------------------------------------------


@pytest.fixture(scope="session")
def repo_root() -> Path:
    """Absolute path to the repo root."""

    return _REPO_ROOT


@pytest.fixture(scope="session")
def sandbox_client() -> str:
    """Client slug used by the demo data."""

    return "sandbox"


@pytest.fixture(scope="session")
def walkthrough_module():
    """Lazily import scripts/fireflies_walkthrough.py with stubs in place."""

    return _load_module_from_path(
        "fireflies_walkthrough_under_test",
        _REPO_ROOT / "scripts" / "fireflies_walkthrough.py",
    )


@pytest.fixture(scope="session")
def ask_module():
    """Lazily import scripts/ask.py with stubs in place."""

    return _load_module_from_path(
        "ask_under_test",
        _REPO_ROOT / "scripts" / "ask.py",
    )
