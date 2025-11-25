from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserBase(BaseModel):
    email: EmailStr


class UserCreate(UserBase):
    password: str = Field(min_length=8)


class UserOut(UserBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True


class SectionConfig(BaseModel):
    heading: str


class ProjectCreate(BaseModel):
    title: str
    topic: str
    doc_type: Literal["word", "ppt"]
    sections: list[SectionConfig]
    config: Optional[dict] = None  # for storing optional metadata


class ProjectOut(BaseModel):
    id: int
    title: str
    topic: str
    doc_type: str
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SectionRevisionOut(BaseModel):
    id: int
    prompt: Optional[str]
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class SectionFeedbackOut(BaseModel):
    id: int
    is_positive: Optional[bool]
    comment: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class SectionOut(BaseModel):
    id: int
    heading: str
    content: str
    position: int
    updated_at: datetime
    revisions: list[SectionRevisionOut] = Field(default_factory=list)
    feedback: list[SectionFeedbackOut] = Field(default_factory=list)

    class Config:
        from_attributes = True


class ProjectDetail(ProjectOut):
    sections: list[SectionOut]


class GenerateRequest(BaseModel):
    regenerate: bool = False


class RefineRequest(BaseModel):
    prompt: str


class FeedbackRequest(BaseModel):
    is_positive: Optional[bool] = None
    comment: Optional[str] = None

