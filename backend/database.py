from sqlalchemy import (
    create_engine,
    Column,
    Integer,
    String,
    Text,
    ForeignKey,
    DateTime,
    Boolean,
    func,
)
from sqlalchemy.orm import sessionmaker, declarative_base, relationship

# 1. Connect to the SQLite database file
DATABASE_URL = "sqlite:///./ocean_ai.db"

# 2. Create the database engine
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})

# 3. Create a session factory (this handles saving/loading data)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# 4. Base class for our models
Base = declarative_base()

# --- DEFINE YOUR TABLES BELOW ---

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    projects = relationship("Project", back_populates="owner", cascade="all, delete")


class Project(Base):
    __tablename__ = "projects"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    topic = Column(String, nullable=False)
    doc_type = Column(String, nullable=False)  # "word" or "ppt"
    status = Column(String, default="draft")  # draft | generating | ready
    config = Column(Text)  # JSON blob with outline/slides setup
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    owner = relationship("User", back_populates="projects")
    sections = relationship(
        "Section",
        back_populates="project",
        order_by="Section.position",
        cascade="all, delete",
    )


class Section(Base):
    __tablename__ = "sections"
    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    position = Column(Integer, nullable=False)
    heading = Column(String, nullable=False)
    content = Column(Text, default="")
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    project = relationship("Project", back_populates="sections")
    revisions = relationship(
        "SectionRevision", back_populates="section", cascade="all, delete"
    )
    feedback = relationship(
        "SectionFeedback", back_populates="section", cascade="all, delete"
    )


class SectionRevision(Base):
    __tablename__ = "section_revisions"
    id = Column(Integer, primary_key=True, index=True)
    section_id = Column(Integer, ForeignKey("sections.id"), nullable=False)
    prompt = Column(Text)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    section = relationship("Section", back_populates="revisions")


class SectionFeedback(Base):
    __tablename__ = "section_feedback"
    id = Column(Integer, primary_key=True, index=True)
    section_id = Column(Integer, ForeignKey("sections.id"), nullable=False)
    is_positive = Column(Boolean, nullable=True)
    comment = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    section = relationship("Section", back_populates="feedback")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# 5. Create the tables immediately
Base.metadata.create_all(bind=engine)