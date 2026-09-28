from __future__ import annotations

import asyncio
import argparse
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

API_URL = "https://ruj.uj.edu.pl/server/api/discover/search/objects"
PAGE_SIZE = 100
REQUEST_TIMEOUT = 30.0
PAGE_DELAY = 1.0
MAX_CONCURRENT_REQUESTS = 3
MAX_KEEPALIVE_CONNECTIONS = 3
RETRY_ATTEMPTS = 4
RETRY_BACKOFF_MIN = 2
RETRY_BACKOFF_MAX = 30
OUTPUT_PATH = Path(__file__).resolve().parent.parent / "public" / "search-index.json"
STATE_PATH = Path(__file__).resolve().parent / "scrape-state.json"
LANGUAGE_LABELS = {
    "eng": "Angielski",
    "en": "Angielski",
    "english": "Angielski",
    "angielski": "Angielski",
    "pol": "Polski",
    "pl": "Polski",
    "polish": "Polski",
    "polski": "Polski",
    "ger": "Niemiecki",
    "de": "Niemiecki",
    "deu": "Niemiecki",
    "german": "Niemiecki",
    "deutsch": "Niemiecki",
    "niemiecki": "Niemiecki",
    "ita": "Włoski",
    "it": "Włoski",
    "italian": "Włoski",
    "włoski": "Włoski",
    "jpn": "Japoński",
    "ja": "Japoński",
    "japanese": "Japoński",
    "japoński": "Japoński",
    "spa": "Hiszpański",
    "es": "Hiszpański",
    "spanish": "Hiszpański",
    "hiszpański": "Hiszpański",
    "fra": "Francuski",
    "fre": "Francuski",
    "fr": "Francuski",
    "french": "Francuski",
    "francuski": "Francuski",
    "rus": "Rosyjski",
    "ru": "Rosyjski",
    "russian": "Rosyjski",
    "rosyjski": "Rosyjski",
    "ukr": "Ukraiński",
    "uk": "Ukraiński",
    "ukrainian": "Ukraiński",
    "ukraiński": "Ukraiński",
    "ara": "Arabski",
    "ar": "Arabski",
    "arabic": "Arabski",
    "arabski": "Arabski",
    "bul": "Bułgarski",
    "bg": "Bułgarski",
    "bulgarian": "Bułgarski",
    "bułgarski": "Bułgarski",
    "cze": "Czeski",
    "ces": "Czeski",
    "cs": "Czeski",
    "czech": "Czeski",
    "czeski": "Czeski",
    "gag": "Gagauski",
    "gagauz": "Gagauski",
    "gagauski": "Gagauski",
    "hun": "Węgierski",
    "hu": "Węgierski",
    "hungarian": "Węgierski",
    "węgierski": "Węgierski",
    "lat": "Łaciński",
    "la": "Łaciński",
    "latin": "Łaciński",
    "łaciński": "Łaciński",
    "per": "Perski",
    "fas": "Perski",
    "fa": "Perski",
    "persian": "Perski",
    "perski": "Perski",
    "por": "Portugalski",
    "pt": "Portugalski",
    "portuguese": "Portugalski",
    "portugalski": "Portugalski",
    "rum": "Rumuński",
    "ron": "Rumuński",
    "ro": "Rumuński",
    "romanian": "Rumuński",
    "rumuński": "Rumuński",
    "srp": "Serbski",
    "sr": "Serbski",
    "serbian": "Serbski",
    "serbski": "Serbski",
    "swe": "Szwedzki",
    "sv": "Szwedzki",
    "swedish": "Szwedzki",
    "szwedzki": "Szwedzki",
    "tur": "Turecki",
    "tr": "Turecki",
    "turkish": "Turecki",
    "turecki": "Turecki",
}
LANGUAGE_HINTS = {
    "Angielski": {
        "the", "of", "and", "in", "study", "studies", "analysis", "impact", "research",
    },
    "Polski": {
        "i", "w", "na", "oraz", "dla", "jako", "wpływ", "analiza", "zjawisko",
        "przykładzie", "świetle", "międzynarodowego", "prawo", "pracy", "społeczne", "polski",
    },
    "Niemiecki": {"der", "die", "das", "und", "von", "eine", "einer", "deutschen"},
    "Włoski": {"il", "lo", "la", "gli", "di", "del", "della", "nel", "analisi"},
    "Hiszpański": {"el", "lo", "la", "los", "las", "de", "del", "en", "una", "lengua", "española", "análisis"},
    "Francuski": {"le", "la", "les", "de", "des", "dans", "une", "analyse"},
}
LANGUAGE_HINT_THRESHOLD = 2


