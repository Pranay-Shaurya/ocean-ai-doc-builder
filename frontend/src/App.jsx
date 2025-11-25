import { useEffect, useState } from "react";
import "./App.css";
import {
  createProject,
  exportProject,
  fetchMe,
  fetchProject,
  fetchProjects,
  generateProject,
  leaveFeedback,
  login,
  refineSection,
  register,
  suggestOutline,
} from "./api";

const emptySection = { heading: "" };

function App() {
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ email: "", password: "" });
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [projectForm, setProjectForm] = useState({
    title: "",
    topic: "",
    doc_type: "word",
    sections: [{ ...emptySection }],
  });
  const [sectionPrompts, setSectionPrompts] = useState({});
  const [sectionComments, setSectionComments] = useState({});

  const isDocx = selectedProject?.doc_type === "word";

  const resetProjectForm = () =>
    setProjectForm({
      title: "",
      topic: "",
      doc_type: "word",
      sections: [{ ...emptySection }],
    });

  const bootstrapUser = async () => {
    try {
      const [{ data: me }, { data: projectList }] = await Promise.all([
        fetchMe(),
        fetchProjects(),
      ]);
      setUser(me);
      setProjects(projectList);
    } catch (error) {
      console.error(error);
      localStorage.removeItem("ocean_token");
      setUser(null);
    }
  };

  useEffect(() => {
    if (localStorage.getItem("ocean_token")) {
      bootstrapUser();
    }
  }, []);

  const handleAuthSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setStatus("");
    try {
      if (authMode === "register") {
        await register(authForm);
        setAuthMode("login");
        setStatus("Account created. Please log in.");
      } else {
        const {
          data: { access_token },
        } = await login(authForm);
        localStorage.setItem("ocean_token", access_token);
        await bootstrapUser();
      }
    } catch (error) {
      setStatus(error.response?.data?.detail || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("ocean_token");
    setUser(null);
    setProjects([]);
    setSelectedProject(null);
  };

  const handleAddSection = () => {
    setProjectForm((prev) => ({
      ...prev,
      sections: [...prev.sections, { ...emptySection }],
    }));
  };

  const handleSectionHeadingChange = (index, value) => {
    setProjectForm((prev) => {
      const sections = [...prev.sections];
      sections[index] = { heading: value };
      return { ...prev, sections };
    });
  };

  const handleProjectCreate = async (event) => {
    event.preventDefault();
    if (!projectForm.title || !projectForm.topic) {
      return setStatus("Title and topic are required.");
    }
    const preparedSections = projectForm.sections
      .map((section) => ({ heading: section.heading.trim() }))
      .filter((section) => section.heading.length > 0);
    if (!preparedSections.length) {
      return setStatus("Add at least one section or slide title.");
    }

    setLoading(true);
    setStatus("");
    try {
      const { data } = await createProject({
        ...projectForm,
        sections: preparedSections,
      });
      setProjects((prev) => [data, ...prev]);
      resetProjectForm();
      setStatus("Project scaffolded. Open it to generate content.");
    } catch (error) {
      setStatus(error.response?.data?.detail || "Failed to create project.");
    } finally {
      setLoading(false);
    }
  };

  const openProject = async (projectId) => {
    setLoading(true);
    try {
      const { data } = await fetchProject(projectId);
      setSelectedProject(data);
    } catch (error) {
      setStatus(error.response?.data?.detail || "Unable to load project.");
    } finally {
      setLoading(false);
    }
  };

  const refreshProject = async (projectId) => {
    const { data } = await fetchProject(projectId);
    setSelectedProject(data);
    const list = await fetchProjects();
    setProjects(list.data);
  };

  const handleGenerate = async (regenerate = false) => {
    if (!selectedProject) return;
    setLoading(true);
    setStatus(regenerate ? "Regenerating document..." : "Generating document...");
    try {
      await generateProject(selectedProject.id, regenerate);
      await refreshProject(selectedProject.id);
      setStatus("Content ready!");
    } catch (error) {
      setStatus(error.response?.data?.detail || "Generation failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleRefine = async (sectionId) => {
    const prompt = sectionPrompts[sectionId];
    if (!prompt) return;
    setLoading(true);
    try {
      const { data } = await refineSection(sectionId, prompt);
      setSelectedProject((prev) => ({
        ...prev,
        sections: prev.sections.map((section) =>
          section.id === sectionId ? data : section
        ),
      }));
      setSectionPrompts((prev) => ({ ...prev, [sectionId]: "" }));
      setStatus("Section refined.");
    } catch (error) {
      setStatus(error.response?.data?.detail || "Refinement failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleFeedback = async (sectionId, is_positive = null) => {
    const payload = {
      is_positive,
      comment: sectionComments[sectionId] || undefined,
    };
    setLoading(true);
    try {
      const { data } = await leaveFeedback(sectionId, payload);
      setSelectedProject((prev) => ({
        ...prev,
        sections: prev.sections.map((section) =>
          section.id === sectionId ? data : section
        ),
      }));
      setSectionComments((prev) => ({ ...prev, [sectionId]: "" }));
      setStatus("Feedback saved.");
    } catch (error) {
      setStatus(error.response?.data?.detail || "Unable to save feedback.");
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!selectedProject) return;
    try {
      const response = await exportProject(selectedProject.id);
      const blob = new Blob([response.data], { type: response.headers["content-type"] });
      const url = window.URL.createObjectURL(blob);
      const extension = isDocx ? "docx" : "pptx";
      const link = document.createElement("a");
      link.href = url;
      link.download = `${selectedProject.title}.${extension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      setStatus("Export complete.");
    } catch (error) {
      setStatus(error.response?.data?.detail || "Export failed.");
    }
  };

  const handleSuggestOutline = async () => {
    if (!projectForm.topic) {
      return setStatus("Enter a topic to request AI outline.");
    }
    setLoading(true);
    setStatus("Generating outline...");
    try {
      const {
        data: { suggestions },
      } = await suggestOutline(projectForm.topic, projectForm.doc_type);
      if (!suggestions?.length) {
        setStatus("AI did not return suggestions. Try again.");
      } else {
        setProjectForm((prev) => ({
          ...prev,
          sections: suggestions.map((heading) => ({ heading })),
        }));
        setStatus("Outline drafted. Feel free to edit.");
      }
    } catch (error) {
      setStatus(error.response?.data?.detail || "Unable to fetch outline.");
    } finally {
      setLoading(false);
    }
  };

  const authCard = (
    <div className="auth-card">
      <h1>Ocean AI Docs</h1>
      <p>Generate, refine, and export client-ready documents with Gemini.</p>
      <form onSubmit={handleAuthSubmit}>
        <label>Email</label>
        <input
          type="email"
          value={authForm.email}
          onChange={(event) =>
            setAuthForm((prev) => ({ ...prev, email: event.target.value }))
          }
          required
        />
        <label>Password</label>
        <input
          type="password"
          value={authForm.password}
          onChange={(event) =>
            setAuthForm((prev) => ({ ...prev, password: event.target.value }))
          }
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? "Please wait..." : authMode === "login" ? "Sign in" : "Create account"}
        </button>
      </form>
      <p className="auth-switch">
        {authMode === "login" ? "Need an account?" : "Already have an account?"}{" "}
        <button type="button" onClick={() => setAuthMode(authMode === "login" ? "register" : "login")}>
          {authMode === "login" ? "Register" : "Sign in"}
        </button>
      </p>
      {status && <p className="status">{status}</p>}
    </div>
  );

  const projectList = (
    <div className="list-panel">
      <div className="panel-header">
        <h2>Your projects</h2>
        <button className="ghost" onClick={bootstrapUser}>
          Refresh
        </button>
      </div>
      {projects.length === 0 ? (
        <p className="muted">No projects yet. Create one to get started.</p>
      ) : (
        projects.map((project) => (
          <div
            key={project.id}
            className={`project-card ${
              selectedProject?.id === project.id ? "active" : ""
            }`}
            onClick={() => openProject(project.id)}
          >
            <div>
              <p className="eyebrow">{project.doc_type === "word" ? ".docx" : ".pptx"}</p>
              <h3>{project.title}</h3>
              <p className="muted">{project.topic}</p>
            </div>
            <span className={`status-pill status-${project.status}`}>
              {project.status}
            </span>
          </div>
        ))
      )}
    </div>
  );

  const projectFormPanel = (
    <div className="form-panel">
      <h2>New project</h2>
      <form onSubmit={handleProjectCreate}>
        <label>Document title</label>
        <input
          value={projectForm.title}
          onChange={(event) =>
            setProjectForm((prev) => ({ ...prev, title: event.target.value }))
          }
          placeholder="EV Market Brief"
          required
        />
        <label>Main topic</label>
        <input
          value={projectForm.topic}
          onChange={(event) =>
            setProjectForm((prev) => ({ ...prev, topic: event.target.value }))
          }
          placeholder="A market analysis of the EV industry in 2025"
          required
        />
        <label>Document type</label>
        <select
          value={projectForm.doc_type}
          onChange={(event) =>
            setProjectForm((prev) => ({ ...prev, doc_type: event.target.value }))
          }
        >
          <option value="word">Microsoft Word (.docx)</option>
          <option value="ppt">PowerPoint (.pptx)</option>
        </select>
        <div className="sections-builder">
          <div className="panel-header">
            <h3>{projectForm.doc_type === "word" ? "Sections" : "Slides"}</h3>
            <button type="button" className="ghost" onClick={handleSuggestOutline}>
              AI suggest outline
            </button>
          </div>
          {projectForm.sections.map((section, index) => (
            <input
              key={index}
              value={section.heading}
              onChange={(event) => handleSectionHeadingChange(index, event.target.value)}
              placeholder={`Heading ${index + 1}`}
            />
          ))}
          <button type="button" className="ghost" onClick={handleAddSection}>
            + Add another
          </button>
        </div>
        <button type="submit" disabled={loading}>
          {loading ? "Saving..." : "Create structure"}
        </button>
      </form>
      {status && <p className="status">{status}</p>}
    </div>
  );

  const renderSections = () => {
    if (!selectedProject) return null;
    return selectedProject.sections.map((section) => (
      <div key={section.id} className="section-card">
        <div className="section-header">
          <div>
            <p className="eyebrow">Section {section.position + 1}</p>
            <h3>{section.heading}</h3>
          </div>
          <div className="section-actions">
            <button type="button" onClick={() => handleRefine(section.id)} disabled={loading}>
              Apply prompt
            </button>
            <button type="button" className="ghost" onClick={() => handleFeedback(section.id, null)}>
              Save comment
            </button>
          </div>
        </div>
        <div className="section-content">
          <pre>{section.content || "No content yet. Generate to begin."}</pre>
        </div>
        <div className="refine-block">
          <textarea
            placeholder="How should AI refine this section?"
            value={sectionPrompts[section.id] || ""}
            onChange={(event) =>
              setSectionPrompts((prev) => ({ ...prev, [section.id]: event.target.value }))
            }
          />
        </div>
        <div className="feedback-row">
          <button
            type="button"
            className="like"
            onClick={() => handleFeedback(section.id, true)}
            disabled={loading}
          >
            👍 Like
          </button>
          <button
            type="button"
            className="dislike"
            onClick={() => handleFeedback(section.id, false)}
            disabled={loading}
          >
            👎 Dislike
          </button>
          <input
            placeholder="Comment or revision note"
            value={sectionComments[section.id] || ""}
            onChange={(event) =>
              setSectionComments((prev) => ({
                ...prev,
                [section.id]: event.target.value,
              }))
            }
          />
        </div>
        {section.revisions?.length > 0 && (
          <details>
            <summary>Revision history</summary>
            <ul>
              {section.revisions.map((revision) => (
                <li key={revision.id}>
                  <p className="muted">
                    {new Date(revision.created_at).toLocaleString()} — {revision.prompt || "Auto"}
                  </p>
                  <pre>{revision.content}</pre>
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    ));
  };

  const projectDetail = selectedProject ? (
    <div className="detail-panel">
      <header className="detail-header">
        <div>
          <p className="eyebrow">{isDocx ? "Word document" : "PowerPoint deck"}</p>
          <h1>{selectedProject.title}</h1>
          <p className="muted">{selectedProject.topic}</p>
        </div>
        <div className="detail-actions">
          <button onClick={() => handleGenerate(false)} disabled={loading}>
            {selectedProject.status === "ready" ? "Regenerate missing" : "Generate"}
          </button>
          <button className="ghost" onClick={() => handleGenerate(true)} disabled={loading}>
            Regenerate all
          </button>
          <button className="secondary" onClick={handleExport}>
            Export {isDocx ? ".docx" : ".pptx"}
          </button>
        </div>
      </header>
      {renderSections()}
    </div>
  ) : (
    <div className="detail-panel empty">
      <p>Select a project to start generating content.</p>
    </div>
  );

  if (!user) {
    return <div className="app auth">{authCard}</div>;
  }

  return (
    <div className="app">
      <aside>
        <div className="user-block">
          <div>
            <p className="eyebrow">Logged in as</p>
            <strong>{user.email}</strong>
          </div>
          <button className="ghost" onClick={handleLogout}>
            Log out
          </button>
        </div>
        {projectFormPanel}
        {projectList}
      </aside>
      <main>{projectDetail}</main>
    </div>
  );
}

export default App;
