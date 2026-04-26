"""URL security helpers to prevent SSRF via user-controlled URLs."""

import ipaddress
import re
from urllib.parse import urlparse


# Hosts that must never be used as an LLM / external API endpoint
_BLOCKED_HOSTS = {
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "::1",
    "::",
}

# Private/reserved CIDR ranges that could target internal infrastructure
_BLOCKED_NETWORKS = [
    ipaddress.ip_network("10.0.0.0/8"),
    ipaddress.ip_network("172.16.0.0/12"),
    ipaddress.ip_network("192.168.0.0/16"),
    ipaddress.ip_network("127.0.0.0/8"),
    ipaddress.ip_network("169.254.0.0/16"),
    ipaddress.ip_network("0.0.0.0/8"),
    ipaddress.ip_network("fc00::/7"),
    ipaddress.ip_network("fe80::/10"),
    ipaddress.ip_network("::1/128"),
]

_ALLOWED_SCHEMES = {"https", "http"}


class UnsafeUrlError(ValueError):
    """Raised when a URL fails SSRF safety checks."""

    pass


def validate_external_url(url: str) -> None:
    """Validate that *url* is safe to use as an external API endpoint.

    Raises:
        UnsafeUrlError: If the URL uses a disallowed scheme, targets a
            blocked host, or resolves to a private/reserved IP address.
    """
    if not url or not isinstance(url, str):
        raise UnsafeUrlError("URL must be a non-empty string")

    parsed = urlparse(url)

    scheme = parsed.scheme.lower()
    if scheme not in _ALLOWED_SCHEMES:
        raise UnsafeUrlError(f"URL scheme must be http or https, got: {scheme}")

    hostname = parsed.hostname
    if not hostname:
        raise UnsafeUrlError("URL must contain a valid hostname")

    hostname_lower = hostname.lower()
    if hostname_lower in _BLOCKED_HOSTS:
        raise UnsafeUrlError(f"URL targets a blocked host: {hostname}")

    # Reject raw IPv4 / IPv6 literals that fall in private/reserved space
    try:
        addr = ipaddress.ip_address(hostname)
    except ValueError:
        # Not an IP literal — that's fine, we'll allow DNS names
        pass
    else:
        for network in _BLOCKED_NETWORKS:
            if addr in network:
                raise UnsafeUrlError(f"URL resolves to a private/reserved IP: {hostname}")

    # Reject common DNS rebinding / internal host patterns
    if re.search(r"\blocal\b", hostname_lower) or hostname_lower.endswith(".local"):
        raise UnsafeUrlError(f"URL targets a local/internal domain: {hostname}")