@dataclass(frozen=True)
class Collection:
    thesis_type: str
    uuid: str


COLLECTIONS = (
    Collection("master", "60a5918c-40a4-4c56-9413-9aaeea82b732"),
    Collection("bachelor", "8d247a96-054e-419e-88b9-0df698bfcd99"),
)


@dataclass(frozen=True)
class SearchPage:
    items: list[dict[str, Any]]
    total_pages: int | None
    total_items: int | None


Record = dict[str, Any]


class DspaceClient:
    """Fetches DSpace search pages with bounded retries."""

    def __init__(self, base_url: str = API_URL) -> None:
        self._base_url = base_url
        self._client: httpx.AsyncClient | None = None

    async def __aenter__(self) -> DspaceClient:
        self._client = httpx.AsyncClient(
            timeout=REQUEST_TIMEOUT,
            limits=httpx.Limits(
                max_connections=MAX_CONCURRENT_REQUESTS,
                max_keepalive_connections=MAX_KEEPALIVE_CONNECTIONS,
            ),
        )
        return self

    async def __aexit__(self, *_: object) -> None:
        if self._client is not None:
            await self._client.aclose()

    @retry(
        retry=retry_if_exception_type(httpx.HTTPError),
        wait=wait_exponential(multiplier=1, min=RETRY_BACKOFF_MIN, max=RETRY_BACKOFF_MAX),
        stop=stop_after_attempt(RETRY_ATTEMPTS),
        reraise=True,
    )
    async def fetch_page(self, collection: Collection, page: int) -> dict[str, Any]:
        if self._client is None:
            raise RuntimeError("DspaceClient must be used as an async context manager")

        response = await self._client.get(
            self._base_url,
            params={"scope": collection.uuid, "page": page, "size": PAGE_SIZE},
        )
        response.raise_for_status()
        return response.json()


