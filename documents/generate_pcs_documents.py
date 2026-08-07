from __future__ import annotations

from pathlib import Path
from typing import Iterable

from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.pdfbase.pdfmetrics import stringWidth
from reportlab.pdfgen import canvas


ROOT = Path(__file__).resolve().parent
OUTPUT_DIR = ROOT / "pcs"
PAGE_WIDTH, PAGE_HEIGHT = letter
MARGIN = 42

NAVY = colors.HexColor("#12304A")
TEAL = colors.HexColor("#0E7490")
PALE_TEAL = colors.HexColor("#E6F5F7")
PALE_RED = colors.HexColor("#FDECEC")
RED = colors.HexColor("#A61B1B")
SLATE = colors.HexColor("#425466")
GRID = colors.HexColor("#B8C6D1")
PALE_GRAY = colors.HexColor("#F4F7F9")
INK_BLUE = colors.HexColor("#174EA6")

DISCLAIMER = "SYNTHETIC DEMO DOCUMENT - NOT A REAL MEDICAL OR CLAIM RECORD"
CASE_ID = "PI-PCS-2026-0041"
PROVIDER = "Harbor Home Support Services"


def fit_text(value: str, font: str, size: float, width: float) -> str:
    if stringWidth(value, font, size) <= width:
        return value
    suffix = "..."
    candidate = value
    while candidate and stringWidth(candidate + suffix, font, size) > width:
        candidate = candidate[:-1]
    return candidate + suffix


def base_document(path: Path, title: str, subtitle: str, doc_id: str) -> canvas.Canvas:
    pdf = canvas.Canvas(str(path), pagesize=letter, pageCompression=1)
    pdf.setTitle(f"{title} - {doc_id}")
    pdf.setAuthor("Program Integrity 360 synthetic demo")
    pdf.setSubject(DISCLAIMER)

    pdf.setFillColor(PALE_RED)
    pdf.rect(0, PAGE_HEIGHT - 34, PAGE_WIDTH, 34, stroke=0, fill=1)
    pdf.setFillColor(RED)
    pdf.setFont("Helvetica-Bold", 9)
    pdf.drawCentredString(PAGE_WIDTH / 2, PAGE_HEIGHT - 22, DISCLAIMER)

    pdf.setFillColor(NAVY)
    pdf.setFont("Helvetica-Bold", 20)
    pdf.drawString(MARGIN, PAGE_HEIGHT - 72, title)
    pdf.setFillColor(SLATE)
    pdf.setFont("Helvetica", 10)
    pdf.drawString(MARGIN, PAGE_HEIGHT - 90, subtitle)

    pdf.setFillColor(PALE_TEAL)
    pdf.roundRect(PAGE_WIDTH - 206, PAGE_HEIGHT - 103, 164, 52, 6, stroke=0, fill=1)
    pdf.setFillColor(TEAL)
    pdf.setFont("Helvetica-Bold", 8)
    pdf.drawString(PAGE_WIDTH - 194, PAGE_HEIGHT - 70, "DOCUMENT ID")
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawString(PAGE_WIDTH - 194, PAGE_HEIGHT - 84, doc_id)
    pdf.setFont("Helvetica", 8)
    pdf.drawString(PAGE_WIDTH - 194, PAGE_HEIGHT - 97, f"Case {CASE_ID}")
    return pdf


def section_header(pdf: canvas.Canvas, y: float, title: str) -> float:
    pdf.setFillColor(NAVY)
    pdf.roundRect(MARGIN, y - 18, PAGE_WIDTH - (2 * MARGIN), 22, 4, stroke=0, fill=1)
    pdf.setFillColor(colors.white)
    pdf.setFont("Helvetica-Bold", 10)
    pdf.drawString(MARGIN + 10, y - 11, title.upper())
    return y - 30


