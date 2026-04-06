from typing import Annotated

from fastapi import Depends
from sqlalchemy.orm import Session

from .database import get_db

DbSession = Annotated[Session, Depends(get_db)]

_DEFAULT_ERROR_DESCRIPTIONS = {
    404: "The requested resource was not found.",
    405: "The requested operation is not allowed for this endpoint.",
    409: "The request conflicts with the current resource state.",
    422: "The request could not be completed because validation or workflow rules failed.",
    423: "The resource is locked or closed for changes.",
}


def error_responses(*status_codes: int) -> dict[int, dict[str, str]]:
    return {
        status_code: {
            "description": _DEFAULT_ERROR_DESCRIPTIONS.get(status_code, "Request failed."),
        }
        for status_code in status_codes
    }