class DspaceParser:
    """Extracts and cleans thesis data from DSpace API responses."""

    @staticmethod
    def parse_page(payload: dict[str, Any]) -> SearchPage:
        search_result = payload.get("_embedded", {}).get("searchResult", {})
        raw_objects = search_result.get("_embedded", {}).get("objects", [])
        items = []
        for result in raw_objects:
            if not isinstance(result, dict):
                continue
            item = result.get("_embedded", {}).get("indexableObject")
            item = item or result.get("indexableObject") or result
            if isinstance(item, dict):
                items.append(item)

        page = search_result.get("page", {})
        return SearchPage(
            items=items,
            total_pages=DspaceParser._optional_int(page.get("totalPages")),
            total_items=DspaceParser._optional_int(page.get("totalElements")),
        )

    @staticmethod
    def metadata_values(
        item: dict[str, Any], field_names: set[str], collapse_whitespace: bool = True
    ) -> list[str]:
        metadata = item.get("metadata", [])
        if isinstance(metadata, dict):
            entries = (
                (key, value)
                for key, values in metadata.items()
                for value in (values if isinstance(values, list) else [values])
            )
        elif isinstance(metadata, list):
            entries = (
                (entry.get("key"), entry)
                for entry in metadata
                if isinstance(entry, dict)
            )
        else:
            entries = ()

        values = []
        for key, entry in entries:
            if not isinstance(key, str) or key.split("[", 1)[0] not in field_names:
                continue
            value = entry.get("value") if isinstance(entry, dict) else entry
            cleaned = (
                DspaceParser.clean_text(value)
                if collapse_whitespace
                else str(value).strip() if value is not None else ""
            )
            if cleaned:
                values.append(cleaned)
        return values

    @staticmethod
    def first_metadata_value(
        item: dict[str, Any], field_names: set[str], default: str = ""
    ) -> str:
        values = DspaceParser.metadata_values(item, field_names)
        return values[0] if values else default

    @staticmethod
    def clean_text(value: Any) -> str:
        if value is None:
            return ""
        return re.sub(r"\s+", " ", str(value)).strip()

    @staticmethod
    def keyword_values(item: dict[str, Any]) -> list[str]:
        raw_values = DspaceParser.metadata_values(
            item,
            {"dc.subject", "dc.subject.en", "dc.subject.other", "dc.subject.pl"},
            collapse_whitespace=False,
        )
        keywords = []
        seen = set()
        for raw_value in raw_values:
            value = re.sub(
                r"^\s*(?:key\s*words?|keywords?|słowa\s+kluczowe)\s*:\s*",
                "",
                raw_value,
                count=1,
                flags=re.IGNORECASE,
            )
            for keyword in re.split(r"[,;\n]+", value):
                cleaned = keyword.strip(" \t\r\n.,;:")
                if cleaned and cleaned.casefold() not in seen:
                    seen.add(cleaned.casefold())
                    keywords.append(cleaned)
        return keywords

    @staticmethod
    def _optional_int(value: Any) -> int | None:
        return value if isinstance(value, int) else None


class ThesisMapper:
    """Maps cleaned DSpace items to the application's public record schema."""

    @staticmethod
    def map_item(item: dict[str, Any], thesis_type: str) -> Record | None:
        identifier = ThesisMapper._identifier(item)
        if not identifier:
            return None

        title = DspaceParser.first_metadata_value(item, {"dc.title"})
        author = DspaceParser.first_metadata_value(
            item, {"dc.contributor.author", "dc.creator", "dc.contributor"}
        )
        year = ThesisMapper._parse_year(
            DspaceParser.first_metadata_value(
                item, {"dc.date.issued", "dc.date.submitted", "dc.date.createdat", "dc.date"}
            )
        )
        language = ThesisMapper._normalize_language(
            DspaceParser.first_metadata_value(item, {"dc.language.iso", "dc.language"})
        )
        if not language:
            language = ThesisMapper._infer_language(item)

        return {
            "id": identifier,
            "title": title,
            "author": author,
            "advisor": DspaceParser.first_metadata_value(
                item, {"dc.contributor.advisor", "thesis.advisor"}
            ),
            "reviewers": DspaceParser.metadata_values(
                item,
                {
                    "dc.contributor.reviewer",
                    "dc.contributor.committeeMember",
                    "dc.contributor.committee",
                },
            ),
            "department": DspaceParser.first_metadata_value(
                item,
                {
                    "dc.contributor.department",
                    "dc.affiliation",
                    "dc.subject.department",
                    "thesis.department",
                },
            ),
            "year": year,
            "language": language,
            "keywords": DspaceParser.keyword_values(item),
            "url": ThesisMapper._item_url(item, identifier),
            "type": thesis_type,
        }

    @staticmethod
    def _identifier(item: dict[str, Any]) -> str:
        return ThesisMapper.clean_identifier(item.get("handle") or item.get("uuid"))

    @staticmethod
    def clean_identifier(value: Any) -> str:
        return DspaceParser.clean_text(value).removeprefix("item/")

    @staticmethod
    def _item_url(item: dict[str, Any], identifier: str) -> str:
        handle = DspaceParser.clean_text(item.get("handle"))
        for prefix in ("http://hdl.handle.net/", "https://hdl.handle.net/"):
            handle = handle.removeprefix(prefix)
        if handle:
            return f"https://ruj.uj.edu.pl/handle/{handle}"
        return f"https://ruj.uj.edu.pl/items/{item.get('uuid', identifier)}"

    @staticmethod
    def _parse_year(value: str) -> int | None:
        match = re.search(r"\b(19|20)\d{2}\b", value)
        return int(match.group(0)) if match else None

    @staticmethod
    def _normalize_language(value: str) -> str:
        normalized = DspaceParser.clean_text(value).lower()
        return LANGUAGE_LABELS.get(normalized, DspaceParser.clean_text(value))

    @staticmethod
    def _infer_language(item: dict[str, Any]) -> str:
        title = DspaceParser.first_metadata_value(item, {"dc.title"})
        inferred = ThesisMapper._score_language(title)
        if inferred:
            return inferred

        keywords = " ".join(DspaceParser.keyword_values(item))
        return ThesisMapper._score_language(keywords)

    @staticmethod
    def _score_language(text: str) -> str:
        tokens = set(re.findall(r"[^\W\d_]+", text.casefold(), flags=re.UNICODE))
        if not tokens:
            return ""

        scores = {
            language: len(tokens & {hint.casefold() for hint in hints})
            for language, hints in LANGUAGE_HINTS.items()
        }
        if re.search(r"[а-яё]", text.casefold()):
            scores["Rosyjski"] = 2

        highest = max(scores.values(), default=0)
        winners = [language for language, score in scores.items() if score == highest]
        return winners[0] if highest >= LANGUAGE_HINT_THRESHOLD and len(winners) == 1 else ""


