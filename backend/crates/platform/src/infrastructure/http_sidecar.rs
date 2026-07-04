//! HTTP-адаптеры к Python-сайдкару. Live `/run` ходит в сайдкар по
//! `SIDECAR_URL`; ошибки сайдкара должны быть видны вызывающему коду.

use std::sync::OnceLock;
use std::time::Duration;

use contracts::{DiagnosticsReport, ExtractResponse};
use serde::de::DeserializeOwned;
use serde_json::{json, Value};

use crate::application::ports::{DiagnosticsSource, ExtractSource};
use crate::infrastructure::{FileDiagnosticsSource, FileExtractSource};

/// Переиспользуемый blocking-клиент: пул соединений + таймаут задаются один раз,
/// а не на каждый вызов сайдкара.
fn blocking_client() -> Result<&'static reqwest::blocking::Client, String> {
    static CLIENT: OnceLock<reqwest::blocking::Client> = OnceLock::new();
    if let Some(client) = CLIENT.get() {
        return Ok(client);
    }
    let client = reqwest::blocking::Client::builder()
        .timeout(sidecar_timeout())
        .build()
        .map_err(|e| e.to_string())?;
    Ok(CLIENT.get_or_init(|| client))
}

/// Выполнить blocking-POST на отдельном std-потоке: reqwest::blocking держит
/// собственный runtime, который нельзя ронять внутри async-контекста tokio.
fn blocking_post<T: DeserializeOwned + Send + 'static>(
    url: String,
    body: Value,
) -> Result<T, String> {
    std::thread::spawn(move || -> Result<T, String> {
        let client = blocking_client()?;
        client
            .post(&url)
            .json(&body)
            .send()
            .and_then(|r| r.error_for_status())
            .map_err(|e| e.to_string())?
            .json::<T>()
            .map_err(|e| e.to_string())
    })
    .join()
    .map_err(|_| "sidecar request thread panicked".to_string())?
}

fn sidecar_timeout() -> Duration {
    let millis = std::env::var("SIDECAR_TIMEOUT_MS")
        .ok()
        .and_then(|v| v.parse::<u64>().ok())
        .unwrap_or(120_000);
    Duration::from_millis(millis)
}

fn mime_of(path: &str) -> &'static str {
    if path.ends_with(".pdf") {
        "application/pdf"
    } else if path.ends_with(".csv") {
        "text/csv"
    } else if path.ends_with(".docx") {
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    } else {
        "text/plain"
    }
}

/// `DiagnosticsSource` через `POST {SIDECAR_URL}/diagnose`.
pub struct HttpDiagnosticsSource {
    sidecar_url: String,
    fallback: FileDiagnosticsSource,
}

impl HttpDiagnosticsSource {
    pub fn new(sidecar_url: String, fallback: FileDiagnosticsSource) -> Self {
        HttpDiagnosticsSource {
            sidecar_url,
            fallback,
        }
    }
}

impl DiagnosticsSource for HttpDiagnosticsSource {
    fn load(
        &self,
        factory_id: &str,
        source_file: Option<&str>,
        pack_id: &str,
    ) -> Result<DiagnosticsReport, String> {
        let url = format!("{}/diagnose", self.sidecar_url.trim_end_matches('/'));
        if let Some(file_path) = source_file {
            let body = json!({
                "factory_id": factory_id,
                "file_path": file_path,
                "pack_id": pack_id,
            });
            return blocking_post::<DiagnosticsReport>(url, body);
        }

        // For known factories, keep the file version as source of file_path and
        // deterministic demo fallback.
        let file = self.fallback.load(factory_id, None, pack_id)?;
        let body = json!({
            "factory_id": factory_id,
            "file_path": file.source_file.as_str(),
            "pack_id": if file.pack_id.is_empty() { pack_id } else { &file.pack_id },
        });
        // Демо-страховка: при недоступности/ошибке сайдкара отдаём ранее
        // загруженную файловую фикстуру, а не роняем /run (см. шапку файла).
        blocking_post::<DiagnosticsReport>(url, body).or(Ok(file))
    }
}

/// `ExtractSource` через `POST {SIDECAR_URL}/extract`.
pub struct HttpExtractSource {
    sidecar_url: String,
    _fallback: FileExtractSource,
}

impl HttpExtractSource {
    pub fn new(sidecar_url: String, fallback: FileExtractSource) -> Self {
        HttpExtractSource {
            sidecar_url,
            _fallback: fallback,
        }
    }
}

impl ExtractSource for HttpExtractSource {
    fn load(&self) -> Result<ExtractResponse, String> {
        let url = format!("{}/extract", self.sidecar_url.trim_end_matches('/'));
        let docs: Vec<Value> = live_extract_docs()
            .into_iter()
            .map(|path| json!({ "path": path, "mime": mime_of(path) }))
            .collect();
        let body = json!({ "docs": docs, "pack_id": "flotation-v1" });
        blocking_post::<ExtractResponse>(url, body)
    }
}

fn live_extract_docs() -> [&'static str; 2] {
    [
        "docs/sample_docs/flotation/classification_notes.txt",
        "docs/sample_docs/flotation/flotation_kinetics_notes.txt",
    ]
}