def key_values(
    pdf: canvas.Canvas,
    y: float,
    pairs: Iterable[tuple[str, str]],
    columns: int = 2,
) -> float:
    pairs = list(pairs)
    col_width = (PAGE_WIDTH - (2 * MARGIN)) / columns
    row_height = 34
    for index, (label, value) in enumerate(pairs):
        col = index % columns
        row = index // columns
        x = MARGIN + (col * col_width)
        top = y - (row * row_height)
        pdf.setFillColor(SLATE)
        pdf.setFont("Helvetica-Bold", 7.5)
        pdf.drawString(x, top, label.upper())
        pdf.setFillColor(NAVY)
        pdf.setFont("Helvetica", 10)
        pdf.drawString(x, top - 14, fit_text(value, "Helvetica", 10, col_width - 14))
    rows = (len(pairs) + columns - 1) // columns
    return y - (rows * row_height) - 4


def table(
    pdf: canvas.Canvas,
    y: float,
    headers: list[str],
    rows: list[list[str]],
    widths: list[float],
    handwritten_cell: tuple[int, int] | None = None,
) -> float:
    row_height = 30
    total_width = sum(widths)
    pdf.setStrokeColor(GRID)
    pdf.setLineWidth(0.6)
    pdf.setFillColor(PALE_GRAY)
    pdf.rect(MARGIN, y - row_height, total_width, row_height, stroke=1, fill=1)

    x = MARGIN
    for header, width in zip(headers, widths):
        pdf.setFillColor(NAVY)
        pdf.setFont("Helvetica-Bold", 8)
        pdf.drawString(x + 6, y - 19, fit_text(header, "Helvetica-Bold", 8, width - 12))
        pdf.line(x, y, x, y - row_height * (len(rows) + 1))
        x += width
    pdf.line(MARGIN + total_width, y, MARGIN + total_width, y - row_height * (len(rows) + 1))

    for row_index, values in enumerate(rows):
        row_top = y - row_height * (row_index + 1)
        if row_index % 2:
            pdf.setFillColor(colors.HexColor("#FAFCFD"))
            pdf.rect(MARGIN, row_top - row_height, total_width, row_height, stroke=0, fill=1)
        x = MARGIN
        for col_index, (value, width) in enumerate(zip(values, widths)):
            is_handwritten = handwritten_cell == (row_index, col_index)
            pdf.setFillColor(INK_BLUE if is_handwritten else NAVY)
            pdf.setFont("Courier-Oblique" if is_handwritten else "Helvetica", 10)
            pdf.drawString(
                x + 6,
                row_top - 19,
                fit_text(
                    value,
                    "Courier-Oblique" if is_handwritten else "Helvetica",
                    10,
                    width - 12,
                ),
            )
            pdf.line(x, row_top, x, row_top - row_height)
            x += width
        pdf.line(MARGIN, row_top - row_height, MARGIN + total_width, row_top - row_height)
    return y - row_height * (len(rows) + 1) - 12


def narrative_box(pdf: canvas.Canvas, y: float, title: str, lines: list[str]) -> float:
    height = 36 + (len(lines) * 17)
    pdf.setFillColor(PALE_GRAY)
    pdf.setStrokeColor(GRID)
    pdf.roundRect(MARGIN, y - height, PAGE_WIDTH - (2 * MARGIN), height, 5, stroke=1, fill=1)
    pdf.setFillColor(TEAL)
    pdf.setFont("Helvetica-Bold", 8)
    pdf.drawString(MARGIN + 12, y - 17, title.upper())
    pdf.setFillColor(NAVY)
    pdf.setFont("Helvetica", 10)
    cursor = y - 36
    for line in lines:
        pdf.drawString(MARGIN + 12, cursor, line)
        cursor -= 17
    return y - height - 14


def finish(pdf: canvas.Canvas, source_note: str) -> None:
    pdf.setStrokeColor(GRID)
    pdf.line(MARGIN, 48, PAGE_WIDTH - MARGIN, 48)
    pdf.setFillColor(SLATE)
    pdf.setFont("Helvetica", 7.5)
    pdf.drawString(MARGIN, 34, source_note)
    pdf.drawRightString(PAGE_WIDTH - MARGIN, 34, "Program Integrity 360 | Synthetic evidence fixture | Page 1 of 1")
    pdf.showPage()
    pdf.save()


