from pathlib import Path

from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = ROOT / "documents" / "pcs"
DISCLAIMER = "SYNTHETIC DEMO DOCUMENT - NOT A REAL MEDICAL OR CLAIM RECORD"

EXPECTED_CONTENT = {
    "timesheet_0416.pdf": [
        "DOC-TS-0416",
        "PI-PCS-2026-0041",
        "MBR-33915",
        "ATT-2087",
        "2026-04-16",
        "08:00",
        "12:00",
        "16",
    ],
    "timesheet_0519.pdf": [
        "DOC-TS-0519",
        "PI-PCS-2026-0041",
        "MBR-33915",
        "ATT-2087",
        "2026-05-19",
        "08:00",
        "13:00",
        "20",
    ],
    "poc_MBR-33915.pdf": [
        "DOC-POC-33915",
        "MBR-33915",
        "20",
        "80",
        "2026-01-01",
        "2026-12-31",
    ],
    "servicenote_0414.pdf": [
        "DOC-SN-0414",
        "MBR-33915",
        "2026-04-14",
        "left at noon",
        "12:00",
    ],
    "personnel_ATT-2087.pdf": [
        "DOC-PP-2087",
        "ATT-2087",
        "PCA-556210",
        "2026-03-31",
        "Not present",
    ],
    "provider_response.pdf": [
        "DOC-CORR-01",
        "Harbor Home Support Services",
        "2026-07-28",
        "14:00",
        "ATTACHMENTS",
        "1",
    ],
}


def extract_text(path: Path) -> str:
    reader = PdfReader(path)
    assert len(reader.pages) == 1
    return reader.pages[0].extract_text()


def test_generated_pcs_packet_contains_canonical_facts():
    for filename, expected_values in EXPECTED_CONTENT.items():
        path = OUTPUT_DIR / filename
        assert path.exists(), f"missing generated PDF: {filename}"
        text = extract_text(path)
        assert DISCLAIMER in text
        for expected in expected_values:
            assert expected in text, f"{expected!r} missing from {filename}"


def test_every_generated_pdf_is_nonempty_and_single_page():
    for filename in EXPECTED_CONTENT:
        path = OUTPUT_DIR / filename
        assert path.stat().st_size > 2_000
        assert len(PdfReader(path).pages) == 1
