"""Helper único para transformar caminhos de upload em URLs absolutas.

Uploads são gravados como caminho relativo (/uploads/...). Para renderizar em
<img crossorigin> / canvas (cards compartilháveis) e em qualquer cliente que
não compartilhe origem com a API, a URL precisa ser absoluta.
"""
from typing import Optional


def absolute_media_url(path: Optional[str]) -> Optional[str]:
    if not path:
        return path
    if path.startswith("http://") or path.startswith("https://"):
        return path
    if path.startswith("/"):
        from database import get_settings
        return get_settings().PUBLIC_API_URL.rstrip("/") + path
    return path