def generate_timesheet(
    filename: str,
    doc_id: str,
    service_date: str,
    time_out: str,
    supported_units: int,
    handwritten: bool,
) -> None:
    pdf = base_document(
        OUTPUT_DIR / filename,
        "Personal Care Services Timesheet",
        "Daily service verification form",
        doc_id,
    )
    y = section_header(pdf, 650, "Member and service details")
    y = key_values(
        pdf,
        y,
        [
            ("Provider", PROVIDER),
            ("Provider ID", "PRV-100482"),
            ("Member ID", "MBR-33915"),
            ("Attendant", "Jordan Ellis (ATT-2087)"),
            ("Service", "Personal Care Services"),
            ("Place of service", "12 - Member home"),
        ],
    )
    y = section_header(pdf, y, "Recorded service entry")
    y = table(
        pdf,
        y,
        ["Date of Service", "Time In", "Time Out", "Supported Units", "Entry Source"],
        [[service_date, "08:00", time_out, str(supported_units), "Provider timesheet"]],
        [116, 78, 82, 110, 142],
        handwritten_cell=(0, 2) if handwritten else None,
    )
    if handwritten:
        y = narrative_box(
            pdf,
            y,
            "Field note",
            [
                "Time-out was entered by hand in blue ink and requires human validation.",
                "Recorded value: 12:00. Printed supported units: 16.",
            ],
        )
    else:
        y = narrative_box(
            pdf,
            y,
            "Field note",
            ["All service fields were entered electronically by the provider."],
        )
    y = section_header(pdf, y, "Attestation")
    key_values(
        pdf,
        y,
        [
            ("Attendant signature", "Jordan Ellis"),
            ("Submission status", "Submitted for review"),
        ],
    )
    finish(pdf, f"Source ID {doc_id}; created solely for a fictional UiPath demonstration.")


def generate_plan_of_care() -> None:
    doc_id = "DOC-POC-33915"
    pdf = base_document(
        OUTPUT_DIR / "poc_MBR-33915.pdf",
        "Personal Care Plan of Care",
        "Medicaid service authorization summary",
        doc_id,
    )
    y = section_header(pdf, 650, "Authorization")
    y = key_values(
        pdf,
        y,
        [
            ("Member ID", "MBR-33915"),
            ("Authorization ID", "AUTH-PCS-33915-2026"),
            ("Service", "Personal Care"),
            ("Status", "Active"),
            ("Effective", "2026-01-01"),
            ("Expires", "2026-12-31"),
        ],
    )
    y = section_header(pdf, y, "Authorized limits")
    y = table(
        pdf,
        y,
        ["Measure", "Authorized Amount", "Unit Definition", "Review Note"],
        [
            ["Daily limit", "20 units", "15 minutes per unit", "Do not exceed without review"],
            ["Weekly limit", "80 units", "15 minutes per unit", "Subject to plan dates"],
        ],
        [116, 128, 134, 150],
    )
    narrative_box(
        pdf,
        y,
        "Care-plan purpose",
        [
            "Authorization establishes service limits; it does not validate that a billed visit occurred.",
            "Compare claims with EVV, timesheets, and service notes before any determination.",
        ],
    )
    finish(pdf, f"Source ID {doc_id}; synthetic plan-of-care evidence for {CASE_ID}.")


