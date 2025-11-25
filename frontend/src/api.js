import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000",
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("ocean_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const register = (payload) => api.post("/auth/register", payload);

export const login = ({ email, password }) =>
  api.post(
    "/auth/login",
    new URLSearchParams({
      username: email,
      password,
    }),
    {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    }
  );

export const fetchMe = () => api.get("/auth/me");
export const fetchProjects = () => api.get("/projects");
export const createProject = (payload) => api.post("/projects", payload);
export const fetchProject = (id) => api.get(`/projects/${id}`);
export const generateProject = (id, regenerate = false) =>
  api.post(`/projects/${id}/generate`, { regenerate });
export const refineSection = (id, prompt) =>
  api.post(`/sections/${id}/refine`, { prompt });
export const leaveFeedback = (id, payload) =>
  api.post(`/sections/${id}/feedback`, payload);
export const exportProject = (id) =>
  api.get(`/projects/${id}/export`, { responseType: "blob" });
export const suggestOutline = (topic, docType) =>
  api.get("/ai/suggest-outline", { params: { topic, doc_type: docType } });

export default api;

