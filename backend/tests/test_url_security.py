"""Tests for URL security / SSRF prevention helpers."""

import pytest

from app.url_security import UnsafeUrlError, validate_external_url


class TestValidateExternalUrl:
    def test_allows_public_https_url(self):
        validate_external_url("https://openrouter.ai/api/v1/chat/completions")

    def test_allows_public_http_url(self):
        validate_external_url("http://example.com/api")

    def test_rejects_localhost(self):
        with pytest.raises(UnsafeUrlError, match="blocked host"):
            validate_external_url("http://localhost:8080/api")

    def test_rejects_127_0_0_1(self):
        with pytest.raises(UnsafeUrlError, match="blocked host"):
            validate_external_url("https://127.0.0.1/api")

    def test_rejects_private_ipv4_10_range(self):
        with pytest.raises(UnsafeUrlError, match="private/reserved"):
            validate_external_url("https://10.0.0.1/api")

    def test_rejects_private_ipv4_192_168_range(self):
        with pytest.raises(UnsafeUrlError, match="private/reserved"):
            validate_external_url("https://192.168.1.1/api")

    def test_rejects_private_ipv4_172_16_range(self):
        with pytest.raises(UnsafeUrlError, match="private/reserved"):
            validate_external_url("https://172.16.0.1/api")

    def test_rejects_ipv6_loopback(self):
        with pytest.raises(UnsafeUrlError, match="blocked host"):
            validate_external_url("https://[::1]/api")

    def test_rejects_file_scheme(self):
        with pytest.raises(UnsafeUrlError, match="scheme"):
            validate_external_url("file:///etc/passwd")

    def test_rejects_ftp_scheme(self):
        with pytest.raises(UnsafeUrlError, match="scheme"):
            validate_external_url("ftp://example.com/file")

    def test_rejects_no_scheme(self):
        with pytest.raises(UnsafeUrlError, match="scheme"):
            validate_external_url("example.com/api")

    def test_rejects_empty_url(self):
        with pytest.raises(UnsafeUrlError, match="non-empty"):
            validate_external_url("")

    def test_rejects_local_domain(self):
        with pytest.raises(UnsafeUrlError, match="local/internal"):
            validate_external_url("https://myhost.local/api")

    def test_rejects_dns_rebinding_local(self):
        with pytest.raises(UnsafeUrlError, match="local/internal"):
            validate_external_url("https://internal.local/api")