def generate_service_note() -> None:
    doc_id = "DOC-SN-0414"
    pdf = base_document(
        OUTPUT_DIR / "servicenote_0414.pdf",
        "Personal Care Service Note",
        "Visit narrative and documented end time",
        doc_id,
    )
    y = section_header(pdf, 650, "Visit details")
    y = key_values(
        pdf,
        y,
        [
            ("Member ID", "MBR-33915"),
            ("Date of service", "2026-04-14"),
            ("Attendant", "Jordan Ellis (ATT-2087)"),
            ("Documented end", "12:00"),
        ],
    )
    y = section_header(pdf, y, "Narrative")
    y = narrative_box(
        pdf,
        y,
        "Attendant note",
        [
            "Assisted with morning bathing and breakfast; left at noon.",
            "Member was comfortable when the visit ended. No incident was reported.",
        ],
    )
    y = section_header(pdf, y, "Review cues")
    table(
        pdf,
        y,
        ["Extracted Field", "Document Value", "Validation Route"],
        [["documented_end", "12:00", "Human review below 0.85 confidence"]],
        [180, 150, 198],
    )
    finish(pdf, f"Source ID {doc_id}; synthetic service note for {CASE_ID}.")


def generate_personnel_packet() -> None:
    doc_id = "DOC-PP-2087"
    pdf = base_document(
        OUTPUT_DIR / "personnel_ATT-2087.pdf",
        "Personnel Credential Packet",
        "Attendant qualification and document checklist",
        doc_id,
    )
    y = section_header(pdf, 650, "Attendant credential")
    y = key_values(
        pdf,
        y,
        [
            ("Attendant", "Jordan Ellis"),
            ("Attendant ID", "ATT-2087"),
            ("Credential ID", "PCA-556210"),
            ("Credential expiry", "2026-03-31"),
        ],
    )
    y = section_header(pdf, y, "Required document checklist")
    y = table(
        pdf,
        y,
        ["Required Document", "Status", "Packet Note"],
        [
            ["Training acknowledgment", "Not present", "No signed acknowledgment in packet"],
            ["Background-check attestation", "Not present", "Current attestation not supplied"],
            ["Personal care certification", "Present", "PCA-556210; expiry 2026-03-31"],
        ],
        [190, 110, 228],
    )
    narrative_box(
        pdf,
        y,
        "Sensitive-document control",
        [
            "This personnel document requires human review regardless of extraction confidence.",
            "The packet is evidence for review and is not an autonomous eligibility determination.",
        ],
    )
    finish(pdf, f"Source ID {doc_id}; synthetic sensitive evidence for {CASE_ID}.")


def generate_provider_response() -> None:
    doc_id = "DOC-CORR-01"
    pdf = base_document(
        OUTPUT_DIR / "provider_response.pdf",
        "Provider Records Response",
        "Response to Program Integrity document request",
        doc_id,
    )
    y = section_header(pdf, 650, "Correspondence details")
    y = key_values(
        pdf,
        y,
        [
            ("From", PROVIDER),
            ("Received", "2026-07-28"),
            ("Related case", CASE_ID),
            ("Attachments", "1"),
        ],
    )
    y = section_header(pdf, y, "Provider statement")
    y = narrative_box(
        pdf,
        y,
        "Summary",
        [
            "Provider states the 04-16 visit extended to 14:00 due to member need.",
            "Provider acknowledges certification renewal is in progress.",
            "The response does not resolve the EVV and timesheet mismatch for 04-16.",
        ],
    )
    y = section_header(pdf, y, "Attachment inventory")
    table(
        pdf,
        y,
        ["Attachment", "Description", "Review Status"],
        [["1", "Supplemental provider narrative", "Pending investigator review"]],
        [90, 250, 188],
    )
    finish(pdf, f"Source ID {doc_id}; synthetic correspondence for {CASE_ID}.")


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    generate_timesheet(
        "timesheet_0416.pdf",
        "DOC-TS-0416",
        "2026-04-16",
        "12:00",
        16,
        handwritten=True,
    )
    generate_timesheet(
        "timesheet_0519.pdf",
        "DOC-TS-0519",
        "2026-05-19",
        "13:00",
        20,
        handwritten=False,
    )
    generate_plan_of_care()
    generate_service_note()
    generate_personnel_packet()
    generate_provider_response()
    print(f"Generated 6 synthetic PDFs in {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
