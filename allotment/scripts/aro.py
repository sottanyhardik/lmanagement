import csv
import os
import subprocess

from docxtpl import DocxTemplate


def remove(path):
    """ param <path> could either be relative or absolute. """
    import os
    if os.path.isfile(path):
        os.remove(path)  # remove the file
    elif os.path.isdir(path):
        if os.path.exists(path) and os.path.isdir(path):
            shutil.rmtree(path)  # remove dir and all contains
    else:
        return True


def generate_documents(data=None, path=''):
    if data:
        input_file = data
        import os
        remove(path)
        os.mkdir(path)
    else:
        input_file = csv.DictReader(open("aro_details.csv"))
    for context in input_file:
        doc = DocxTemplate("_consent_letter.docx")
        doc.render(context)
        doc.save(path + context['license'] + "_consent_letter.docx")
        doc = DocxTemplate("_request_letter.docx")
        doc.render(context)
        doc.save(path + context['license'] + "_request_letter.docx")


def fetch_cif():
    from license.models import LicenseDetailsModel
    licenses = LicenseDetailsModel.objects.all()
    for license in licenses:
        license.balance_cif = license.get_balance_cif
        license.save()


def generate_tl():
    input_file = csv.DictReader(open("aro_details.csv"))
    for context in input_file:
        print(context)
        if context['tl_company'] == 'GE':
            doc = DocxTemplate("__GE_TL.docx")
            doc.render(context)
            doc.save(context['sr_no'] + ' ' + context['license'] + "_GE_TL.docx")
        if context['tl_company'] == 'gmpl':
            doc = DocxTemplate("__GMPL_TL.docx")
            doc.render(context)
            doc.save(context['sr_no'] + ' ' + context['license'] + "_GMPL_TL.docx")
        else:
            doc = DocxTemplate("__GE_TL.docx")
            doc.render(context)
            doc.save(context['sr_no'] + ' ' + context['license'] + "_GE_TL.docx")
            doc = DocxTemplate("__GMPL_TL.docx")
            doc.render(context)
            doc.save(context['sr_no'] + ' ' + context['license'] + "_GMPL_TL.docx")


def generate_agreement():
    input_file = csv.DictReader(open("aro_invalidation.csv", 'r', encoding='utf-8'))
    for context in input_file:
        print(context)
        dict_data = context
        doc = DocxTemplate("Tri-party agreement.docx")
        doc.render(dict_data)
        doc.save(context['license'] + "_Tri-party agreement.docx")


import platform
import shutil


def get_libreoffice_path():
    if platform.system() == "Darwin":  # macOS
        return "/Applications/LibreOffice.app/Contents/MacOS/soffice"
    return shutil.which("libreoffice")  # Linux/Windows


def generate_tl_software(data, tl_path, path='', transfer_letter_name=""):
    if not data:
        return

    # Ensure directory exists
    if os.path.exists(path):
        # optional: remove everything if you want a fresh dir
        # shutil.rmtree(path)
        pass
    os.makedirs(path, exist_ok=True)

    for context in data:
        doc = DocxTemplate(tl_path)
        doc.render(context)

        license_str = str(context['license']).zfill(10)  # Ensures leading zero if needed
        base_filename = f"{license_str}_{context['status']}_{transfer_letter_name}"
        docx_file = os.path.join(path, f"{base_filename}.docx")
        pdf_file = os.path.join(path, f"{base_filename}.pdf")

        # 🔹 Delete if already exists
        for f in [docx_file, pdf_file]:
            if os.path.exists(f):
                os.remove(f)

        try:
            context['file_number'] = ''
            doc.save(docx_file)
        except Exception:
            # Fallback save
            doc.save(docx_file)

        # Convert DOCX to PDF using LibreOffice (headless mode)
        try:
            subprocess.run([
                get_libreoffice_path(),
                "--headless",
                "--convert-to", "pdf",
                "--outdir", path,
                docx_file
            ], check=True)
            if os.path.exists(docx_file):
                os.remove(docx_file)  # remove docx after successful conversion
        except subprocess.CalledProcessError as e:
            print(f"Error converting to PDF: {e}")