class RecordStore:
    """Owns checkpoint loading, ID-based deduplication, and atomic writes."""

    def __init__(self, output_path: Path) -> None:
        self.output_path = output_path
        self.records: dict[str, Record] = {}

    def load(self) -> None:
        if not self.output_path.exists():
            return

        try:
            saved_records = json.loads(self.output_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            print(f"Could not read existing records from {self.output_path}; starting fresh")
            return

        if not isinstance(saved_records, list):
            print(f"Existing records at {self.output_path} are not a JSON array; starting fresh")
            return

        for record in saved_records:
            if isinstance(record, dict) and isinstance(record.get("id"), str):
                normalized_record = dict(record)
                normalized_record["id"] = ThesisMapper.clean_identifier(record["id"])
                self.records[normalized_record["id"]] = normalized_record
        print(f"Loaded {len(self.records)} existing records from {self.output_path}")

    def add(self, record: Record | None) -> None:
        if record and isinstance(record.get("id"), str):
            self.records[record["id"]] = record

    def save(self) -> None:
        self.output_path.parent.mkdir(parents=True, exist_ok=True)
        temporary_path = self.output_path.with_name(f".{self.output_path.name}.tmp")
        try:
            temporary_path.write_text(
                json.dumps(list(self.records.values()), ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            temporary_path.replace(self.output_path)
        finally:
            temporary_path.unlink(missing_ok=True)


class ScrapeState:
    """Persists collection totals so scheduled jobs can skip unchanged scrapes."""

    def __init__(self, path: Path) -> None:
        self.path = path

    def load(self) -> dict[str, int]:
        if not self.path.exists():
            return {}
        try:
            state = json.loads(self.path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return {}
        totals = state.get("collection_totals", {}) if isinstance(state, dict) else {}
        return {
            thesis_type: total
            for thesis_type, total in totals.items()
            if isinstance(thesis_type, str) and isinstance(total, int)
        }

    def save(self, collection_totals: dict[str, int]) -> None:
        self.path.write_text(
            json.dumps({"collection_totals": collection_totals}, indent=2) + "\n",
            encoding="utf-8",
        )


class ThesisScraper:
    """Coordinates fetching, parsing, progress reporting, and checkpoints."""

    def __init__(self, client: DspaceClient, store: RecordStore, state: ScrapeState) -> None:
        self.client = client
        self.store = store
        self.state = state
        self.collection_totals: dict[str, int] = {}
        self.scraped_by_collection: dict[str, int] = {}

    async def run(self, collections: tuple[Collection, ...] = COLLECTIONS) -> None:
        self.store.load()
        for collection in collections:
            await self._scrape_collection(collection)
        self.store.save()
        self.state.save(self.collection_totals)
        print(f"Wrote {len(self.store.records)} unique records to {self.store.output_path}")

    async def _scrape_collection(self, collection: Collection) -> None:
        page_number = 0
        scraped_items = 0

        while True:
            payload = await self.client.fetch_page(collection, page_number)
            page = DspaceParser.parse_page(payload)
            if page.total_items is not None:
                self.collection_totals[collection.thesis_type] = page.total_items
            for item in page.items:
                self.store.add(ThesisMapper.map_item(item, collection.thesis_type))

            scraped_items += len(page.items)
            self.scraped_by_collection[collection.thesis_type] = scraped_items
            self._log_progress(collection, page_number, scraped_items, page)
            self.store.save()

            page_number += 1
            if not page.items or (
                page.total_pages is not None and page_number >= page.total_pages
            ):
                return
            await asyncio.sleep(PAGE_DELAY)

    def _log_progress(
        self,
        collection: Collection,
        page_number: int,
        scraped_items: int,
        page: SearchPage,
    ) -> None:
        if page_number == 0 and page.total_items is not None:
            print(f"[{collection.thesis_type}] collection total: {page.total_items} items")
        page_label = (
            f"{page_number + 1}/{page.total_pages}"
            if page.total_pages
            else str(page_number + 1)
        )
        scraped_label = (
            f"{scraped_items}/{page.total_items}"
            if page.total_items
            else str(scraped_items)
        )
        remaining_collection = max(page.total_items - scraped_items, 0) if page.total_items else None
        remaining_label = (
            f", {remaining_collection} remaining in {collection.thesis_type}"
            if remaining_collection is not None
            else ""
        )
        if len(self.collection_totals) == len(COLLECTIONS):
            scraped_total = sum(self.scraped_by_collection.values())
            catalog_total = sum(self.collection_totals.values())
            remaining_label += f", {max(catalog_total - scraped_total, 0)} remaining catalog-wide"
        print(
            f"[{collection.thesis_type}] page {page_label}: "
            f"{scraped_label} items, {len(self.store.records)} unique{remaining_label}"
        )


async def fetch_collection_totals(client: DspaceClient) -> dict[str, int | None]:
    totals: dict[str, int | None] = {}
    for index, collection in enumerate(COLLECTIONS):
        page = DspaceParser.parse_page(await client.fetch_page(collection, 0))
        totals[collection.thesis_type] = page.total_items
        if index < len(COLLECTIONS) - 1:
            await asyncio.sleep(PAGE_DELAY)
    return totals


async def check_for_updates() -> bool:
    previous_totals = ScrapeState(STATE_PATH).load()
    async with DspaceClient() as client:
        current_totals = await fetch_collection_totals(client)

    for thesis_type, total in current_totals.items():
        print(f"[{thesis_type}] API total: {total if total is not None else 'unavailable'}")
    changed = any(
        total is None or previous_totals.get(thesis_type) != total
        for thesis_type, total in current_totals.items()
    )
    print(f"scrape-needed={'true' if changed else 'false'}")
    return changed


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="Check collection totals without scraping")
    args = parser.parse_args()
    if args.check:
        await check_for_updates()
        return

    store = RecordStore(OUTPUT_PATH)
    state = ScrapeState(STATE_PATH)
    async with DspaceClient() as client:
        await ThesisScraper(client, store, state).run()


if __name__ == "__main__":
    asyncio.run(main())
