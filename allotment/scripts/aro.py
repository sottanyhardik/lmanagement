# tl_utils.py
import os
import platform
import shutil
import subprocess
from pathlib import Path
from typing import Dict, List, Optional

from docxtpl import DocxTemplate


def remove(path: str) -> None:
    p = Path(path)
    if p.is_file():
        p.unlink(missing_ok=True)
    elif p.is_dir():
        shutil.rmtree(p, ignore_errors=True)


def find_office_executable() -> Optional[str]:
    """
    Try multiple options to locate LibreOffice/soffice.
    Priority:
      1) $LIBREOFFICE_PATH (env)
      2) which('soffice'), which('libreoffice'), which('lowriter')
      3) macOS app path
    Returns the absolute path or None.
    """
    # 1) Env override
    env_path = os.environ.get("LIBREOFFICE_PATH")
    if env_path and shutil.which(env_path):
        return shutil.which(env_path)

    # 2) Common names
    for candidate in ("soffice", "libreoffice", "lowriter"):
        p = shutil.which(candidate)
        if p:
            return p

    # 3) macOS application bundle path
    if platform.system() == "Darwin":
        mac_path = "/Applications/LibreOffice.app/Contents/MacOS/soffice"
        if Path(mac_path).exists():
            return mac_path

    return None


def safe_save_docx(template_path: str, context: dict, out_path: str) -> None:
    doc = DocxTemplate(template_path)
    doc.render(context)
    # Some templates fail on first save due to images/relationships;
    # attempt once, then retry:
    try:
        doc.save(out_path)
    except Exception:
        doc.save(out_path)


def convert_docx_to_pdf(soffice: str, docx_path: str, out_dir: str) -> None:
    subprocess.run(
        [
            soffice,
            "--headless",
            "--convert-to", "pdf",
            "--outdir", out_dir,
            docx_path,
        ],
        check=True,
    )


def generate_tl_software(
        data: List[Dict],
        tl_path: str,
        path: str = "",
        transfer_letter_name: str = "",
) -> Dict[str, Optional[str]]:
    """
    Renders each context in `data` into a DOCX (from tl_path) and converts to PDF if possible.
    Returns dict with {"converter": <path or None>} so caller can decide whether to warn.
    """
    if not data:
        return {"converter": None}

    out_dir = Path(path) if path else Path.cwd()
    out_dir.mkdir(parents=True, exist_ok=True)

    soffice = find_office_executable()

    for context in data:
        # Ensure required keys exist (avoid KeyError & ensure string types)
        license_str = str(context.get("license", "")).zfill(10)
        status_str = str(context.get("status", "") or "")
        base_filename = f"{license_str}_{status_str}_{transfer_letter_name}".strip("_")

        docx_file = out_dir / f"{base_filename}.docx"
        pdf_file = out_dir / f"{base_filename}.pdf"

        # Clean previous leftovers
        if docx_file.exists():
            docx_file.unlink()
        if pdf_file.exists():
            pdf_file.unlink()

        # Mutate a copy to avoid side effects
        ctx = dict(context)
        # If you must suppress file_number in template, do it here:
        ctx.setdefault("file_number", ctx.get("file_number", ""))

        # Render DOCX
        safe_save_docx(tl_path, ctx, str(docx_file))

        # Convert to PDF if soffice is available
        if soffice:
            try:
                convert_docx_to_pdf(soffice, str(docx_file), str(out_dir))
                # Remove DOCX after successful conversion (optional)
                try:
                    docx_file.unlink()
                except Exception:
                    pass
            except subprocess.CalledProcessError as e:
                # Leave DOCX in place if conversion fails
                # You could log e if you have logging configured
                pass

    return {"converter": soffice}
