//! `ExtractSource` поверх `fixtures/extract_response*.json`.

use std::path::{Path, PathBuf};

use contracts::ExtractResponse;

use crate::application::ports::ExtractSource;

pub struct FileExtractSource {
    base_dir: PathBuf,
}

impl FileExtractSource {
    pub fn new(base_dir: impl AsRef<Path>) -> Self {
        FileExtractSource {
            base_dir: base_dir.as_ref().to_path_buf(),
        }
    }

    fn fixture_path(&self, pack_id: &str) -> PathBuf {
        let fixtures_dir = self.base_dir.join("fixtures");
        let pack_path = fixtures_dir.join(format!("extract_response_{pack_id}.json"));
        if pack_path.exists() {
            pack_path
        } else {
            fixtures_dir.join("extract_response.json")
        }
    }
}

impl ExtractSource for FileExtractSource {
    fn load(&self, pack_id: &str) -> Result<ExtractResponse, String> {
        let path = self.fixture_path(pack_id);
        let text = std::fs::read_to_string(&path)
            .map_err(|e| format!("cannot read extract fixture '{}': {e}", path.display()))?;
        serde_json::from_str(&text).map_err(|e| format!("cannot parse extract fixture: {e}"))
    }
}
