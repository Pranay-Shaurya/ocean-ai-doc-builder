import os
from typing import Literal

from google import genai

MODEL_NAME = "gemini-2.0-flash"

api_key = os.environ.get("GEMINI_API_KEY")
if not api_key:
    raise RuntimeError("GEMINI_API_KEY is not set. Please configure it before running.")

client = genai.Client(api_key=api_key)


def _call_model(prompt: str) -> str:
    try:
        response = client.models.generate_content(model=MODEL_NAME, contents=prompt)
        return (response.text or "").strip()
    except Exception as exc:  # noqa: BLE001
        return f"AI Error: {exc}"


def generate_section_content(
    topic: str,
    doc_type: Literal["word", "ppt"],
    heading: str,
    current_content: str | None = None,
    refine_prompt: str | None = None,
) -> str:
    if refine_prompt:
        prompt = (
            f"You are refining content for a {doc_type.upper()} document titled '{topic}'.\n"
            f"Section/Slide heading: {heading}\n"
            f"Existing content:\n{current_content or 'N/A'}\n\n"
            f"Instructions: {refine_prompt}\n"
            "Return polished content only."
        )
    else:
        structure_hint = (
            "Provide rich paragraphs with sub-points."
            if doc_type == "word"
            else "Return bullet points and speaker notes suitable for a slide."
        )
        prompt = (
            f"Write content for a {doc_type.upper()} document on '{topic}'.\n"
            f"Section/Slide heading: {heading}\n"
            f"{structure_hint}"
        )
    return _call_model(prompt)


def suggest_outline(topic: str, doc_type: Literal["word", "ppt"]) -> list[str]:
    prompt = (
        f"Suggest an outline for a {doc_type.upper()} document about '{topic}'. "
        "Return 5-7 concise headings, one per line."
    )
    raw = _call_model(prompt)
    suggestions = [
        line.strip(" -•") for line in raw.splitlines() if line.strip().replace("-", "")
    ]
    return [s for s in suggestions if s]

