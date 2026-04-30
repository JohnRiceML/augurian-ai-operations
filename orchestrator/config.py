"""Configuration loading for the orchestrator.

Reads pipelines/clients.yaml and environment variables. Single source of
truth for "which client → which Drive folder → which GA4 property → ...".
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent
CLIENTS_YAML = REPO_ROOT / "pipelines" / "clients.yaml"


@dataclass(frozen=True)
class ClientConfig:
    """Per-client configuration. One entry per Augurian client."""

    slug: str                # 'coborns', 'theisens'
    name: str                # "Coborn's", "Theisen's"
    drive_folder_id: str     # Drive folder ID for /Augurian Clients/[Client]/
    ga4_property_id: str
    gsc_site_url: str
    ads_customer_id: str
    optmyzr_account_id: str
    timezone: str = "America/Chicago"
    slack_channel: str | None = None  # e.g. "#client-coborns"
    redaction_list: list[str] | None = None  # extra names/terms to redact

    @classmethod
    def from_dict(cls, slug: str, data: dict[str, Any]) -> ClientConfig:
        return cls(
            slug=slug,
            name=data["name"],
            drive_folder_id=data["drive_folder_id"],
            ga4_property_id=str(data["ga4_property_id"]),
            gsc_site_url=data["gsc_site_url"],
            ads_customer_id=str(data["ads_customer_id"]),
            optmyzr_account_id=str(data.get("optmyzr_account_id", "")),
            timezone=data.get("timezone", "America/Chicago"),
            slack_channel=data.get("slack_channel"),
            redaction_list=data.get("redaction_list", []),
        )


@dataclass(frozen=True)
class RuntimeConfig:
    """Process-level config — paths, secrets, runtime flags."""

    anthropic_api_key: str
    google_credentials_path: Path
    slack_bot_token: str | None
    slack_audit_channel: str
    openai_api_key: str | None
    dry_run: bool
    log_level: str

    @classmethod
    def from_env(cls) -> RuntimeConfig:
        load_dotenv(REPO_ROOT / ".env", override=False)
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            raise RuntimeError("ANTHROPIC_API_KEY not set. Copy .env.example to .env and fill in.")
        creds_path = Path(
            os.environ.get("GOOGLE_APPLICATION_CREDENTIALS", "./credentials/service-account.json")
        )
        return cls(
            anthropic_api_key=api_key,
            google_credentials_path=creds_path,
            slack_bot_token=os.environ.get("SLACK_BOT_TOKEN"),
            slack_audit_channel=os.environ.get("SLACK_AUDIT_CHANNEL", "#agent-activity"),
            openai_api_key=os.environ.get("OPENAI_API_KEY"),
            dry_run=os.environ.get("DRY_RUN", "false").lower() == "true",
            log_level=os.environ.get("LOG_LEVEL", "INFO"),
        )


def load_clients(path: Path = CLIENTS_YAML) -> dict[str, ClientConfig]:
    """Load every client from clients.yaml. Keyed by slug."""
    if not path.exists():
        raise FileNotFoundError(
            f"{path} not found. Copy pipelines/clients.example.yaml to pipelines/clients.yaml "
            "and fill in the per-client IDs."
        )
    with path.open() as f:
        raw = yaml.safe_load(f) or {}
    clients_raw = raw.get("clients", {})
    return {slug: ClientConfig.from_dict(slug, data) for slug, data in clients_raw.items()}


def get_client(slug: str) -> ClientConfig:
    """Look up a single client by slug. Raises if missing."""
    clients = load_clients()
    if slug not in clients:
        raise KeyError(f"Unknown client {slug!r}. Known clients: {sorted(clients)}")
    return clients[slug]
