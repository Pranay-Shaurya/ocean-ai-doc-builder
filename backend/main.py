import json

from fastapi import Depends, FastAPI, HTTPException, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from auth import create_access_token, get_current_user, hash_password, verify_password
from database import (
    Project,
    Section,
    SectionFeedback,
    SectionRevision,
    User,
    get_db,
)
from doc_export import export_project
from llm import generate_section_content, suggest_outline
from schemas import (
    FeedbackRequest,
    GenerateRequest,
    ProjectCreate,
    ProjectDetail,
    ProjectOut,
    RefineRequest,
    SectionOut,
    Token,
    UserCreate,
    UserOut,
)

app = FastAPI(title="Ocean AI Document Builder")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# -----------------------------
# Auth Endpoints
# -----------------------------
@app.post("/auth/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(user_in: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == user_in.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(email=user_in.email, password_hash=hash_password(user_in.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@app.post("/auth/login", response_model=Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect email or password")

    token = create_access_token({"sub": str(user.id)})
    return Token(access_token=token)


@app.get("/auth/me", response_model=UserOut)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


# -----------------------------
# Helper utilities
# -----------------------------
def _project_for_user(
    project_id: int, current_user: User, db: Session, include_sections: bool = True
) -> Project:
    query = db.query(Project).filter(
        Project.id == project_id, Project.owner_id == current_user.id
    )
    project = query.first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if include_sections:
        project.sections  # trigger lazy load
    return project


def _serialize_project(project: Project) -> ProjectDetail:
    return ProjectDetail(
        **{
            "id": project.id,
            "title": project.title,
            "topic": project.topic,
            "doc_type": project.doc_type,
            "status": project.status,
            "created_at": project.created_at,
            "updated_at": project.updated_at,
            "sections": [
                SectionOut(
                    id=section.id,
                    heading=section.heading,
                    content=section.content or "",
                    position=section.position,
                    updated_at=section.updated_at,
                    revisions=section.revisions,
                    feedback=section.feedback,
                )
                for section in project.sections
            ],
        }
    )


# -----------------------------
# Project CRUD
# -----------------------------
@app.get("/projects", response_model=list[ProjectOut])
def list_projects(
    current_user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    projects = (
        db.query(Project)
        .filter(Project.owner_id == current_user.id)
        .order_by(Project.updated_at.desc())
        .all()
    )
    return projects


@app.post(
    "/projects",
    response_model=ProjectDetail,
    status_code=status.HTTP_201_CREATED,
)
def create_project(
    payload: ProjectCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not payload.sections:
        raise HTTPException(status_code=400, detail="At least one section is required.")

    project = Project(
        title=payload.title,
        topic=payload.topic,
        doc_type=payload.doc_type,
        owner_id=current_user.id,
        config=json.dumps(payload.config or {}),
        status="draft",
    )
    db.add(project)
    db.flush()  # obtain project.id before adding sections

    for idx, section in enumerate(payload.sections):
        db.add(
            Section(
                project_id=project.id,
                position=idx,
                heading=section.heading,
            )
        )

    db.commit()
    db.refresh(project)
    return _serialize_project(project)


@app.get("/projects/{project_id}", response_model=ProjectDetail)
def get_project(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _project_for_user(project_id, current_user, db)
    return _serialize_project(project)


@app.post("/projects/{project_id}/generate", response_model=ProjectDetail)
def generate_project_content(
    project_id: int,
    payload: GenerateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _project_for_user(project_id, current_user, db)
    project.status = "generating"
    db.commit()

    for section in project.sections:
        if section.content and not payload.regenerate:
            continue
        content = generate_section_content(
            topic=project.topic,
            doc_type=project.doc_type,
            heading=section.heading,
        )
        section.content = content
        db.add(
            SectionRevision(
                section_id=section.id,
                prompt="Initial generation",
                content=content,
            )
        )

    project.status = "ready"
    db.commit()
    db.refresh(project)
    return _serialize_project(project)


@app.post("/sections/{section_id}/refine", response_model=SectionOut)
def refine_section(
    section_id: int,
    payload: RefineRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    section = (
        db.query(Section)
        .join(Project)
        .filter(Section.id == section_id, Project.owner_id == current_user.id)
        .first()
    )
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    content = generate_section_content(
        topic=section.project.topic,
        doc_type=section.project.doc_type,
        heading=section.heading,
        current_content=section.content,
        refine_prompt=payload.prompt,
    )
    section.content = content
    revision = SectionRevision(
        section_id=section.id,
        prompt=payload.prompt,
        content=content,
    )
    db.add(revision)
    db.commit()
    db.refresh(section)
    return SectionOut(
        id=section.id,
        heading=section.heading,
        content=section.content or "",
        position=section.position,
        updated_at=section.updated_at,
        revisions=section.revisions,
        feedback=section.feedback,
    )


@app.post("/sections/{section_id}/feedback", response_model=SectionOut)
def leave_feedback(
    section_id: int,
    payload: FeedbackRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    section = (
        db.query(Section)
        .join(Project)
        .filter(Section.id == section_id, Project.owner_id == current_user.id)
        .first()
    )
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    feedback = SectionFeedback(
        section_id=section.id,
        is_positive=payload.is_positive,
        comment=payload.comment,
    )
    db.add(feedback)
    db.commit()
    db.refresh(section)
    return SectionOut(
        id=section.id,
        heading=section.heading,
        content=section.content or "",
        position=section.position,
        updated_at=section.updated_at,
        revisions=section.revisions,
        feedback=section.feedback,
    )


@app.get("/projects/{project_id}/export")
def export(
    project_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    project = _project_for_user(project_id, current_user, db)
    data, mime = export_project(project, project.doc_type)

    filename = f"{project.title.replace(' ', '_')}.{ 'docx' if project.doc_type == 'word' else 'pptx'}"
    return StreamingResponse(
        iter([data]),
        media_type=mime,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@app.get("/ai/suggest-outline")
def outline(
    topic: str,
    doc_type: str,
    current_user: User = Depends(get_current_user),
):
    if doc_type not in {"word", "ppt"}:
        raise HTTPException(status_code=400, detail="doc_type must be word or ppt")
    return {"suggestions": suggest_outline(topic, doc_type)}